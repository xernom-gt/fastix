package domain

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	RoleTourist   = "TOURIST"
	RoleMitra     = "MITRA"
	RoleGateStaff = "GATE_STAFF"
	RoleAdminHQ   = "ADMIN_HQ"
)

// AuthClaims defines the JWT payload for tourists, owners, gate staff, and admins.
type AuthClaims struct {
	SubjectID string `json:"sub"`
	Role      string `json:"role"`
	VenueID   string `json:"venueId,omitempty"`
	VenueCode string `json:"venueCode,omitempty"`
	jwt.RegisteredClaims
}

// UserProfile represents the public user object returned by auth endpoints.
type UserProfile struct {
	ID            string   `json:"id"`
	FullName      string   `json:"fullName"`
	PhoneNumber   string   `json:"phoneNumber"`
	Email         string   `json:"email"`
	Role          string   `json:"role"`
	OwnedVenueIDs []string `json:"ownedVenueIds,omitempty"`
}

// GoogleLoginRequest is the input for POST /api/v1/auth/google.
type GoogleLoginRequest struct {
	IDToken string `json:"idToken"`
}

// GoogleTokenClaims represents verified claims from Google's tokeninfo endpoint.
type GoogleTokenClaims struct {
	Aud           string `json:"aud"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
}

// UserRecord holds persisted user fields including credentials.
type UserRecord struct {
	ID           string
	FullName     string
	PhoneNumber  string
	Email        string
	PasswordHash string
	Role         string
	IsVerified   bool
}

// RegistrationOTP stores a pending registration awaiting 6-digit OTP verification.
type RegistrationOTP struct {
	ID           string
	Email        string
	PhoneNumber  string
	FullName     string
	PasswordHash string
	OTPCodeHash  string
	ExpiresAt    time.Time
	VerifiedAt   *time.Time
}

// GateStaffProfile represents the authenticated gate staff summary.
type GateStaffProfile struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	VenueID   string `json:"venueId"`
	VenueCode string `json:"venueCode"`
	VenueName string `json:"venueName"`
	Role      string `json:"role"`
}

// GateStaffRecord holds persisted gate staff credentials joined with venue metadata.
type GateStaffRecord struct {
	ID        string
	Name      string
	PinHash   string
	IsActive  bool
	VenueID   string
	VenueCode string
	VenueName string
}

// RegisterRequest is the input for POST /api/v1/auth/register.
type RegisterRequest struct {
	FullName    string `json:"fullName"`
	PhoneNumber string `json:"phoneNumber"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

// RegisterResult is returned after issuing a registration OTP.
type RegisterResult struct {
	Email            string `json:"email"`
	ExpiresInSeconds int    `json:"expiresInSeconds"`
	DevOTP           string `json:"devOtp,omitempty"`
}

// VerifyOTPRequest is the input for POST /api/v1/auth/register/verify-otp.
type VerifyOTPRequest struct {
	Email   string `json:"email"`
	OTPCode string `json:"otpCode"`
}

// LoginRequest is the input for POST /api/v1/auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthTokenResponse is returned upon successful login or OTP verification.
type AuthTokenResponse struct {
	AccessToken string      `json:"accessToken"`
	User        UserProfile `json:"user"`
}

// UpdateProfileRequest is the input for PATCH /api/v1/auth/profile.
type UpdateProfileRequest struct {
	FullName string `json:"fullName"`
}

// GateLoginRequest is the input for POST /api/v1/gate/auth/login.
type GateLoginRequest struct {
	VenueCode string `json:"venueCode"`
	Pin       string `json:"pin"`
}

// GateLoginResponse is returned upon successful gate staff authentication.
type GateLoginResponse struct {
	AccessToken string           `json:"accessToken"`
	Staff       GateStaffProfile `json:"staff"`
}
