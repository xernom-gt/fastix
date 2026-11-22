package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"fastix/api/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuthRepository defines persistence operations for tourist auth, profiles, and gate staff.
type AuthRepository interface {
	ExistsVerifiedUser(ctx context.Context, email, phoneNumber string) (bool, error)
	CreateRegistrationOTP(ctx context.Context, otp domain.RegistrationOTP) error
	GetLatestPendingOTP(ctx context.Context, email string) (domain.RegistrationOTP, error)
	ActivateUserFromOTP(ctx context.Context, otpID string, otp domain.RegistrationOTP) (domain.UserRecord, error)
	FindUserByEmail(ctx context.Context, email string) (domain.UserRecord, error)
	CreateGoogleUser(ctx context.Context, email, fullName, placeholderPhone string) (domain.UserRecord, error)
	FindOwnedVenueIDs(ctx context.Context, ownerID string) ([]string, error)
	FindUserByID(ctx context.Context, userID string) (domain.UserRecord, error)
	UpdateUserFullName(ctx context.Context, userID, fullName string) (domain.UserRecord, error)
	FindActiveStaffByVenueCode(ctx context.Context, venueCode string) ([]domain.GateStaffRecord, error)
}

// PgxAuthRepository implements AuthRepository using pgxpool.
type PgxAuthRepository struct {
	pool *pgxpool.Pool
}

// NewPgxAuthRepository creates a PostgreSQL-backed AuthRepository.
func NewPgxAuthRepository(pool *pgxpool.Pool) *PgxAuthRepository {
	return &PgxAuthRepository{pool: pool}
}

func (r *PgxAuthRepository) ExistsVerifiedUser(ctx context.Context, email, phoneNumber string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM users
			WHERE (email = $1 OR phone_number = $2)
			  AND is_verified = TRUE
		)
	`, email, phoneNumber).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check existing user: %w", err)
	}
	return exists, nil
}

func (r *PgxAuthRepository) CreateRegistrationOTP(ctx context.Context, otp domain.RegistrationOTP) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO auth_otps (email, phone_number, full_name, password_hash, otp_code_hash, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, otp.Email, otp.PhoneNumber, otp.FullName, otp.PasswordHash, otp.OTPCodeHash, otp.ExpiresAt)
	if err != nil {
		return fmt.Errorf("insert registration otp: %w", err)
	}
	return nil
}

func (r *PgxAuthRepository) GetLatestPendingOTP(ctx context.Context, email string) (domain.RegistrationOTP, error) {
	var rec domain.RegistrationOTP
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, email, phone_number, full_name, password_hash, otp_code_hash, expires_at, verified_at
		FROM auth_otps
		WHERE email = $1 AND verified_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1
	`, email).Scan(
		&rec.ID,
		&rec.Email,
		&rec.PhoneNumber,
		&rec.FullName,
		&rec.PasswordHash,
		&rec.OTPCodeHash,
		&rec.ExpiresAt,
		&rec.VerifiedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RegistrationOTP{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.RegistrationOTP{}, fmt.Errorf("query pending otp: %w", err)
	}
	return rec, nil
}

func (r *PgxAuthRepository) ActivateUserFromOTP(ctx context.Context, otpID string, otp domain.RegistrationOTP) (domain.UserRecord, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.UserRecord{}, fmt.Errorf("begin activate user tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE auth_otps
		SET verified_at = $2
		WHERE id = $1::uuid AND verified_at IS NULL
	`, otpID, time.Now().UTC())
	if err != nil {
		return domain.UserRecord{}, fmt.Errorf("mark otp verified: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.UserRecord{}, domain.ErrConflict
	}

	var user domain.UserRecord
	err = tx.QueryRow(ctx, `
		INSERT INTO users (phone_number, full_name, email, password_hash, role, is_verified)
		VALUES ($1, $2, $3, $4, 'TOURIST', TRUE)
		ON CONFLICT (email) DO UPDATE SET
			phone_number = EXCLUDED.phone_number,
			full_name = EXCLUDED.full_name,
			password_hash = EXCLUDED.password_hash,
			is_verified = TRUE,
			updated_at = NOW()
		RETURNING id::text, full_name, phone_number, COALESCE(email, ''), COALESCE(password_hash, ''), role::text, is_verified
	`, otp.PhoneNumber, otp.FullName, otp.Email, otp.PasswordHash).Scan(
		&user.ID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsVerified,
	)
	if err != nil {
		return domain.UserRecord{}, fmt.Errorf("upsert verified user: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.UserRecord{}, fmt.Errorf("commit activate user tx: %w", err)
	}
	return user, nil
}

func (r *PgxAuthRepository) FindUserByEmail(ctx context.Context, email string) (domain.UserRecord, error) {
	var user domain.UserRecord
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, full_name, phone_number, COALESCE(email, ''), COALESCE(password_hash, ''), role::text, is_verified
		FROM users
		WHERE email = $1
	`, email).Scan(
		&user.ID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsVerified,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.UserRecord{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.UserRecord{}, fmt.Errorf("find user by email: %w", err)
	}
	return user, nil
}

func (r *PgxAuthRepository) CreateGoogleUser(ctx context.Context, email, fullName, placeholderPhone string) (domain.UserRecord, error) {
	var user domain.UserRecord
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users (phone_number, full_name, email, role, is_verified)
		VALUES ($1, $2, $3, 'TOURIST', TRUE)
		ON CONFLICT (email) DO UPDATE SET
			is_verified = TRUE,
			updated_at = NOW()
		RETURNING id::text, full_name, phone_number, COALESCE(email, ''), COALESCE(password_hash, ''), role::text, is_verified
	`, placeholderPhone, fullName, email).Scan(
		&user.ID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsVerified,
	)
	if err != nil {
		return domain.UserRecord{}, fmt.Errorf("upsert google user: %w", err)
	}
	return user, nil
}

func (r *PgxAuthRepository) FindOwnedVenueIDs(ctx context.Context, ownerID string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text
		FROM venues
		WHERE owner_id = $1::uuid
		ORDER BY created_at ASC
	`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("query owned venue ids: %w", err)
	}
	defer rows.Close()

	ids := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan owned venue id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *PgxAuthRepository) FindUserByID(ctx context.Context, userID string) (domain.UserRecord, error) {
	var user domain.UserRecord
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, full_name, phone_number, COALESCE(email, ''), COALESCE(password_hash, ''), role::text, is_verified
		FROM users
		WHERE id = $1::uuid
	`, userID).Scan(
		&user.ID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsVerified,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.UserRecord{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.UserRecord{}, fmt.Errorf("find user by id: %w", err)
	}
	return user, nil
}

func (r *PgxAuthRepository) UpdateUserFullName(ctx context.Context, userID, fullName string) (domain.UserRecord, error) {
	var user domain.UserRecord
	err := r.pool.QueryRow(ctx, `
		UPDATE users
		SET full_name = $2, updated_at = NOW()
		WHERE id = $1::uuid
		RETURNING id::text, full_name, phone_number, COALESCE(email, ''), COALESCE(password_hash, ''), role::text, is_verified
	`, userID, fullName).Scan(
		&user.ID,
		&user.FullName,
		&user.PhoneNumber,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsVerified,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.UserRecord{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.UserRecord{}, fmt.Errorf("update user full_name: %w", err)
	}
	return user, nil
}

func (r *PgxAuthRepository) FindActiveStaffByVenueCode(ctx context.Context, venueCode string) ([]domain.GateStaffRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.id::text, s.staff_name, s.pin_hash, s.is_active, v.id::text, v.venue_code, v.name
		FROM staffs s
		JOIN venues v ON v.id = s.venue_id
		WHERE v.venue_code = $1 AND s.is_active = TRUE
	`, venueCode)
	if err != nil {
		return nil, fmt.Errorf("query gate staffs: %w", err)
	}
	defer rows.Close()

	var staffs []domain.GateStaffRecord
	for rows.Next() {
		var rec domain.GateStaffRecord
		if err := rows.Scan(
			&rec.ID,
			&rec.Name,
			&rec.PinHash,
			&rec.IsActive,
			&rec.VenueID,
			&rec.VenueCode,
			&rec.VenueName,
		); err != nil {
			return nil, fmt.Errorf("scan gate staff: %w", err)
		}
		staffs = append(staffs, rec)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate gate staffs: %w", err)
	}
	return staffs, nil
}
