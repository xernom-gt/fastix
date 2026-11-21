package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/mail"
	"strings"
	"time"
	"unicode"

	"fastix/api/internal/domain"
	"fastix/api/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	otpTTL       = 5 * time.Minute
	tokenTTL     = 24 * time.Hour
	bcryptCost   = bcrypt.DefaultCost
	minPassword  = 6
)

// AuthService handles registration OTP, credential login, profile updates, and gate PIN auth.
type AuthService struct {
	repo      repository.AuthRepository
	jwtSecret string
	isDev     bool
}

// NewAuthService constructs an AuthService.
func NewAuthService(repo repository.AuthRepository, jwtSecret string, appEnv string) *AuthService {
	return &AuthService{
		repo:      repo,
		jwtSecret: jwtSecret,
		isDev:     strings.EqualFold(appEnv, "development"),
	}
}

// Register validates registration input, hashes the password, and issues a 6-digit OTP.
func (s *AuthService) Register(ctx context.Context, req domain.RegisterRequest) (domain.RegisterResult, error) {
	fullName := strings.TrimSpace(req.FullName)
	phone := normalizePhone(req.PhoneNumber)
	email := strings.ToLower(strings.TrimSpace(req.Email))

	details := map[string]string{}
	if len(fullName) < 2 {
		details["fullName"] = "Nama lengkap minimal 2 karakter."
	}
	if len(phone) < 9 || len(phone) > 16 {
		details["phoneNumber"] = "Nomor HP tidak valid."
	}
	if _, err := mail.ParseAddress(email); err != nil || !strings.Contains(email, ".") {
		details["email"] = "Format email tidak valid."
	}
	if len(req.Password) < minPassword {
		details["password"] = "Kata sandi minimal 6 karakter."
	}
	if len(details) > 0 {
		return domain.RegisterResult{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Data registrasi tidak valid.", details)
	}

	exists, err := s.repo.ExistsVerifiedUser(ctx, email, phone)
	if err != nil {
		return domain.RegisterResult{}, err
	}
	if exists {
		return domain.RegisterResult{}, domain.NewAppError(domain.ErrConflict, "ACCOUNT_EXISTS", "Email atau nomor HP sudah terdaftar.", nil)
	}

	pwHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return domain.RegisterResult{}, fmt.Errorf("hash password: %w", err)
	}

	otpCode, err := generateSixDigitOTP()
	if err != nil {
		return domain.RegisterResult{}, fmt.Errorf("generate otp: %w", err)
	}

	otpRecord := domain.RegistrationOTP{
		Email:        email,
		PhoneNumber:  phone,
		FullName:     fullName,
		PasswordHash: string(pwHash),
		OTPCodeHash:  hashOTP(email, otpCode),
		ExpiresAt:    time.Now().UTC().Add(otpTTL),
	}
	if err := s.repo.CreateRegistrationOTP(ctx, otpRecord); err != nil {
		return domain.RegisterResult{}, err
	}

	slog.Info("registration otp issued", "email", email)

	res := domain.RegisterResult{
		Email:            email,
		ExpiresInSeconds: int(otpTTL.Seconds()),
	}
	if s.isDev {
		res.DevOTP = otpCode
	}
	return res, nil
}

// VerifyRegistrationOTP activates the tourist account and returns a signed JWT.
func (s *AuthService) VerifyRegistrationOTP(ctx context.Context, req domain.VerifyOTPRequest) (domain.AuthTokenResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	otpCode := strings.TrimSpace(req.OTPCode)

	if email == "" || len(otpCode) != 6 || !isAllDigits(otpCode) {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrValidation, "INVALID_OTP_FORMAT", "Email dan kode OTP 6 digit wajib diisi.", nil)
	}

	pending, err := s.repo.GetLatestPendingOTP(ctx, email)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrNotFound, "OTP_NOT_FOUND", "Permintaan OTP tidak ditemukan atau sudah digunakan.", nil)
	}
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	if time.Now().UTC().After(pending.ExpiresAt) {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrValidation, "OTP_EXPIRED", "Kode OTP telah kedaluwarsa. Silakan daftar ulang.", nil)
	}

	if hashOTP(email, otpCode) != pending.OTPCodeHash {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrUnauthorized, "INVALID_OTP", "Kode OTP tidak sesuai.", nil)
	}

	user, err := s.repo.ActivateUserFromOTP(ctx, pending.ID, pending)
	if errors.Is(err, domain.ErrConflict) {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrConflict, "OTP_ALREADY_USED", "Kode OTP sudah pernah digunakan.", nil)
	}
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	token, err := s.issueToken(user.ID, user.Role, "", "")
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	return domain.AuthTokenResponse{
		AccessToken: token,
		User:        toUserProfile(user),
	}, nil
}

// Login authenticates a registered user with email and password.
func (s *AuthService) Login(ctx context.Context, req domain.LoginRequest) (domain.AuthTokenResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || len(req.Password) < minPassword {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Email dan kata sandi minimal 6 karakter wajib diisi.", nil)
	}

	user, err := s.repo.FindUserByEmail(ctx, email)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrUnauthorized, "INVALID_CREDENTIALS", "Email atau kata sandi salah.", nil)
	}
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	if !user.IsVerified || user.PasswordHash == "" {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrUnauthorized, "ACCOUNT_NOT_VERIFIED", "Akun belum aktif atau belum memiliki kata sandi.", nil)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrUnauthorized, "INVALID_CREDENTIALS", "Email atau kata sandi salah.", nil)
	}

	token, err := s.issueToken(user.ID, user.Role, "", "")
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	return domain.AuthTokenResponse{
		AccessToken: token,
		User:        toUserProfile(user),
	}, nil
}

// GetProfile returns the current user's profile.
func (s *AuthService) GetProfile(ctx context.Context, userID string) (domain.UserProfile, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.UserProfile{}, domain.NewAppError(domain.ErrNotFound, "USER_NOT_FOUND", "Pengguna tidak ditemukan.", nil)
	}
	if err != nil {
		return domain.UserProfile{}, err
	}
	return toUserProfile(user), nil
}

// UpdateProfile updates the authenticated user's fullName.
func (s *AuthService) UpdateProfile(ctx context.Context, userID string, req domain.UpdateProfileRequest) (domain.UserProfile, error) {
	fullName := strings.TrimSpace(req.FullName)
	if len(fullName) < 2 || len(fullName) > 100 {
		return domain.UserProfile{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Nama lengkap harus antara 2 hingga 100 karakter.", nil)
	}

	user, err := s.repo.UpdateUserFullName(ctx, userID, fullName)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.UserProfile{}, domain.NewAppError(domain.ErrNotFound, "USER_NOT_FOUND", "Pengguna tidak ditemukan.", nil)
	}
	if err != nil {
		return domain.UserProfile{}, err
	}
	return toUserProfile(user), nil
}

// GateLogin authenticates gate staff using venueCode and a 6-digit PIN.
func (s *AuthService) GateLogin(ctx context.Context, req domain.GateLoginRequest) (domain.GateLoginResponse, error) {
	venueCode := strings.ToUpper(strings.TrimSpace(req.VenueCode))
	pin := strings.TrimSpace(req.Pin)

	if venueCode == "" || len(pin) != 6 || !isAllDigits(pin) {
		return domain.GateLoginResponse{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Kode destinasi dan PIN 6 digit wajib diisi.", nil)
	}

	staffs, err := s.repo.FindActiveStaffByVenueCode(ctx, venueCode)
	if err != nil {
		return domain.GateLoginResponse{}, err
	}

	for _, staff := range staffs {
		if bcrypt.CompareHashAndPassword([]byte(staff.PinHash), []byte(pin)) == nil {
			token, err := s.issueToken(staff.ID, domain.RoleGateStaff, staff.VenueID, staff.VenueCode)
			if err != nil {
				return domain.GateLoginResponse{}, err
			}
			return domain.GateLoginResponse{
				AccessToken: token,
				Staff: domain.GateStaffProfile{
					ID:        staff.ID,
					Name:      staff.Name,
					VenueID:   staff.VenueID,
					VenueCode: staff.VenueCode,
					VenueName: staff.VenueName,
					Role:      domain.RoleGateStaff,
				},
			}, nil
		}
	}

	return domain.GateLoginResponse{}, domain.NewAppError(domain.ErrUnauthorized, "INVALID_GATE_CREDENTIALS", "Kode destinasi atau PIN staf salah.", nil)
}

func (s *AuthService) issueToken(subjectID, role, venueID, venueCode string) (string, error) {
	now := time.Now().UTC()
	claims := domain.AuthClaims{
		SubjectID: subjectID,
		Role:      role,
		VenueID:   venueID,
		VenueCode: venueCode,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subjectID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", fmt.Errorf("sign jwt: %w", err)
	}
	return signed, nil
}

func toUserProfile(u domain.UserRecord) domain.UserProfile {
	return domain.UserProfile{
		ID:          u.ID,
		FullName:    u.FullName,
		PhoneNumber: u.PhoneNumber,
		Email:       u.Email,
		Role:        u.Role,
	}
}

func generateSixDigitOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashOTP(email, otpCode string) string {
	sum := sha256.Sum256([]byte(email + ":" + otpCode))
	return hex.EncodeToString(sum[:])
}

func normalizePhone(raw string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(raw) {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func isAllDigits(s string) bool {
	for _, r := range s {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return len(s) > 0
}
