package service

import (
	"context"
	"testing"

	"fastix/api/internal/domain"
)

type stubDiscoveryRepo struct {
	counts       map[string]int
	exactVenues  []domain.VenueSummary
	fuzzyVenues  []domain.VenueSummary
}

func (r *stubDiscoveryRepo) CountActiveVenuesByKota(_ context.Context) (map[string]int, error) {
	return r.counts, nil
}

func (r *stubDiscoveryRepo) CreatePartnerLead(_ context.Context, _ domain.PartnerLeadRequest) (domain.PartnerLeadResponse, error) {
	return domain.PartnerLeadResponse{LeadID: "lead-1", Status: "RECEIVED"}, nil
}

func (r *stubDiscoveryRepo) SearchVenues(_ context.Context, _ domain.VenueListFilter, _ string, useTrigram bool) ([]domain.VenueSummary, int, error) {
	if useTrigram {
		return r.fuzzyVenues, len(r.fuzzyVenues), nil
	}
	return r.exactVenues, len(r.exactVenues), nil
}

func (r *stubDiscoveryRepo) FindVenueDetailByID(_ context.Context, venueID, _ string) (domain.VenueDetail, error) {
	return domain.VenueDetail{ID: venueID, Nama: "Candi Borobudur"}, nil
}

func TestNormalizeCamelCaseAndHaversine(t *testing.T) {
	if got := NormalizeCamelCase("candiBorobudur"); got != "candi borobudur" {
		t.Fatalf("expected 'candi borobudur', got %q", got)
	}
	if got := NormalizeCamelCase("  TirtaGanggaBali  "); got != "tirta gangga bali" {
		t.Fatalf("expected 'tirta gangga bali', got %q", got)
	}

	// Same point -> 0 meters
	if d := HaversineMeters(-7.6079, 110.2038, -7.6079, 110.2038); d != 0 {
		t.Fatalf("expected 0m, got %d", d)
	}

	// Borobudur to Prambanan (~29km)
	dist := HaversineMeters(-7.6079, 110.2038, -7.7520, 110.4915)
	if dist < 25000 || dist > 40000 {
		t.Fatalf("expected ~35km, got %dm", dist)
	}
}

func TestListVenuesFuzzyFallback(t *testing.T) {
	repo := &stubDiscoveryRepo{
		exactVenues: []domain.VenueSummary{},
		fuzzyVenues: []domain.VenueSummary{
			{ID: "v-1", Nama: "Candi Borobudur"},
		},
	}
	svc := NewDiscoveryService(repo)

	res, err := svc.ListVenues(context.Background(), domain.VenueListFilter{
		Query:   "borobodur",
		Tanggal: "2026-11-21",
	})
	if err != nil {
		t.Fatalf("ListVenues: %v", err)
	}
	if !res.IsFuzzyMatch || res.CorrectedQuery == nil || *res.CorrectedQuery != "Candi Borobudur" {
		t.Fatalf("expected fuzzy match suggestion, got %+v", res)
	}
}

func TestGetVenueDetailAllowsSlugAndCode(t *testing.T) {
	svc := NewDiscoveryService(&stubDiscoveryRepo{})

	for _, id := range []string{"tirta-gangga", "LOKA-0142", "11111111-1111-1111-1111-111111111111"} {
		detail, err := svc.GetVenueDetail(context.Background(), id, "2026-11-23")
		if err != nil {
			t.Fatalf("expected GetVenueDetail(%q) to succeed, got %v", id, err)
		}
		if detail.ID != id {
			t.Fatalf("expected detail.ID=%q, got %q", id, detail.ID)
		}
	}
}
