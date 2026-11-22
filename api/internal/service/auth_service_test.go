package service

import (
	"context"
	"errors"
	"testing"

	"fastix/api/internal/domain"

	"golang.org/x/crypto/bcrypt"
)

type stubAuthRepo struct {
	usersByEmail  map[string]domain.UserRecord
	usersByID     map[string]domain.UserRecord
	otpsByEmail   map[string]domain.RegistrationOTP
	staffsByCode  map[string][]domain.GateStaffRecord
	ownedVenuesBy map[string][]string
}

func newStubAuthRepo() *stubAuthRepo {
	return &stubAuthRepo{
		usersByEmail:  map[string]domain.UserRecord{},
		usersByID:     map[string]domain.UserRecord{},
		otpsByEmail:   map[string]domain.RegistrationOTP{},
		staffsByCode:  map[string][]domain.GateStaffRecord{},
		ownedVenuesBy: map[string][]string{},
	}
}

func (r *stubAuthRepo) ExistsVerifiedUser(_ context.Context, email, phone string) (bool, error) {
	for _, u := range r.usersByEmail {
		if (u.Email == email || u.PhoneNumber == phone) && u.IsVerified {
			return true, nil
		}
	}
	return false, nil
}

func (r *stubAuthRepo) CreateRegistrationOTP(_ context.Context, otp domain.RegistrationOTP) error {
	otp.ID = "otp-1"
	r.otpsByEmail[otp.Email] = otp
	return nil
}

func (r *stubAuthRepo) GetLatestPendingOTP(_ context.Context, email string) (domain.RegistrationOTP, error) {
	otp, ok := r.otpsByEmail[email]
	if !ok || otp.VerifiedAt != nil {
		return domain.RegistrationOTP{}, domain.ErrNotFound
	}
	return otp, nil
}

func (r *stubAuthRepo) ActivateUserFromOTP(_ context.Context, _ string, otp domain.RegistrationOTP) (domain.UserRecord, error) {
	user := domain.UserRecord{
		ID:           "usr-1",
		FullName:     otp.FullName,
		PhoneNumber:  otp.PhoneNumber,
		Email:        otp.Email,
		PasswordHash: otp.PasswordHash,
		Role:         domain.RoleTourist,
		IsVerified:   true,
	}
	r.usersByEmail[user.Email] = user
	r.usersByID[user.ID] = user
	return user, nil
}

func (r *stubAuthRepo) FindUserByEmail(_ context.Context, email string) (domain.UserRecord, error) {
	u, ok := r.usersByEmail[email]
	if !ok {
		return domain.UserRecord{}, domain.ErrNotFound
	}
	return u, nil
}

func (r *stubAuthRepo) CreateGoogleUser(_ context.Context, email, fullName, placeholderPhone string) (domain.UserRecord, error) {
	u := domain.UserRecord{
		ID:          "usr-google-1",
		FullName:    fullName,
		PhoneNumber: placeholderPhone,
		Email:       email,
		Role:        domain.RoleTourist,
		IsVerified:  true,
	}
	r.usersByEmail[email] = u
	r.usersByID[u.ID] = u
	return u, nil
}

func (r *stubAuthRepo) FindOwnedVenueIDs(_ context.Context, ownerID string) ([]string, error) {
	return r.ownedVenuesBy[ownerID], nil
}

func (r *stubAuthRepo) FindUserByID(_ context.Context, userID string) (domain.UserRecord, error) {
	u, ok := r.usersByID[userID]
	if !ok {
		return domain.UserRecord{}, domain.ErrNotFound
	}
	return u, nil
}

func (r *stubAuthRepo) UpdateUserFullName(_ context.Context, userID, fullName string) (domain.UserRecord, error) {
	u, ok := r.usersByID[userID]
	if !ok {
		return domain.UserRecord{}, domain.ErrNotFound
	}
	u.FullName = fullName
	r.usersByID[userID] = u
	r.usersByEmail[u.Email] = u
	return u, nil
}

func (r *stubAuthRepo) FindActiveStaffByVenueCode(_ context.Context, venueCode string) ([]domain.GateStaffRecord, error) {
	return r.staffsByCode[venueCode], nil
}

func TestRegisterVerifyLoginUpdateProfile(t *testing.T) {
	repo := newStubAuthRepo()
	svc := NewAuthService(repo, "test-secret-key-123456", "development", "", nil)
	ctx := context.Background()

	regRes, err := svc.Register(ctx, domain.RegisterRequest{
		FullName:    "Raka Pratama",
		PhoneNumber: "081234567890",
		Email:       "raka@example.com",
		Password:    "rahasia123",
	})
	if err != nil {
		t.Fatalf("Register: %v", err)
	}
	if len(regRes.DevOTP) != 6 {
		t.Fatalf("expected 6-digit devOtp, got %q", regRes.DevOTP)
	}

	// Wrong OTP should return unauthorized
	if _, err := svc.VerifyRegistrationOTP(ctx, domain.VerifyOTPRequest{
		Email:   "raka@example.com",
		OTPCode: "000000",
	}); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized for wrong OTP, got %v", err)
	}

	// Valid OTP activates user and issues JWT
	verifyRes, err := svc.VerifyRegistrationOTP(ctx, domain.VerifyOTPRequest{
		Email:   "raka@example.com",
		OTPCode: regRes.DevOTP,
	})
	if err != nil {
		t.Fatalf("VerifyRegistrationOTP: %v", err)
	}
	if verifyRes.AccessToken == "" || verifyRes.User.Role != domain.RoleTourist {
		t.Fatalf("unexpected verify response: %+v", verifyRes)
	}

	// Login with valid credentials
	loginRes, err := svc.Login(ctx, domain.LoginRequest{
		Email:    "raka@example.com",
		Password: "rahasia123",
	})
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if loginRes.AccessToken == "" {
		t.Fatal("expected non-empty accessToken")
	}

	// Update profile fullName
	updated, err := svc.UpdateProfile(ctx, "usr-1", domain.UpdateProfileRequest{FullName: "Raka Aditya"})
	if err != nil {
		t.Fatalf("UpdateProfile: %v", err)
	}
	if updated.FullName != "Raka Aditya" {
		t.Fatalf("expected updated fullName, got %q", updated.FullName)
	}
}

func TestGateLogin(t *testing.T) {
	repo := newStubAuthRepo()
	pinHash, err := bcrypt.GenerateFromPassword([]byte("482910"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash pin: %v", err)
	}
	repo.staffsByCode["LOKA-0315"] = []domain.GateStaffRecord{
		{
			ID:        "stf-1",
			Name:      "Nadia Kusuma",
			PinHash:   string(pinHash),
			IsActive:  true,
			VenueID:   "v-prambanan",
			VenueCode: "LOKA-0315",
			VenueName: "Candi Prambanan",
		},
	}

	svc := NewAuthService(repo, "test-secret-key-123456", "production", "", nil)
	res, err := svc.GateLogin(context.Background(), domain.GateLoginRequest{
		VenueCode: "loka-0315",
		Pin:       "482910",
	})
	if err != nil {
		t.Fatalf("GateLogin: %v", err)
	}
	if res.AccessToken == "" || res.Staff.Role != domain.RoleGateStaff || res.Staff.VenueCode != "LOKA-0315" {
		t.Fatalf("unexpected gate login response: %+v", res)
	}

	if _, err := svc.GateLogin(context.Background(), domain.GateLoginRequest{
		VenueCode: "LOKA-0315",
		Pin:       "999999",
	}); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized for wrong PIN, got %v", err)
	}
}

type stubGoogleVerifier struct {
	claims domain.GoogleTokenClaims
	err    error
}

func (v *stubGoogleVerifier) VerifyIDToken(_ context.Context, _ string) (domain.GoogleTokenClaims, error) {
	return v.claims, v.err
}

func TestGoogleLoginValidationAndMitraVenues(t *testing.T) {
	const clientID = "1234567890-test.apps.googleusercontent.com"
	repo := newStubAuthRepo()
	ctx := context.Background()

	// Wrong aud -> 401
	wrongAudSvc := NewAuthService(repo, "test-secret-key-123456", "production", clientID, &stubGoogleVerifier{
		claims: domain.GoogleTokenClaims{
			Aud:           "other-client-id",
			Email:         "wisatawan@gmail.com",
			EmailVerified: "true",
			Name:          "Raka Pratama",
		},
	})
	if _, err := wrongAudSvc.GoogleLogin(ctx, domain.GoogleLoginRequest{IDToken: "tok-1"}); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized for aud mismatch, got %v", err)
	}

	// Unverified email -> 401
	unverifiedSvc := NewAuthService(repo, "test-secret-key-123456", "production", clientID, &stubGoogleVerifier{
		claims: domain.GoogleTokenClaims{
			Aud:           clientID,
			Email:         "wisatawan@gmail.com",
			EmailVerified: "false",
			Name:          "Raka Pratama",
		},
	})
	if _, err := unverifiedSvc.GoogleLogin(ctx, domain.GoogleLoginRequest{IDToken: "tok-2"}); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized for unverified email, got %v", err)
	}

	// Valid tourist token provisions a new TOURIST user
	touristSvc := NewAuthService(repo, "test-secret-key-123456", "production", clientID, &stubGoogleVerifier{
		claims: domain.GoogleTokenClaims{
			Aud:           clientID,
			Email:         "wisatawan@gmail.com",
			EmailVerified: "true",
			Name:          "Raka Pratama",
		},
	})
	touristRes, err := touristSvc.GoogleLogin(ctx, domain.GoogleLoginRequest{IDToken: "tok-3"})
	if err != nil {
		t.Fatalf("GoogleLogin tourist: %v", err)
	}
	if touristRes.AccessToken == "" || touristRes.User.Role != domain.RoleTourist || touristRes.User.FullName != "Raka Pratama" {
		t.Fatalf("unexpected tourist google login response: %+v", touristRes)
	}

	// Existing MITRA owner receives ownedVenueIds
	repo.usersByEmail["bagus@tirtagangga.id"] = domain.UserRecord{
		ID:         "owner-1",
		FullName:   "Bagus Mahendra",
		Email:      "bagus@tirtagangga.id",
		Role:       domain.RoleMitra,
		IsVerified: true,
	}
	repo.ownedVenuesBy["owner-1"] = []string{"v-tirta-gangga", "v-prambanan"}

	mitraSvc := NewAuthService(repo, "test-secret-key-123456", "production", clientID, &stubGoogleVerifier{
		claims: domain.GoogleTokenClaims{
			Aud:           clientID,
			Email:         "bagus@tirtagangga.id",
			EmailVerified: "true",
			Name:          "Bagus Mahendra",
		},
	})
	mitraRes, err := mitraSvc.GoogleLogin(ctx, domain.GoogleLoginRequest{IDToken: "tok-4"})
	if err != nil {
		t.Fatalf("GoogleLogin mitra: %v", err)
	}
	if mitraRes.User.Role != domain.RoleMitra || len(mitraRes.User.OwnedVenueIDs) != 2 {
		t.Fatalf("expected MITRA role with 2 ownedVenueIds, got %+v", mitraRes.User)
	}
}
