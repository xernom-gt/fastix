package service

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"fastix/api/internal/domain"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type stubOpsRepo struct {
	redeemedOnce   bool
	redeemQty      int
	pendingAdded   int64
	venueOwnerID   string
	venueID        string
	venueImageURL  string
	grossRevenue   int64
	platformFee    int64
	updatedRequest *domain.UpdateMitraVenueRequest
	demoVenueCode  string
	demoVenueName  string
	demoKotaKode   string
	demoCity       string
	demoLokasi     string
	demoAlamat     string
	demoLat        float64
	demoLng        float64
	demoPinHash    string
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
	qty := r.redeemQty
	if qty <= 0 {
		qty = 1
	}
	r.redeemedOnce = true
	r.pendingAdded += 50000 * int64(qty)
	return domain.GateRedeemResult{
		TicketCode: ticketCode,
		Status:     domain.RedemptionStatusRedeemed,
		Quantity:   qty,
		RedeemedAt: redeemedAt.Format(time.RFC3339),
	}, nil
}

func (r *stubOpsRepo) ReleaseEscrowHPlusOne(_ context.Context, _ string) (int64, error) {
	return 1, nil
}

func (r *stubOpsRepo) UpsertKYB(_ context.Context, _, _, _ string, _ domain.SubmitKYBRequest) (domain.KYBSubmissionResponse, error) {
	return domain.KYBSubmissionResponse{ID: "kyb-1", VerificationStatus: "PENDING"}, nil
}

func (r *stubOpsRepo) DemoApproveKYBTx(_ context.Context, userID, venueCode, venueName, kotaKode, city, lokasi, alamat string, defaultLat, defaultLng float64, defaultPinHash string) (domain.UserProfile, error) {
	r.demoVenueCode = venueCode
	r.demoVenueName = venueName
	r.demoKotaKode = kotaKode
	r.demoCity = city
	r.demoLokasi = lokasi
	r.demoAlamat = alamat
	r.demoLat = defaultLat
	r.demoLng = defaultLng
	r.demoPinHash = defaultPinHash
	return domain.UserProfile{
		ID:            userID,
		FullName:      "Mitra Demo",
		PhoneNumber:   "08123456789",
		Email:         "mitra@example.com",
		Role:          domain.RoleMitra,
		OwnedVenueIDs: []string{"v-demo-1"},
	}, nil
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

func (r *stubOpsRepo) GetMitraVenueImageURL(_ context.Context, ownerID, venueID string) (string, error) {
	if r.venueID != "" && (venueID != r.venueID || ownerID != r.venueOwnerID) {
		return "", domain.ErrNotFound
	}
	return r.venueImageURL, nil
}

func (r *stubOpsRepo) UpdateMitraVenueImage(_ context.Context, ownerID, venueID, _, gambarURL string) (domain.MitraVenueDTO, error) {
	if r.venueID != "" && (venueID != r.venueID || ownerID != r.venueOwnerID) {
		return domain.MitraVenueDTO{}, domain.ErrNotFound
	}
	r.venueImageURL = gambarURL
	return domain.MitraVenueDTO{
		ID:          venueID,
		VenueCode:   "V-TEST",
		GambarURL:   gambarURL,
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
	svc := NewOperationsService(repo, hmacSecret, make([]byte, 32), "test-jwt-secret", "development")
	ctx := context.Background()

	today := time.Now().In(wibZone).Format("2006-01-02")
	sig := SignQRPayload(hmacSecret, "PWL-TIX-99887766", "v-borobudur", today)
	payload := "PWL-TIX-99887766|v-borobudur|" + today + "|" + sig

	// First scan succeeds and credits pending_balance
	res, err := svc.RedeemAtGate(ctx, "v-borobudur", "stf-1", domain.GateRedeemRequest{QRPayload: payload})
	if err != nil {
		t.Fatalf("first RedeemAtGate: %v", err)
	}
	if res.Status != domain.RedemptionStatusRedeemed || res.Quantity != 1 || repo.pendingAdded != 50000 {
		t.Fatalf("unexpected redeem result: %+v pending=%d", res, repo.pendingAdded)
	}

	// Group ticket scan reports Quantity=N and credits N * unitPrice
	groupRepo := &stubOpsRepo{redeemQty: 5}
	groupSvc := NewOperationsService(groupRepo, hmacSecret, make([]byte, 32), "test-jwt-secret", "development")
	groupRes, err := groupSvc.RedeemAtGate(ctx, "v-borobudur", "stf-1", domain.GateRedeemRequest{QRPayload: payload})
	if err != nil {
		t.Fatalf("group RedeemAtGate: %v", err)
	}
	if groupRes.Quantity != 5 || groupRepo.pendingAdded != 250000 {
		t.Fatalf("expected Quantity=5 and pending=250000, got %+v pending=%d", groupRes, groupRepo.pendingAdded)
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
	svc := NewOperationsService(repo, "qr-hmac-secret-key-123456", make([]byte, 32), "test-jwt-secret", "development")
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
	svc := NewOperationsService(repo, "qr-hmac-secret-key-123456", make([]byte, 32), "test-jwt-secret", "development")

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

func TestDemoApproveKYB(t *testing.T) {
	const (
		jwtSecret = "test-jwt-secret-key"
		userID    = "11111111-1111-1111-1111-111111111111"
	)

	t.Run("rejected in production mode with DEV_ONLY", func(t *testing.T) {
		repo := &stubOpsRepo{}
		svc := NewOperationsService(repo, "qr-hmac-secret", make([]byte, 32), jwtSecret, "production")

		_, err := svc.DemoApproveKYB(context.Background(), userID, domain.DemoApproveKYBRequest{})
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden in production, got %v", err)
		}
		var appErr *domain.AppError
		if !errors.As(err, &appErr) || appErr.Code != "DEV_ONLY" {
			t.Fatalf("expected DEV_ONLY error code, got %v", err)
		}
	})

	t.Run("succeeds in development mode and issues fresh MITRA JWT", func(t *testing.T) {
		repo := &stubOpsRepo{}
		svc := NewOperationsService(repo, "qr-hmac-secret", make([]byte, 32), jwtSecret, "development")

		res, err := svc.DemoApproveKYB(context.Background(), userID, domain.DemoApproveKYBRequest{})
		if err != nil {
			t.Fatalf("DemoApproveKYB: %v", err)
		}
		if res.AccessToken == "" {
			t.Fatal("expected non-empty accessToken")
		}
		if res.User.Role != domain.RoleMitra {
			t.Fatalf("expected role %q, got %q", domain.RoleMitra, res.User.Role)
		}
		if len(res.User.OwnedVenueIDs) != 1 || res.User.OwnedVenueIDs[0] != "v-demo-1" {
			t.Fatalf("expected OwnedVenueIDs=[v-demo-1], got %+v", res.User.OwnedVenueIDs)
		}

		// Verify JWT claims contain MITRA role
		var claims domain.AuthClaims
		parsed, err := jwt.ParseWithClaims(res.AccessToken, &claims, func(_ *jwt.Token) (any, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !parsed.Valid {
			t.Fatalf("invalid issued JWT: %v", err)
		}
		if claims.SubjectID != userID || claims.Role != domain.RoleMitra {
			t.Fatalf("unexpected JWT claims: %+v", claims)
		}

		// Verify defaults passed to repository
		if repo.demoVenueName != "Destinasi Wisata Mitra" || repo.demoKotaKode != "bali" || repo.demoAlamat != "Indonesia" {
			t.Fatalf("unexpected default venue fields: name=%q kota=%q alamat=%q", repo.demoVenueName, repo.demoKotaKode, repo.demoAlamat)
		}
		if len(repo.demoVenueCode) != 9 || repo.demoVenueCode[:5] != "LOKA-" {
			t.Fatalf("expected LOKA-XXXX venueCode, got %q", repo.demoVenueCode)
		}
		if err := bcrypt.CompareHashAndPassword([]byte(repo.demoPinHash), []byte("123456")); err != nil {
			t.Fatalf("expected default staff PIN hash for 123456: %v", err)
		}
	})
}

func TestUpdateMitraVenueLocationValidation(t *testing.T) {
	const (
		ownerID = "11111111-1111-1111-1111-111111111111"
		venueID = "33333333-3333-3333-3333-333333333333"
	)

	repo := &stubOpsRepo{
		venueOwnerID: ownerID,
		venueID:      venueID,
	}
	svc := NewOperationsService(repo, "qr-hmac-secret-key-123456", make([]byte, 32), "test-jwt-secret", "development")
	ctx := context.Background()

	baseReq := func() domain.UpdateMitraVenueRequest {
		return domain.UpdateMitraVenueRequest{
			Nama:      "Taman Sari Baru",
			Alamat:    "Jl. Tamanan No. 1, Yogyakarta",
			JamBuka:   "08:00 - 17:00 WIB",
			Deskripsi: "Destinasi wisata sejarah.",
			Fasilitas: []string{"Parkir"},
		}
	}

	t.Run("valid kotaKode, lokasi, and coordinates succeed and populate City", func(t *testing.T) {
		req := baseReq()
		kota := " JOGJA "
		lokasi := " Kraton, Yogyakarta "
		lat := -7.8101
		lng := 110.3592
		req.KotaKode = &kota
		req.Lokasi = &lokasi
		req.Latitude = &lat
		req.Longitude = &lng

		if _, err := svc.UpdateMitraVenue(ctx, ownerID, venueID, req); err != nil {
			t.Fatalf("expected UpdateMitraVenue to succeed, got %v", err)
		}
		if repo.updatedRequest == nil || repo.updatedRequest.KotaKode == nil || *repo.updatedRequest.KotaKode != "jogja" {
			t.Fatalf("expected normalized kotaKode=jogja, got %+v", repo.updatedRequest)
		}
		if repo.updatedRequest.City == nil || *repo.updatedRequest.City != "D.I. Yogyakarta" {
			t.Fatalf("expected populated City=D.I. Yogyakarta, got %+v", repo.updatedRequest.City)
		}
		if repo.updatedRequest.Lokasi == nil || *repo.updatedRequest.Lokasi != "Kraton, Yogyakarta" {
			t.Fatalf("expected trimmed lokasi, got %+v", repo.updatedRequest.Lokasi)
		}
	})

	t.Run("invalid kotaKode fails validation", func(t *testing.T) {
		req := baseReq()
		kota := "atlantis"
		req.KotaKode = &kota

		if _, err := svc.UpdateMitraVenue(ctx, ownerID, venueID, req); !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation for invalid kotaKode, got %v", err)
		}
	})

	t.Run("single lat without lng fails validation", func(t *testing.T) {
		req := baseReq()
		lat := -7.8
		req.Latitude = &lat

		if _, err := svc.UpdateMitraVenue(ctx, ownerID, venueID, req); !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation when only latitude provided, got %v", err)
		}
	})

	t.Run("out-of-range coordinates fail validation", func(t *testing.T) {
		req := baseReq()
		lat := 95.0
		lng := 110.36
		req.Latitude = &lat
		req.Longitude = &lng

		if _, err := svc.UpdateMitraVenue(ctx, ownerID, venueID, req); !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation for out-of-range latitude, got %v", err)
		}
	})
}

func TestUploadMitraVenueImage(t *testing.T) {
	const (
		ownerID = "11111111-1111-1111-1111-111111111111"
		otherID = "22222222-2222-2222-2222-222222222222"
		venueID = "33333333-3333-3333-3333-333333333333"
	)

	// Minimal valid 1x1 PNG header/payload recognized by http.DetectContentType.
	validPNG := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
		0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
		0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
		0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
		0x42, 0x60, 0x82,
	}

	t.Run("valid PNG upload saves local file and returns public URL", func(t *testing.T) {
		tmpDir := t.TempDir()
		repo := &stubOpsRepo{venueOwnerID: ownerID, venueID: venueID}
		svc := NewOperationsService(repo, "qr-hmac-secret", make([]byte, 32), "test-jwt", "development").
			WithUploadDir(tmpDir)

		venue, err := svc.UploadMitraVenueImage(context.Background(), ownerID, venueID, validPNG)
		if err != nil {
			t.Fatalf("expected UploadMitraVenueImage to succeed, got %v", err)
		}
		if !strings.HasPrefix(venue.GambarURL, "/api/v1/uploads/venues/") || !strings.HasSuffix(venue.GambarURL, ".png") {
			t.Fatalf("unexpected GambarURL: %q", venue.GambarURL)
		}

		savedPath := filepath.Join(tmpDir, "venues", filepath.Base(venue.GambarURL))
		data, err := os.ReadFile(savedPath)
		if err != nil {
			t.Fatalf("expected saved file at %s: %v", savedPath, err)
		}
		if !bytes.Equal(data, validPNG) {
			t.Fatal("saved file bytes do not match uploaded PNG")
		}
	})

	t.Run("invalid MIME type rejected with ErrValidation", func(t *testing.T) {
		tmpDir := t.TempDir()
		repo := &stubOpsRepo{venueOwnerID: ownerID, venueID: venueID}
		svc := NewOperationsService(repo, "qr-hmac-secret", make([]byte, 32), "test-jwt", "development").
			WithUploadDir(tmpDir)

		_, err := svc.UploadMitraVenueImage(context.Background(), ownerID, venueID, []byte("plain text not an image"))
		if !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation for invalid MIME, got %v", err)
		}
	})

	t.Run("oversized payload rejected with ErrValidation", func(t *testing.T) {
		tmpDir := t.TempDir()
		repo := &stubOpsRepo{venueOwnerID: ownerID, venueID: venueID}
		svc := NewOperationsService(repo, "qr-hmac-secret", make([]byte, 32), "test-jwt", "development").
			WithUploadDir(tmpDir)

		oversized := make([]byte, 5*1024*1024+1)
		copy(oversized, validPNG)
		_, err := svc.UploadMitraVenueImage(context.Background(), ownerID, venueID, oversized)
		if !errors.Is(err, domain.ErrValidation) {
			t.Fatalf("expected ErrValidation for >5MB file, got %v", err)
		}
	})

	t.Run("non-owner rejected without creating any file", func(t *testing.T) {
		tmpDir := t.TempDir()
		repo := &stubOpsRepo{venueOwnerID: ownerID, venueID: venueID}
		svc := NewOperationsService(repo, "qr-hmac-secret", make([]byte, 32), "test-jwt", "development").
			WithUploadDir(tmpDir)

		_, err := svc.UploadMitraVenueImage(context.Background(), otherID, venueID, validPNG)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound for non-owner, got %v", err)
		}
		entries, err := os.ReadDir(tmpDir)
		if err != nil {
			t.Fatalf("ReadDir: %v", err)
		}
		if len(entries) != 0 {
			t.Fatalf("expected no files created in %s, got %d", tmpDir, len(entries))
		}
	})

	t.Run("re-uploading replaces and removes previous local file", func(t *testing.T) {
		tmpDir := t.TempDir()
		repo := &stubOpsRepo{venueOwnerID: ownerID, venueID: venueID}
		svc := NewOperationsService(repo, "qr-hmac-secret", make([]byte, 32), "test-jwt", "development").
			WithUploadDir(tmpDir)

		first, err := svc.UploadMitraVenueImage(context.Background(), ownerID, venueID, validPNG)
		if err != nil {
			t.Fatalf("first upload failed: %v", err)
		}
		firstPath := filepath.Join(tmpDir, "venues", filepath.Base(first.GambarURL))

		// Sleep 2ms so UnixMilli timestamp differs for the second filename.
		time.Sleep(2 * time.Millisecond)

		second, err := svc.UploadMitraVenueImage(context.Background(), ownerID, venueID, validPNG)
		if err != nil {
			t.Fatalf("second upload failed: %v", err)
		}
		secondPath := filepath.Join(tmpDir, "venues", filepath.Base(second.GambarURL))

		if firstPath == secondPath {
			t.Fatalf("expected distinct filenames for sequential uploads: %s", firstPath)
		}
		if _, err := os.Stat(firstPath); !os.IsNotExist(err) {
			t.Fatalf("expected old file %s to be removed, stat err=%v", firstPath, err)
		}
		if _, err := os.Stat(secondPath); err != nil {
			t.Fatalf("expected new file %s to exist: %v", secondPath, err)
		}
	})
}
