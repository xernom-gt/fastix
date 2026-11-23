package service

import (
	"context"
	"errors"
	"math"
	"net/mail"
	"sort"
	"strings"
	"time"
	"unicode"

	"fastix/api/internal/domain"
	"fastix/api/internal/repository"
)

var wibZone = time.FixedZone("WIB", 7*3600)

var defaultRegions = []domain.RegionSummary{
	{Kode: "bali", Nama: "Bali", Provinsi: "Bali", Pusat: domain.GeoPoint{Lat: -8.4095, Lng: 115.1889}},
	{Kode: "jogja", Nama: "D.I. Yogyakarta", Provinsi: "DI Yogyakarta", Pusat: domain.GeoPoint{Lat: -7.7956, Lng: 110.3695}},
	{Kode: "bandung", Nama: "Bandung Raya", Provinsi: "Jawa Barat", Pusat: domain.GeoPoint{Lat: -6.9175, Lng: 107.6191}},
	{Kode: "jakarta", Nama: "Jabodetabek", Provinsi: "DKI Jakarta", Pusat: domain.GeoPoint{Lat: -6.2088, Lng: 106.8456}},
	{Kode: "malang", Nama: "Malang & Batu", Provinsi: "Jawa Timur", Pusat: domain.GeoPoint{Lat: -7.9666, Lng: 112.6326}},
}

// DiscoveryService handles regions, partner leads, and venue search.
type DiscoveryService struct {
	repo repository.DiscoveryRepository
}

// NewDiscoveryService constructs a DiscoveryService.
func NewDiscoveryService(repo repository.DiscoveryRepository) *DiscoveryService {
	return &DiscoveryService{repo: repo}
}

func (s *DiscoveryService) ListRegions(ctx context.Context) ([]domain.RegionSummary, error) {
	counts, err := s.repo.CountActiveVenuesByKota(ctx)
	if err != nil {
		return nil, err
	}

	regions := make([]domain.RegionSummary, len(defaultRegions))
	for i, reg := range defaultRegions {
		reg.ActiveVenueCount = counts[reg.Kode]
		regions[i] = reg
	}
	return regions, nil
}

func (s *DiscoveryService) CreatePartnerLead(ctx context.Context, req domain.PartnerLeadRequest) (domain.PartnerLeadResponse, error) {
	cleaned := domain.PartnerLeadRequest{
		VenueName: strings.TrimSpace(req.VenueName),
		KotaKode:  strings.ToLower(strings.TrimSpace(req.KotaKode)),
		PicName:   strings.TrimSpace(req.PicName),
		Whatsapp:  normalizePhone(req.Whatsapp),
		Email:     strings.ToLower(strings.TrimSpace(req.Email)),
	}

	details := map[string]string{}
	if len(cleaned.VenueName) < 3 {
		details["venueName"] = "Nama destinasi minimal 3 karakter."
	}
	if cleaned.KotaKode == "" {
		details["kotaKode"] = "Wilayah destinasi wajib dipilih."
	}
	if len(cleaned.PicName) < 2 {
		details["picName"] = "Nama PIC minimal 2 karakter."
	}
	if len(cleaned.Whatsapp) < 9 || len(cleaned.Whatsapp) > 16 {
		details["whatsapp"] = "Nomor WhatsApp tidak valid."
	}
	if _, err := mail.ParseAddress(cleaned.Email); err != nil || !strings.Contains(cleaned.Email, ".") {
		details["email"] = "Format email tidak valid."
	}
	if len(details) > 0 {
		return domain.PartnerLeadResponse{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Data calon mitra tidak valid.", details)
	}

	return s.repo.CreatePartnerLead(ctx, cleaned)
}

func (s *DiscoveryService) ListVenues(ctx context.Context, filter domain.VenueListFilter) (domain.VenueSearchResult, error) {
	if filter.Tanggal == "" {
		filter.Tanggal = time.Now().In(wibZone).Format("2006-01-02")
	} else if _, err := time.Parse("2006-01-02", filter.Tanggal); err != nil {
		return domain.VenueSearchResult{}, domain.NewAppError(domain.ErrValidation, "INVALID_DATE", "Format tanggal harus YYYY-MM-DD.", nil)
	}

	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 20
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	normalizedQuery := NormalizeCamelCase(filter.Query)
	venues, total, err := s.repo.SearchVenues(ctx, filter, normalizedQuery, false)
	if err != nil {
		return domain.VenueSearchResult{}, err
	}

	isFuzzy := false
	var correctedQuery *string
	if total == 0 && normalizedQuery != "" {
		fuzzyVenues, fuzzyTotal, err := s.repo.SearchVenues(ctx, filter, normalizedQuery, true)
		if err != nil {
			return domain.VenueSearchResult{}, err
		}
		if fuzzyTotal > 0 {
			venues = fuzzyVenues
			total = fuzzyTotal
			isFuzzy = true
			best := fuzzyVenues[0].Nama
			correctedQuery = &best
		}
	}

	if filter.Lat != nil && filter.Lng != nil {
		for i := range venues {
			if venues[i].Lat != nil && venues[i].Lng != nil {
				dist := HaversineMeters(*filter.Lat, *filter.Lng, *venues[i].Lat, *venues[i].Lng)
				venues[i].DistanceMeters = &dist
			}
		}
		if filter.SortBy == "terdekat" {
			sort.SliceStable(venues, func(i, j int) bool {
				di := venues[i].DistanceMeters
				dj := venues[j].DistanceMeters
				if di == nil {
					return false
				}
				if dj == nil {
					return true
				}
				return *di < *dj
			})
		}
	}

	return domain.VenueSearchResult{
		Venues:         venues,
		Total:          total,
		Tanggal:        filter.Tanggal,
		IsFuzzyMatch:   isFuzzy,
		CorrectedQuery: correctedQuery,
	}, nil
}

func (s *DiscoveryService) GetVenueDetail(ctx context.Context, venueID, tanggal string) (domain.VenueDetail, error) {
	venueID = strings.TrimSpace(venueID)
	if venueID == "" {
		return domain.VenueDetail{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "ID destinasi wajib diisi.", nil)
	}
	if tanggal == "" {
		tanggal = time.Now().In(wibZone).Format("2006-01-02")
	} else if _, err := time.Parse("2006-01-02", tanggal); err != nil {
		return domain.VenueDetail{}, domain.NewAppError(domain.ErrValidation, "INVALID_DATE", "Format tanggal harus YYYY-MM-DD.", nil)
	}

	detail, err := s.repo.FindVenueDetailByID(ctx, venueID, tanggal)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.VenueDetail{}, domain.NewAppError(domain.ErrNotFound, "VENUE_NOT_FOUND", "Destinasi wisata tidak ditemukan.", nil)
	}
	if err != nil {
		return domain.VenueDetail{}, err
	}
	return detail, nil
}

// NormalizeCamelCase splits camelCase tokens (e.g. "candiBorobudur" -> "candi borobudur").
func NormalizeCamelCase(input string) string {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return ""
	}

	var b strings.Builder
	runes := []rune(trimmed)
	for i, r := range runes {
		if i > 0 && unicode.IsUpper(r) && (unicode.IsLower(runes[i-1]) || unicode.IsDigit(runes[i-1])) {
			b.WriteRune(' ')
		}
		b.WriteRune(unicode.ToLower(r))
	}

	return strings.Join(strings.Fields(b.String()), " ")
}

// HaversineMeters calculates great-circle distance in meters between two coordinates.
func HaversineMeters(lat1, lng1, lat2, lng2 float64) int64 {
	const earthRadiusMeters = 6371000.0
	dLat := (lat2 - lat1) * math.Pi / 180.0
	dLng := (lng2 - lng1) * math.Pi / 180.0

	lat1Rad := lat1 * math.Pi / 180.0
	lat2Rad := lat2 * math.Pi / 180.0

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return int64(math.Round(earthRadiusMeters * c))
}
