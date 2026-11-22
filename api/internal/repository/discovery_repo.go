package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"fastix/api/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DiscoveryRepository defines queries for regions, partner leads, and venue catalog.
type DiscoveryRepository interface {
	CountActiveVenuesByKota(ctx context.Context) (map[string]int, error)
	CreatePartnerLead(ctx context.Context, req domain.PartnerLeadRequest) (domain.PartnerLeadResponse, error)
	SearchVenues(ctx context.Context, filter domain.VenueListFilter, normalizedQuery string, useTrigram bool) ([]domain.VenueSummary, int, error)
	FindVenueDetailByID(ctx context.Context, venueID, tanggal string) (domain.VenueDetail, error)
}

// PgxDiscoveryRepository implements DiscoveryRepository using pgxpool.
type PgxDiscoveryRepository struct {
	pool *pgxpool.Pool
}

// NewPgxDiscoveryRepository creates a PostgreSQL-backed DiscoveryRepository.
func NewPgxDiscoveryRepository(pool *pgxpool.Pool) *PgxDiscoveryRepository {
	return &PgxDiscoveryRepository{pool: pool}
}

func (r *PgxDiscoveryRepository) CountActiveVenuesByKota(ctx context.Context) (map[string]int, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT kota_kode, COUNT(*)::int
		FROM venues
		WHERE is_published = TRUE
		GROUP BY kota_kode
	`)
	if err != nil {
		return nil, fmt.Errorf("count active venues by kota: %w", err)
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var kota string
		var count int
		if err := rows.Scan(&kota, &count); err != nil {
			return nil, fmt.Errorf("scan venue count: %w", err)
		}
		counts[kota] = count
	}
	return counts, rows.Err()
}

func (r *PgxDiscoveryRepository) CreatePartnerLead(ctx context.Context, req domain.PartnerLeadRequest) (domain.PartnerLeadResponse, error) {
	var res domain.PartnerLeadResponse
	err := r.pool.QueryRow(ctx, `
		INSERT INTO partner_leads (venue_name, kota_kode, pic_name, whatsapp, email)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, status::text
	`, req.VenueName, req.KotaKode, req.PicName, req.Whatsapp, req.Email).Scan(&res.LeadID, &res.Status)
	if err != nil {
		return domain.PartnerLeadResponse{}, fmt.Errorf("insert partner lead: %w", err)
	}
	return res, nil
}

func (r *PgxDiscoveryRepository) SearchVenues(ctx context.Context, filter domain.VenueListFilter, normalizedQuery string, useTrigram bool) ([]domain.VenueSummary, int, error) {
	args := []any{filter.Tanggal}
	argIdx := 2

	conditions := []string{"v.is_published = TRUE"}

	if filter.Kota != "" && filter.Kota != "all" {
		conditions = append(conditions, "v.kota_kode = $"+strconv.Itoa(argIdx))
		args = append(args, filter.Kota)
		argIdx++
	}

	if filter.Kategori != "" && filter.Kategori != "all" {
		conditions = append(conditions, "v.kategori::text = $"+strconv.Itoa(argIdx))
		args = append(args, filter.Kategori)
		argIdx++
	}

	queryParamIdx := 0
	if normalizedQuery != "" {
		queryParamIdx = argIdx
		if useTrigram {
			args = append(args, normalizedQuery)
			p := "$" + strconv.Itoa(queryParamIdx)
			conditions = append(conditions, "(similarity(v.name, "+p+") > 0.2 OR similarity(v.lokasi, "+p+") > 0.2)")
		} else {
			args = append(args, "%"+normalizedQuery+"%")
			p := "$" + strconv.Itoa(queryParamIdx)
			conditions = append(conditions, "(v.name ILIKE "+p+" OR v.lokasi ILIKE "+p+" OR v.city ILIKE "+p+")")
		}
		argIdx++
	}

	whereClause := strings.Join(conditions, " AND ")

	var total int
	countSQL := "SELECT COUNT(*)::int FROM venues v WHERE " + whereClause
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count venues: %w", err)
	}
	if total == 0 {
		return []domain.VenueSummary{}, 0, nil
	}

	orderBy := "v.rating DESC, v.jumlah_ulasan DESC"
	if useTrigram && queryParamIdx > 0 {
		p := "$" + strconv.Itoa(queryParamIdx)
		orderBy = "GREATEST(similarity(v.name, " + p + "), similarity(v.lokasi, " + p + ")) DESC, v.rating DESC"
	} else {
		switch filter.SortBy {
		case "harga_asc":
			orderBy = "v.harga_mulai ASC, v.rating DESC"
		case "harga_desc":
			orderBy = "v.harga_mulai DESC, v.rating DESC"
		case "popularitas":
			orderBy = "v.jumlah_ulasan DESC, v.rating DESC"
		}
	}

	limitIdx := argIdx
	offsetIdx := argIdx + 1
	args = append(args, filter.Limit, filter.Offset)

	sqlQuery := `
		SELECT
			v.id::text,
			v.venue_code,
			v.name,
			v.kota_kode,
			v.lokasi,
			v.kategori::text,
			v.harga_mulai::bigint,
			v.rating::float8,
			v.jumlah_ulasan,
			v.gambar_url,
			v.gambar_alt,
			v.is_published,
			v.latitude::float8,
			v.longitude::float8,
			COALESCE((
				SELECT GREATEST(0, COALESCE(SUM(t.daily_quota), 0) - COALESCE((
					SELECT SUM(ti.quantity)
					FROM transaction_items ti
					JOIN transactions tr ON tr.id = ti.transaction_id
					WHERE ti.ticket_id = t.id
					  AND ti.booking_date = $1::date
					  AND (tr.payment_status = 'PAID' OR (tr.payment_status = 'PENDING' AND tr.expired_at > NOW()))
				), 0))
				FROM tickets t
				WHERE t.venue_id = v.id AND t.is_active = TRUE
			), 0)::int AS remaining_quota
		FROM venues v
		WHERE ` + whereClause + `
		ORDER BY ` + orderBy + `
		LIMIT $` + strconv.Itoa(limitIdx) + ` OFFSET $` + strconv.Itoa(offsetIdx)

	rows, err := r.pool.Query(ctx, sqlQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query venues: %w", err)
	}
	defer rows.Close()

	venues := make([]domain.VenueSummary, 0)
	for rows.Next() {
		var v domain.VenueSummary
		if err := rows.Scan(
			&v.ID,
			&v.VenueCode,
			&v.Nama,
			&v.KotaKode,
			&v.Lokasi,
			&v.Kategori,
			&v.HargaMulai,
			&v.Rating,
			&v.JumlahUlasan,
			&v.GambarURL,
			&v.GambarAlt,
			&v.IsPublished,
			&v.Lat,
			&v.Lng,
			&v.RemainingQuota,
		); err != nil {
			return nil, 0, fmt.Errorf("scan venue summary: %w", err)
		}
		venues = append(venues, v)
	}

	return venues, total, rows.Err()
}

func (r *PgxDiscoveryRepository) FindVenueDetailByID(ctx context.Context, venueID, tanggal string) (domain.VenueDetail, error) {
	var detail domain.VenueDetail
	var lat, lng *float64

	err := r.pool.QueryRow(ctx, `
		SELECT
			id::text, venue_code, name, kota_kode, lokasi, address, jam_buka,
			description, kategori::text, harga_mulai::bigint, rating::float8,
			jumlah_ulasan, gambar_url, gambar_alt, fasilitas, latitude::float8,
			longitude::float8, is_published
		FROM venues
		WHERE id = $1::uuid AND is_published = TRUE
	`, venueID).Scan(
		&detail.ID,
		&detail.VenueCode,
		&detail.Nama,
		&detail.KotaKode,
		&detail.Lokasi,
		&detail.Alamat,
		&detail.JamBuka,
		&detail.Deskripsi,
		&detail.Kategori,
		&detail.HargaMulai,
		&detail.Rating,
		&detail.JumlahUlasan,
		&detail.GambarURL,
		&detail.GambarAlt,
		&detail.Fasilitas,
		&lat,
		&lng,
		&detail.IsPublished,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.VenueDetail{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.VenueDetail{}, fmt.Errorf("find venue detail: %w", err)
	}

	if lat != nil {
		detail.Koordinat.Lat = *lat
	}
	if lng != nil {
		detail.Koordinat.Lng = *lng
	}
	if detail.Fasilitas == nil {
		detail.Fasilitas = []string{}
	}

	rows, err := r.pool.Query(ctx, `
		SELECT
			t.id::text,
			t.venue_id::text,
			t.title,
			t.description,
			t.price::bigint,
			t.daily_quota,
			COALESCE(SUM(CASE WHEN tr.payment_status = 'PAID' THEN ti.quantity ELSE 0 END), 0)::int AS used_paid,
			COALESCE(SUM(CASE WHEN tr.payment_status = 'PENDING' AND tr.expired_at > NOW() THEN ti.quantity ELSE 0 END), 0)::int AS used_pending
		FROM tickets t
		LEFT JOIN transaction_items ti ON ti.ticket_id = t.id AND ti.booking_date = $2::date
		LEFT JOIN transactions tr ON tr.id = ti.transaction_id
		WHERE t.venue_id = $1::uuid AND t.is_active = TRUE
		GROUP BY t.id
		ORDER BY t.price ASC, t.created_at ASC
	`, venueID, tanggal)
	if err != nil {
		return domain.VenueDetail{}, fmt.Errorf("query venue tickets: %w", err)
	}
	defer rows.Close()

	detail.Tickets = make([]domain.TicketProduct, 0)
	for rows.Next() {
		var tkt domain.TicketProduct
		if err := rows.Scan(
			&tkt.ID,
			&tkt.VenueID,
			&tkt.Title,
			&tkt.Description,
			&tkt.Price,
			&tkt.DailyQuota,
			&tkt.UsedQuotaPaid,
			&tkt.UsedQuotaPending,
		); err != nil {
			return domain.VenueDetail{}, fmt.Errorf("scan venue ticket: %w", err)
		}
		detail.Tickets = append(detail.Tickets, tkt)
	}

	if err := rows.Err(); err != nil {
		return domain.VenueDetail{}, fmt.Errorf("iterate venue tickets: %w", err)
	}
	return detail, nil
}
