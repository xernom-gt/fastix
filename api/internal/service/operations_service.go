package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"fastix/api/internal/domain"
	"fastix/api/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

// OperationsService handles gate scanning, offline sync, escrow release, and mitra operations.
type OperationsService struct {
	repo         repository.OperationsRepository
	qrHMACSecret string
	kybAESKey    []byte
	jwtSecret    string
	isDev        bool
}

// NewOperationsService constructs an OperationsService.
func NewOperationsService(repo repository.OperationsRepository, qrHMACSecret string, kybAESKey []byte, jwtSecret, appEnv string) *OperationsService {
	return &OperationsService{
		repo:         repo,
		qrHMACSecret: qrHMACSecret,
		kybAESKey:    kybAESKey,
		jwtSecret:    jwtSecret,
		isDev:        strings.EqualFold(appEnv, "development"),
	}
}

func (s *OperationsService) ListTodayGateTickets(ctx context.Context, venueID string) ([]domain.ETicketDTO, error) {
	if strings.TrimSpace(venueID) == "" {
		return nil, domain.NewAppError(domain.ErrValidation, "VENUE_REQUIRED", "venueId wajib tersedia.", nil)
	}
	todayWIB := time.Now().In(wibZone).Format("2006-01-02")
	return s.repo.ListTodayGateTickets(ctx, venueID, todayWIB)
}

func (s *OperationsService) RedeemAtGate(ctx context.Context, venueID, staffID string, req domain.GateRedeemRequest) (domain.GateRedeemResult, error) {
	ticketCode := strings.TrimSpace(req.TicketCode)
	qrPayload := strings.TrimSpace(req.QRPayload)

	if qrPayload != "" {
		parsedCode, parsedVenueID, parsedDate, valid := VerifyQRPayload(s.qrHMACSecret, qrPayload)
		if !valid {
			return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrUnauthorized, "INVALID_QR_SIGNATURE", "Tanda tangan QR tiket tidak valid.", nil)
		}
		if venueID != "" && parsedVenueID != venueID {
			return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrForbidden, "WRONG_VENUE", "Tiket ini bukan untuk destinasi Anda.", nil)
		}
		todayWIB := time.Now().In(wibZone).Format("2006-01-02")
		if parsedDate != todayWIB {
			return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrConflict, "WRONG_BOOKING_DATE", "Tiket tidak berlaku untuk tanggal hari ini.", nil)
		}
		ticketCode = parsedCode
	}

	if ticketCode == "" {
		return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "qrPayload atau ticketCode wajib diisi.", nil)
	}

	todayWIB := time.Now().In(wibZone).Format("2006-01-02")
	return s.repo.RedeemTicketTx(ctx, ticketCode, venueID, staffID, todayWIB, time.Now().UTC())
}

func (s *OperationsService) SyncOfflineScans(ctx context.Context, venueID, staffID string, req domain.GateSyncRequest) ([]domain.GateSyncItemResult, error) {
	if len(req.Items) == 0 {
		return nil, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Daftar antrean scan offline kosong.", nil)
	}

	todayWIB := time.Now().In(wibZone).Format("2006-01-02")
	results := make([]domain.GateSyncItemResult, 0, len(req.Items))
	for _, item := range req.Items {
		code := strings.TrimSpace(item.TicketCode)
		if code == "" {
			results = append(results, domain.GateSyncItemResult{
				TicketCode: item.TicketCode,
				Outcome:    "REJECTED",
				Message:    "Kode tiket kosong.",
			})
			continue
		}

		scannedAt := time.Now().UTC()
		if parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(item.ScannedAt)); err == nil {
			scannedAt = parsed.UTC()
		}

		_, err := s.repo.RedeemTicketTx(ctx, code, venueID, staffID, todayWIB, scannedAt)
		if err == nil {
			results = append(results, domain.GateSyncItemResult{
				TicketCode: code,
				Outcome:    "REDEEMED",
				Message:    "Sinkronisasi berhasil.",
			})
			continue
		}

		var appErr *domain.AppError
		if errors.As(err, &appErr) && appErr.Code == "ALREADY_REDEEMED" {
			results = append(results, domain.GateSyncItemResult{
				TicketCode: code,
				Outcome:    "ALREADY_REDEEMED",
				Message:    appErr.Message,
			})
			continue
		}

		results = append(results, domain.GateSyncItemResult{
			TicketCode: code,
			Outcome:    "REJECTED",
			Message:    err.Error(),
		})
	}
	return results, nil
}

func (s *OperationsService) ReleaseEscrowHPlusOne(ctx context.Context) (int64, error) {
	todayWIB := time.Now().In(wibZone).Format("2006-01-02")
	return s.repo.ReleaseEscrowHPlusOne(ctx, todayWIB)
}

func (s *OperationsService) SubmitKYB(ctx context.Context, userID string, req domain.SubmitKYBRequest) (domain.KYBSubmissionResponse, error) {
	if len(s.kybAESKey) != 32 {
		return domain.KYBSubmissionResponse{}, fmt.Errorf("KYB_ENCRYPTION_KEY is not configured")
	}

	details := map[string]string{}
	if strings.TrimSpace(req.KTPNumber) == "" {
		details["ktpNumber"] = "Nomor KTP wajib diisi."
	}
	if strings.TrimSpace(req.KTPPhotoURL) == "" {
		details["ktpPhotoUrl"] = "Foto KTP wajib diunggah."
	}
	if strings.TrimSpace(req.NPWPNumber) == "" {
		details["npwpNumber"] = "Nomor NPWP wajib diisi."
	}
	if strings.TrimSpace(req.NPWPPhotoURL) == "" {
		details["npwpPhotoUrl"] = "Foto NPWP wajib diunggah."
	}
	if strings.TrimSpace(req.BankCode) == "" || strings.TrimSpace(req.BankAccountNumber) == "" || strings.TrimSpace(req.BankAccountName) == "" {
		details["bankAccount"] = "Data rekening bank lengkap wajib diisi."
	}
	if len(details) > 0 {
		return domain.KYBSubmissionResponse{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Data legalitas KYB tidak lengkap.", details)
	}

	encKTP, err := EncryptAES256GCM(s.kybAESKey, strings.TrimSpace(req.KTPNumber))
	if err != nil {
		return domain.KYBSubmissionResponse{}, fmt.Errorf("encrypt ktp: %w", err)
	}
	encNPWP, err := EncryptAES256GCM(s.kybAESKey, strings.TrimSpace(req.NPWPNumber))
	if err != nil {
		return domain.KYBSubmissionResponse{}, fmt.Errorf("encrypt npwp: %w", err)
	}

	return s.repo.UpsertKYB(ctx, userID, encKTP, encNPWP, req)
}

func (s *OperationsService) DemoApproveKYB(ctx context.Context, userID string, req domain.DemoApproveKYBRequest) (domain.AuthTokenResponse, error) {
	if !s.isDev {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrForbidden, "DEV_ONLY", "Endpoint demo persetujuan mitra hanya tersedia pada mode development.", nil)
	}

	venueName := strings.TrimSpace(req.VenueName)
	if venueName == "" {
		venueName = "Destinasi Wisata Mitra"
	}

	kotaKode := strings.ToLower(strings.TrimSpace(req.KotaKode))
	if kotaKode == "" {
		kotaKode = "bali"
	}

	alamat := strings.TrimSpace(req.Alamat)
	if alamat == "" {
		alamat = "Indonesia"
	}

	city, lokasi := resolveRegionCity(kotaKode)

	suffix, err := randomHexUpper(2)
	if err != nil {
		return domain.AuthTokenResponse{}, fmt.Errorf("generate demo venue code: %w", err)
	}
	venueCode := "LOKA-" + suffix

	pinHash, err := bcrypt.GenerateFromPassword([]byte("123456"), bcryptCost)
	if err != nil {
		return domain.AuthTokenResponse{}, fmt.Errorf("hash default staff pin: %w", err)
	}

	profile, err := s.repo.DemoApproveKYBTx(ctx, userID, venueCode, venueName, kotaKode, city, lokasi, alamat, string(pinHash))
	if errors.Is(err, domain.ErrNotFound) {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrNotFound, "USER_NOT_FOUND", "Pengguna tidak ditemukan.", nil)
	}
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	token, err := issueJWT(s.jwtSecret, profile.ID, profile.Role, "", "")
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	return domain.AuthTokenResponse{
		AccessToken: token,
		User:        profile,
	}, nil
}

func resolveRegionCity(kotaKode string) (city, lokasi string) {
	for _, r := range defaultRegions {
		if strings.EqualFold(r.Kode, kotaKode) {
			return r.Nama, r.Nama + ", " + r.Provinsi
		}
	}
	return kotaKode, kotaKode
}

func (s *OperationsService) ListMitraVenues(ctx context.Context, ownerID string) ([]domain.MitraVenueDTO, error) {
	todayWIB := time.Now().In(wibZone).Format("2006-01-02")
	return s.repo.ListMitraVenues(ctx, ownerID, todayWIB)
}

func (s *OperationsService) UpdateMitraVenue(ctx context.Context, ownerID, venueID string, req domain.UpdateMitraVenueRequest) (domain.MitraVenueDTO, error) {
	if !isValidUUID(venueID) {
		return domain.MitraVenueDTO{}, domain.NewAppError(domain.ErrValidation, "INVALID_VENUE_ID", "Format venueId harus berupa UUID yang valid.", nil)
	}

	req.Nama = strings.TrimSpace(req.Nama)
	req.Alamat = strings.TrimSpace(req.Alamat)
	req.JamBuka = strings.TrimSpace(req.JamBuka)
	req.Deskripsi = strings.TrimSpace(req.Deskripsi)

	details := map[string]string{}
	if req.Nama == "" {
		details["nama"] = "Nama destinasi wajib diisi."
	}
	if req.Alamat == "" {
		details["alamat"] = "Alamat destinasi wajib diisi."
	}
	if req.JamBuka == "" {
		details["jamBuka"] = "Jam buka wajib diisi."
	}
	if req.Deskripsi == "" {
		details["deskripsi"] = "Deskripsi destinasi wajib diisi."
	}
	if len(details) > 0 {
		return domain.MitraVenueDTO{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Data informasi destinasi tidak lengkap.", details)
	}

	cleanedFasilitas := make([]string, 0, len(req.Fasilitas))
	for _, f := range req.Fasilitas {
		if trimmed := strings.TrimSpace(f); trimmed != "" {
			cleanedFasilitas = append(cleanedFasilitas, trimmed)
		}
	}
	req.Fasilitas = cleanedFasilitas

	todayWIB := time.Now().In(wibZone).Format("2006-01-02")
	venue, err := s.repo.UpdateMitraVenue(ctx, ownerID, venueID, todayWIB, req)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.MitraVenueDTO{}, domain.NewAppError(domain.ErrNotFound, "VENUE_NOT_FOUND", "Destinasi tidak ditemukan.", nil)
	}
	return venue, err
}

func (s *OperationsService) CreateMitraTicket(ctx context.Context, ownerID string, req domain.CreateTicketRequest) (domain.TicketProduct, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	if req.VenueID == "" || len(req.Title) < 3 || req.Price < 0 || req.DailyQuota < 0 {
		return domain.TicketProduct{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Data produk tiket tidak valid.", nil)
	}
	return s.repo.CreateMitraTicket(ctx, ownerID, req)
}

func (s *OperationsService) UpdateMitraTicket(ctx context.Context, ownerID, ticketID string, req domain.UpdateTicketRequest) (domain.TicketProduct, error) {
	if req.Price != nil && *req.Price < 0 {
		return domain.TicketProduct{}, domain.NewAppError(domain.ErrValidation, "INVALID_PRICE", "Harga tiket tidak boleh negatif.", nil)
	}
	if req.DailyQuota != nil && *req.DailyQuota < 0 {
		return domain.TicketProduct{}, domain.NewAppError(domain.ErrValidation, "INVALID_QUOTA", "Kuota harian tidak boleh negatif.", nil)
	}
	tkt, err := s.repo.UpdateMitraTicket(ctx, ownerID, ticketID, req)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.TicketProduct{}, domain.NewAppError(domain.ErrNotFound, "TICKET_NOT_FOUND", "Tiket tidak ditemukan.", nil)
	}
	return tkt, err
}

func (s *OperationsService) ListMitraStaffs(ctx context.Context, ownerID string) ([]domain.MitraStaffDTO, error) {
	return s.repo.ListMitraStaffs(ctx, ownerID)
}

func (s *OperationsService) CreateMitraStaff(ctx context.Context, ownerID string, req domain.CreateStaffRequest) (domain.MitraStaffDTO, error) {
	name := strings.TrimSpace(req.Name)
	pin := strings.TrimSpace(req.Pin)
	if req.VenueID == "" || len(name) < 2 || len(pin) != 6 || !isAllDigits(pin) {
		return domain.MitraStaffDTO{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Nama staf dan PIN 6 digit angka wajib diisi.", nil)
	}
	pinHash, err := bcrypt.GenerateFromPassword([]byte(pin), bcryptCost)
	if err != nil {
		return domain.MitraStaffDTO{}, fmt.Errorf("hash staff pin: %w", err)
	}
	return s.repo.CreateMitraStaff(ctx, ownerID, req.VenueID, name, string(pinHash))
}

func (s *OperationsService) UpdateMitraStaff(ctx context.Context, ownerID, staffID string, req domain.UpdateStaffRequest) (domain.MitraStaffDTO, error) {
	var pinHashPtr *string
	if req.Pin != nil {
		pin := strings.TrimSpace(*req.Pin)
		if len(pin) != 6 || !isAllDigits(pin) {
			return domain.MitraStaffDTO{}, domain.NewAppError(domain.ErrValidation, "INVALID_PIN", "PIN staf harus terdiri dari 6 digit angka.", nil)
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(pin), bcryptCost)
		if err != nil {
			return domain.MitraStaffDTO{}, fmt.Errorf("hash staff pin: %w", err)
		}
		sHash := string(hashed)
		pinHashPtr = &sHash
	}

	staff, err := s.repo.UpdateMitraStaff(ctx, ownerID, staffID, pinHashPtr, req.IsActive)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.MitraStaffDTO{}, domain.NewAppError(domain.ErrNotFound, "STAFF_NOT_FOUND", "Akun staf tidak ditemukan.", nil)
	}
	return staff, err
}

func (s *OperationsService) GetMitraFinance(ctx context.Context, ownerID string) (domain.MitraFinanceSummary, error) {
	return s.repo.GetMitraFinance(ctx, ownerID)
}

func (s *OperationsService) RequestPayout(ctx context.Context, ownerID string, req domain.CreatePayoutRequest) (domain.PayoutDTO, error) {
	if req.Amount < domain.MinPayoutAmount {
		return domain.PayoutDTO{}, domain.NewAppError(domain.ErrValidation, "MIN_PAYOUT_AMOUNT", fmt.Sprintf("Minimal penarikan dana adalah Rp %d.", domain.MinPayoutAmount), nil)
	}
	return s.repo.CreatePayoutTx(ctx, ownerID, req.Amount, domain.PayoutAdminFee)
}

// EncryptAES256GCM encrypts sensitive KYB fields (NIK/NPWP) using AES-256-GCM.
func EncryptAES256GCM(key []byte, plaintext string) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// DecryptAES256GCM decrypts AES-256-GCM encoded KYB fields.
func DecryptAES256GCM(key []byte, encoded string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
