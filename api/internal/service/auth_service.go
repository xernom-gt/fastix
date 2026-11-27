package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"net/url"
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

// GoogleTokenVerifier verifies a Google OAuth ID token and returns its claims.
type GoogleTokenVerifier interface {
	VerifyIDToken(ctx context.Context, idToken string) (domain.GoogleTokenClaims, error)
}

// HTTPGoogleTokenVerifier calls Google's OAuth2 tokeninfo endpoint.
type HTTPGoogleTokenVerifier struct {
	client *http.Client
}

// NewHTTPGoogleTokenVerifier creates a GoogleTokenVerifier with a 5-second timeout.
func NewHTTPGoogleTokenVerifier() *HTTPGoogleTokenVerifier {
	return &HTTPGoogleTokenVerifier{
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

func (v *HTTPGoogleTokenVerifier) VerifyIDToken(ctx context.Context, idToken string) (domain.GoogleTokenClaims, error) {
	endpoint := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(idToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return domain.GoogleTokenClaims{}, fmt.Errorf("build google tokeninfo request: %w", err)
	}

	resp, err := v.client.Do(req)
	if err != nil {
		return domain.GoogleTokenClaims{}, fmt.Errorf("request google tokeninfo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return domain.GoogleTokenClaims{}, domain.ErrUnauthorized
	}

	var claims domain.GoogleTokenClaims
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		return domain.GoogleTokenClaims{}, domain.ErrUnauthorized
	}
	return claims, nil
}

// OTPEmailSender delivers registration verification OTP codes to users.
type OTPEmailSender interface {
	SendRegistrationOTP(ctx context.Context, toEmail, fullName, otpCode string) error
}

// SMTPOTPEmailSender sends OTP emails over SMTP (e.g., Gmail SMTP with STARTTLS on port 587).
type SMTPOTPEmailSender struct {
	host string
	port string
	user string
	pass string
	from string
}

// NewSMTPOTPEmailSender creates an SMTPOTPEmailSender and normalizes Google App Password whitespace.
func NewSMTPOTPEmailSender(host, port, user, pass, from string) *SMTPOTPEmailSender {
	return &SMTPOTPEmailSender{
		host: strings.TrimSpace(host),
		port: strings.TrimSpace(port),
		user: strings.TrimSpace(user),
		pass: strings.ReplaceAll(strings.TrimSpace(pass), " ", ""),
		from: strings.TrimSpace(from),
	}
}

// IsConfigured reports whether all required SMTP settings are present.
func (s *SMTPOTPEmailSender) IsConfigured() bool {
	return s.user != "" && s.pass != "" && s.host != "" && s.port != ""
}

// SendRegistrationOTP formats and sends a 6-digit registration OTP email via SMTP.
func (s *SMTPOTPEmailSender) SendRegistrationOTP(ctx context.Context, toEmail, fullName, otpCode string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if !s.IsConfigured() {
		return fmt.Errorf("smtp is not configured")
	}

	fromHeader := s.from
	if fromHeader == "" {
		fromHeader = s.user
	}
	fromAddr := s.user
	if parsed, err := mail.ParseAddress(fromHeader); err == nil && parsed.Address != "" {
		fromAddr = parsed.Address
	}

	recipientName := strings.TrimSpace(fullName)
	if recipientName == "" {
		recipientName = "Pengguna Fastix"
	}

	body := fmt.Sprintf(
		"Halo %s,\r\n\r\n"+
			"Kode verifikasi OTP pendaftaran Fastix Anda adalah: %s\r\n\r\n"+
			"Kode ini berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.\r\n\r\n"+
			"Terima kasih,\r\nTim Fastix",
		recipientName,
		otpCode,
	)

	msg := strings.Join([]string{
		"From: " + fromHeader,
		"To: " + toEmail,
		"Subject: Kode Verifikasi OTP Fastix",
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	auth := smtp.PlainAuth("", s.user, s.pass, s.host)
	addr := net.JoinHostPort(s.host, s.port)
	if err := smtp.SendMail(addr, auth, fromAddr, []string{toEmail}, []byte(msg)); err != nil {
		return fmt.Errorf("send otp email via smtp: %w", err)
	}
	return nil
}

// AuthService handles registration OTP, credential login, Google OAuth, profile updates, and gate PIN auth.
type AuthService struct {
	repo           repository.AuthRepository
	jwtSecret      string
	googleClientID string
	googleVerifier GoogleTokenVerifier
	emailSender    OTPEmailSender
	isDev          bool
}

// NewAuthService constructs an AuthService.
func NewAuthService(repo repository.AuthRepository, jwtSecret, appEnv, googleClientID string, verifier GoogleTokenVerifier) *AuthService {
	if verifier == nil {
		verifier = NewHTTPGoogleTokenVerifier()
	}
	return &AuthService{
		repo:           repo,
		jwtSecret:      jwtSecret,
		googleClientID: googleClientID,
		googleVerifier: verifier,
		isDev:          strings.EqualFold(appEnv, "development"),
	}
}

// WithEmailSender attaches an OTPEmailSender to the AuthService.
func (s *AuthService) WithEmailSender(sender OTPEmailSender) *AuthService {
	s.emailSender = sender
	return s
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

	if s.emailSender != nil {
		if err := s.emailSender.SendRegistrationOTP(ctx, email, fullName, otpCode); err != nil {
			if !s.isDev {
				slog.Error("failed to send registration otp email", "email", email, "error", err)
				return domain.RegisterResult{}, domain.NewAppError(nil, "EMAIL_SEND_FAILED", "Gagal mengirim kode OTP ke email. Silakan coba lagi.", nil)
			}
			slog.Warn("failed to send registration otp email in dev mode", "email", email, "error", err)
		}
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

	profile, err := s.enrichUserProfile(ctx, user)
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	return domain.AuthTokenResponse{
		AccessToken: token,
		User:        profile,
	}, nil
}

// GoogleLogin verifies a Google idToken and signs in or provisions the user account.
func (s *AuthService) GoogleLogin(ctx context.Context, req domain.GoogleLoginRequest) (domain.AuthTokenResponse, error) {
	idToken := strings.TrimSpace(req.IDToken)
	if idToken == "" {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "idToken Google wajib diisi.", nil)
	}
	if s.googleClientID == "" {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrUnauthorized, "GOOGLE_OAUTH_NOT_CONFIGURED", "Login Google belum dikonfigurasi di server.", nil)
	}

	claims, err := s.googleVerifier.VerifyIDToken(ctx, idToken)
	if err != nil {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrUnauthorized, "INVALID_GOOGLE_TOKEN", "Token Google tidak valid atau telah kedaluwarsa.", nil)
	}

	email := strings.ToLower(strings.TrimSpace(claims.Email))
	if claims.Aud != s.googleClientID || !strings.EqualFold(claims.EmailVerified, "true") || email == "" {
		return domain.AuthTokenResponse{}, domain.NewAppError(domain.ErrUnauthorized, "INVALID_GOOGLE_CLAIMS", "Klaim akun Google tidak valid atau email belum terverifikasi.", nil)
	}

	user, err := s.repo.FindUserByEmail(ctx, email)
	if errors.Is(err, domain.ErrNotFound) {
		fullName := strings.TrimSpace(claims.Name)
		if fullName == "" {
			fullName = strings.Split(email, "@")[0]
		}
		placeholderHex, hexErr := randomHexUpper(7)
		if hexErr != nil {
			return domain.AuthTokenResponse{}, fmt.Errorf("generate google placeholder phone: %w", hexErr)
		}
		user, err = s.repo.CreateGoogleUser(ctx, email, fullName, "g-"+placeholderHex)
	}
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	token, err := s.issueToken(user.ID, user.Role, "", "")
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	profile, err := s.enrichUserProfile(ctx, user)
	if err != nil {
		return domain.AuthTokenResponse{}, err
	}

	return domain.AuthTokenResponse{
		AccessToken: token,
		User:        profile,
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
	return s.enrichUserProfile(ctx, user)
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
	return s.enrichUserProfile(ctx, user)
}

func (s *AuthService) enrichUserProfile(ctx context.Context, user domain.UserRecord) (domain.UserProfile, error) {
	profile := toUserProfile(user)
	if user.Role == domain.RoleMitra {
		venueIDs, err := s.repo.FindOwnedVenueIDs(ctx, user.ID)
		if err != nil {
			return domain.UserProfile{}, err
		}
		profile.OwnedVenueIDs = venueIDs
	}
	return profile, nil
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
