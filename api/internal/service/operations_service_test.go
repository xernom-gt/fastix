package service

import (
	"context"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"fastix/api/internal/domain"
)

type stubOpsRepo struct {
	redeemedOnce   bool
	pendingAdded   int64
	venueOwnerID   string
	venueID        string
	grossRevenue   int64
	platformFee    int64
	updatedRequest *domain.UpdateMitraVenueRequest
}

func (r *stubOpsRepo) ListTodayGateTickets(_ context.Context, _, _ string) ([]domain.ETicketDTO, error) {
	return []domain.ETicketDTO{}, nil
}

func (r *stubOpsRepo) RedeemTicketTx(_ context.Context, ticketCode, _, _, _ string, redeemedAt time.Time) (domain.GateRedeemResult, error) {
	if r.redeemedOnce {
		return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrConflict, "ALREADY_REDEEMED", "Tiket sudah pernah dipindai sebelumnya.", map[string]string{
			"redeemedAt": redeemedAt.Format(time.RFC3339),
		})
	}
	r.redeemedOnce = true
	r.pendingAdded += 50000
	return domain.GateRedeemResult{
		TicketCode: ticketCode,
		Status:     domain.RedemptionStatusRedeemed,
		RedeemedAt: redeemedAt.Format(time.RFC3339),
	}, nil
}

func (r *stubOpsRepo) ReleaseEscrowHPlusOne(_ context.Context, _ string) (int64, error) {
	return 1, nil
}

func (r *stubOpsRepo) UpsertKYB(_ context.Context, _, _, _ string, _ domain.SubmitKYBRequest) (domain.KYBSubmissionResponse, error) {
	return domain.KYBSubmissionResponse{ID: "kyb-1", VerificationStatus: "PENDING"}, nil
}

func (r *stubOpsRepo) ListMitraVenues(_ context.Context, _, _ string) ([]domain.MitraVenueDTO, error) {
	return []domain.MitraVenueDTO{}, nil
}

func (r *stubOpsRepo) UpdateMitraVenue(_ context.Context, ownerID, venueID, _ string, req domain.UpdateMitraVenueRequest) (domain.MitraVenueDTO, error) {
	if r.venueID != "" && (venueID != r.venueID || ownerID != r.venueOwnerID) {
		return domain.MitraVenueDTO{}, domain.ErrNotFound
	}
	reqCopy := req
	r.updatedRequest = &reqCopy
	return domain.MitraVenueDTO{
		ID:          venueID,
		VenueCode:   "V-TEST",
		Nama:        req.Nama,
		KotaKode:    "jog",
		Alamat:      req.Alamat,
		JamBuka:     req.JamBuka,
		Deskripsi:   req.Deskripsi,
		Fasilitas:   req.Fasilitas,
		IsPublished: true,
		Tickets:     []domain.TicketProduct{},
	}, nil
}

func (r *stubOpsRepo) CreateMitraTicket(_ context.Context, _ string, req domain.CreateTicketRequest) (domain.TicketProduct, error) {
	return domain.TicketProduct{ID: "t-1", VenueID: req.VenueID, Title: req.Title, Price: req.Price, DailyQuota: req.DailyQuota}, nil
}

func (r *stubOpsRepo) UpdateMitraTicket(_ context.Context, _, ticketID string, _ domain.UpdateTicketRequest) (domain.TicketProduct, error) {
	return domain.TicketProduct{ID: ticketID}, nil
}

func (r *stubOpsRepo) ListMitraStaffs(_ context.Context, _ string) ([]domain.MitraStaffDTO, error) {
	return []domain.MitraStaffDTO{}, nil
}

func (r *stubOpsRepo) CreateMitraStaff(_ context.Context, _, venueID, name, _ string) (domain.MitraStaffDTO, error) {
	return domain.MitraStaffDTO{ID: "stf-1", VenueID: venueID, Name: name, IsActive: true}, nil
}

func (r *stubOpsRepo) UpdateMitraStaff(_ context.Context, _, staffID string, _ *string, _ *bool) (domain.MitraStaffDTO, error) {
	return domain.MitraStaffDTO{ID: staffID}, nil
}

func (r *stubOpsRepo) GetMitraFinance(_ context.Context, _ string) (domain.MitraFinanceSummary, error) {
	return domain.MitraFinanceSummary{
		GrossRevenue:   r.grossRevenue,
		PlatformFee:    r.platformFee,
		PendingBalance: r.pendingAdded,
	}, nil
}

func (r *stubOpsRepo) CreatePayoutTx(_ context.Context, _ string, amount, adminFee int64) (domain.PayoutDTO, error) {
	return domain.PayoutDTO{ID: "pay-1", Amount: amount, AdminFee: adminFee, NetAmount: amount - adminFee, Status: "PENDING"}, nil
}

func TestAES256GCMRoundtrip(t *testing.T) {
	key, err := hex.DecodeString("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	if err != nil {
		t.Fatalf("decode key: %v", err)
	}

	plain := "3404011508950001"
	enc, err := EncryptAES256GCM(key, plain)
	if err != nil {
		t.Fatalf("EncryptAES256GCM: %v", err)
	}
	if enc == plain {
		t.Fatal("ciphertext must not equal plaintext")
	}

	dec, err := DecryptAES256GCM(key, enc)
	if err != nil {
		t.Fatalf("DecryptAES256GCM: %v", err)
	}
	if dec != plain {
		t.Fatalf("expected %q, got %q", plain, dec)
	}
}

func TestGateRedeemAndDoubleScan(t *testing.T) {
	const hmacSecret = "qr-hmac-secret-key-123456"
	repo := &stubOpsRepo{}
	svc := NewOperationsService(repo, hmacSecret, make([]byte, 32))
	ctx := context.Background()

	today := time.Now().In(wibZone).Format("2006-01-02")
	sig := SignQRPayload(hmacSecret, "PWL-TIX-99887766", "v-borobudur", today)
	payload := "PWL-TIX-99887766|v-borobudur|" + today + "|" + sig

	// First scan succeeds and credits pending_balance
	res, err := svc.RedeemAtGate(ctx, "v-borobudur", "stf-1", domain.GateRedeemRequest{QRPayload: payload})
	if err != nil {
		t.Fatalf("first RedeemAtGate: %v", err)
	}
	if res.Status != domain.RedemptionStatusRedeemed || repo.pendingAdded != 50000 {
		t.Fatalf("unexpected redeem result: %+v pending=%d", res, repo.pendingAdded)
	}

	// Second scan must be rejected with ErrConflict (ALREADY_REDEEMED)
	_, err = svc.RedeemAtGate(ctx, "v-borobudur", "stf-1", domain.GateRedeemRequest{QRPayload: payload})
	if !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("expected ErrConflict on double-scan, got %v", err)
	}

	// Minimum payout validation
	if _, err := svc.RequestPayout(ctx, "owner-1", domain.CreatePayoutRequest{Amount: 10000}); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected ErrValidation for payout below minimum, got %v", err)
	}
}

func TestUpdateMitraVenueValidationAndOwnership(t *testing.T) {
	const (
		ownerID = "11111111-1111-1111-1111-111111111111"
		otherID = "22222222-2222-2222-2222-222222222222"
		venueID = "33333333-3333-3333-3333-333333333333"
	)

	repo := &stubOpsRepo{
		venueOwnerID: ownerID,
		venueID:      venueID,
	}
	svc := NewOperationsService(repo, "qr-hmac-secret-key-123456", make([]byte, 32))
	ctx := context.Background()

	validReq := domain.UpdateMitraVenueRequest{
		Nama:      "Taman Sari Baru",
		Alamat:    "Jl. Tamanan No. 1, Yogyakarta",
		JamBuka:   "08:00 - 17:00 WIB",
		Deskripsi: "Destinasi wisata sejarah.",
		Fasilitas: []string{" Parkir ", "", "Toilet"},
	}

	// Invalid UUID must fail validation
	if _, err := svc.UpdateMitraVenue(ctx, ownerID, "not-a-uuid", validReq); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected ErrValidation for invalid venue UUID, got %v", err)
	}

	// Empty required fields must fail validation
	emptyCases := []struct {
		name string
		req  domain.UpdateMitraVenueRequest
	}{
		{"empty nama", domain.UpdateMitraVenueRequest{Nama: "   ", Alamat: validReq.Alamat, JamBuka: validReq.JamBuka, Deskripsi: validReq.Deskripsi}},
		{"empty alamat", domain.UpdateMitraVenueRequest{Nama: validReq.Nama, Alamat: "", JamBuka: validReq.JamBuka, Deskripsi: validReq.Deskripsi}},
		{"empty jamBuka", domain.UpdateMitraVenueRequest{Nama: validReq.Nama, Alamat: validReq.Alamat, JamBuka: "  ", Deskripsi: validReq.Deskripsi}},
		{"empty deskripsi", domain.UpdateMitraVenueRequest{Nama: validReq.Nama, Alamat: validReq.Alamat, JamBuka: validReq.JamBuka, Deskripsi: ""}},
	}
	for _, tc := range emptyCases {
		if _, err := svc.UpdateMitraVenue(ctx, ownerID, venueID, tc.req); !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("%s: expected ErrValidation, got %v", tc.name, err)
		}
	}

	// Non-owner must receive ErrNotFound (404)
	if _, err := svc.UpdateMitraVenue(ctx, otherID, venueID, validReq); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for non-owner, got %v", err)
	}

	// Owner update succeeds and normalizes fields
	updated, err := svc.UpdateMitraVenue(ctx, ownerID, venueID, validReq)
	if err != nil {
		t.Fatalf("expected UpdateMitraVenue to succeed, got %v", err)
	}
	if updated.ID != venueID || updated.Nama != validReq.Nama {
		t.Fatalf("unexpected updated venue: %+v", updated)
	}
	if repo.updatedRequest == nil || len(repo.updatedRequest.Fasilitas) != 2 || repo.updatedRequest.Fasilitas[0] != "Parkir" {
		t.Fatalf("expected cleaned fasilitas, got %+v", repo.updatedRequest)
	}
}

func TestGetMitraFinanceIncludesGrossRevenueAndPlatformFee(t *testing.T) {
	repo := &stubOpsRepo{
		grossRevenue: 1500000,
		platformFee:  75000,
		pendingAdded: 1425000,
	}
	svc := NewOperationsService(repo, "qr-hmac-secret-key-123456", make([]byte, 32))

	summary, err := svc.GetMitraFinance(context.Background(), "owner-1")
	if err != nil {
		t.Fatalf("GetMitraFinance: %v", err)
	}
	if summary.GrossRevenue != 1500000 {
		t.Fatalf("expected GrossRevenue=1500000, got %d", summary.GrossRevenue)
	}
	if summary.PlatformFee != 75000 {
		t.Fatalf("expected PlatformFee=75000, got %d", summary.PlatformFee)
	}
	if summary.PendingBalance != 1425000 {
		t.Fatalf("expected PendingBalance=1425000, got %d", summary.PendingBalance)
	}
}
