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
	redeemedOnce bool
	pendingAdded int64
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
	return domain.MitraFinanceSummary{PendingBalance: r.pendingAdded}, nil
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
