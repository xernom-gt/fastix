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

// OperationsRepository defines persistence for gate redemption, escrow H+1, and mitra operations.
type OperationsRepository interface {
	ListTodayGateTickets(ctx context.Context, venueID, todayDate string) ([]domain.ETicketDTO, error)
	RedeemTicketTx(ctx context.Context, ticketCode, venueID, staffID, todayDate string, redeemedAt time.Time) (domain.GateRedeemResult, error)
	ReleaseEscrowHPlusOne(ctx context.Context, todayDate string) (int64, error)

	UpsertKYB(ctx context.Context, userID, encKTP, encNPWP string, req domain.SubmitKYBRequest) (domain.KYBSubmissionResponse, error)
	ListMitraVenues(ctx context.Context, ownerID, todayDate string) ([]domain.MitraVenueDTO, error)
	CreateMitraTicket(ctx context.Context, ownerID string, req domain.CreateTicketRequest) (domain.TicketProduct, error)
	UpdateMitraTicket(ctx context.Context, ownerID, ticketID string, req domain.UpdateTicketRequest) (domain.TicketProduct, error)
	ListMitraStaffs(ctx context.Context, ownerID string) ([]domain.MitraStaffDTO, error)
	CreateMitraStaff(ctx context.Context, ownerID, venueID, name, pinHash string) (domain.MitraStaffDTO, error)
	UpdateMitraStaff(ctx context.Context, ownerID, staffID string, pinHash *string, isActive *bool) (domain.MitraStaffDTO, error)
	GetMitraFinance(ctx context.Context, ownerID string) (domain.MitraFinanceSummary, error)
	CreatePayoutTx(ctx context.Context, ownerID string, amount, adminFee int64) (domain.PayoutDTO, error)
}

// PgxOperationsRepository implements OperationsRepository using pgxpool.
type PgxOperationsRepository struct {
	pool *pgxpool.Pool
}

// NewPgxOperationsRepository creates a PostgreSQL-backed OperationsRepository.
func NewPgxOperationsRepository(pool *pgxpool.Pool) *PgxOperationsRepository {
	return &PgxOperationsRepository{pool: pool}
}

func (r *PgxOperationsRepository) ListTodayGateTickets(ctx context.Context, venueID, todayDate string) ([]domain.ETicketDTO, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			r.id::text, r.ticket_code, tr.invoice_number, v.id::text, v.venue_code, v.name, v.address,
			t.title, ti.booking_date, r.signature_hash, r.status::text, u.full_name, tr.paid_at, r.redeemed_at
		FROM redemptions r
		JOIN transaction_items ti ON ti.id = r.transaction_item_id
		JOIN transactions tr ON tr.id = ti.transaction_id
		JOIN tickets t ON t.id = ti.ticket_id
		JOIN venues v ON v.id = tr.venue_id
		JOIN users u ON u.id = tr.customer_id
		WHERE tr.venue_id = $1::uuid
		  AND ti.booking_date = $2::date
		  AND r.status IN ('VALID', 'REDEEMED')
		ORDER BY r.status ASC, r.ticket_code ASC
	`, venueID, todayDate)
	if err != nil {
		return nil, fmt.Errorf("list today gate tickets: %w", err)
	}
	defer rows.Close()

	return scanETickets(rows)
}

func (r *PgxOperationsRepository) RedeemTicketTx(ctx context.Context, ticketCode, venueID, staffID, todayDate string, redeemedAt time.Time) (domain.GateRedeemResult, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.GateRedeemResult{}, fmt.Errorf("begin redeem tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		redemptionID string
		status       string
		prevRedeemed *time.Time
		bookingDate  time.Time
		unitPrice    int64
		txVenueID    string
		ownerID      string
		txID         string
		ticketName   string
		holderName   string
	)

	err = tx.QueryRow(ctx, `
		SELECT
			r.id::text, r.status::text, r.redeemed_at, ti.booking_date, ti.unit_price::bigint,
			v.id::text, v.owner_id::text, tr.id::text, t.title, u.full_name
		FROM redemptions r
		JOIN transaction_items ti ON ti.id = r.transaction_item_id
		JOIN transactions tr ON tr.id = ti.transaction_id
		JOIN tickets t ON t.id = ti.ticket_id
		JOIN venues v ON v.id = tr.venue_id
		JOIN users u ON u.id = tr.customer_id
		WHERE r.ticket_code = $1
		FOR UPDATE OF r
	`, ticketCode).Scan(
		&redemptionID,
		&status,
		&prevRedeemed,
		&bookingDate,
		&unitPrice,
		&txVenueID,
		&ownerID,
		&txID,
		&ticketName,
		&holderName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrNotFound, "TICKET_NOT_FOUND", "Kode tiket tidak ditemukan.", nil)
	}
	if err != nil {
		return domain.GateRedeemResult{}, fmt.Errorf("lock redemption: %w", err)
	}

	if venueID != "" && txVenueID != venueID {
		return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrForbidden, "WRONG_VENUE", "Tiket ini bukan untuk destinasi Anda.", nil)
	}

	wib := time.FixedZone("WIB", 7*3600)
	if status == domain.RedemptionStatusRedeemed {
		details := map[string]string{}
		if prevRedeemed != nil {
			details["redeemedAt"] = prevRedeemed.In(wib).Format(time.RFC3339)
		}
		return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrConflict, "ALREADY_REDEEMED", "Tiket sudah pernah dipindai sebelumnya.", details)
	}
	if status != domain.RedemptionStatusValid {
		return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrConflict, "TICKET_NOT_VALID", "Tiket sudah kedaluwarsa atau telah di-refund.", nil)
	}
	if bookingDate.Format("2006-01-02") != todayDate {
		return domain.GateRedeemResult{}, domain.NewAppError(domain.ErrConflict, "WRONG_BOOKING_DATE", "Tiket tidak berlaku untuk tanggal hari ini.", map[string]string{"bookingDate": bookingDate.Format("2006-01-02")})
	}

	var staffArg any
	if staffID != "" {
		staffArg = staffID
	}

	if _, err := tx.Exec(ctx, `
		UPDATE redemptions
		SET status = 'REDEEMED', redeemed_at = $2, redeemed_by_staff_id = $3::uuid
		WHERE id = $1::uuid
	`, redemptionID, redeemedAt, staffArg); err != nil {
		return domain.GateRedeemResult{}, fmt.Errorf("mark redemption redeemed: %w", err)
	}

	// Credit net ticket revenue into owner pending_balance only upon actual gate check-in.
	if _, err := tx.Exec(ctx, `
		INSERT INTO owner_balances (owner_id, pending_balance, available_balance, updated_at)
		VALUES ($1::uuid, $2, 0, NOW())
		ON CONFLICT (owner_id) DO UPDATE SET
			pending_balance = owner_balances.pending_balance + EXCLUDED.pending_balance,
			updated_at = NOW()
	`, ownerID, unitPrice); err != nil {
		return domain.GateRedeemResult{}, fmt.Errorf("credit owner pending balance: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO balance_mutations (owner_id, amount, type, reference_type, reference_id, description)
		VALUES ($1::uuid, $2, 'PAYIN_INFLOW', 'TRANSACTION', $3::uuid, $4)
	`, ownerID, unitPrice, txID, fmt.Sprintf("Check-in tiket %s (%s)", ticketCode, ticketName)); err != nil {
		return domain.GateRedeemResult{}, fmt.Errorf("insert payin mutation: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.GateRedeemResult{}, fmt.Errorf("commit redeem tx: %w", err)
	}

	return domain.GateRedeemResult{
		TicketCode: ticketCode,
		Status:     domain.RedemptionStatusRedeemed,
		TicketName: ticketName,
		HolderName: holderName,
		RedeemedAt: redeemedAt.In(wib).Format(time.RFC3339),
		Message:    "Tiket valid, silakan masuk.",
	}, nil
}

func (r *PgxOperationsRepository) ReleaseEscrowHPlusOne(ctx context.Context, todayDate string) (int64, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin escrow release tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	rows, err := tx.Query(ctx, `
		SELECT
			ti.id::text,
			tr.id::text,
			v.owner_id::text,
			ti.unit_price::bigint,
			COUNT(r.id)::int AS redeemed_count
		FROM transaction_items ti
		JOIN transactions tr ON tr.id = ti.transaction_id
		JOIN venues v ON v.id = tr.venue_id
		JOIN redemptions r ON r.transaction_item_id = ti.id AND r.status = 'REDEEMED'
		WHERE ti.is_released = FALSE
		  AND ti.booking_date < $1::date
		GROUP BY ti.id, tr.id, v.owner_id, ti.unit_price
		FOR UPDATE OF ti
	`, todayDate)
	if err != nil {
		return 0, fmt.Errorf("query releasable escrow items: %w", err)
	}

	type releaseRow struct {
		itemID        string
		txID          string
		ownerID       string
		unitPrice     int64
		redeemedCount int
	}
	var toRelease []releaseRow
	for rows.Next() {
		var row releaseRow
		if err := rows.Scan(&row.itemID, &row.txID, &row.ownerID, &row.unitPrice, &row.redeemedCount); err != nil {
			rows.Close()
			return 0, fmt.Errorf("scan release row: %w", err)
		}
		toRelease = append(toRelease, row)
	}
	rows.Close()

	var releasedCount int64
	for _, row := range toRelease {
		releaseAmount := row.unitPrice * int64(row.redeemedCount)
		if _, err := tx.Exec(ctx, `UPDATE transaction_items SET is_released = TRUE WHERE id = $1::uuid`, row.itemID); err != nil {
			return 0, fmt.Errorf("mark item released: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE owner_balances
			SET pending_balance = GREATEST(0, pending_balance - $2),
			    available_balance = available_balance + $2,
			    updated_at = NOW()
			WHERE owner_id = $1::uuid
		`, row.ownerID, releaseAmount); err != nil {
			return 0, fmt.Errorf("move pending to available: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO balance_mutations (owner_id, amount, type, reference_type, reference_id, description)
			VALUES ($1::uuid, $2, 'HOLDING_RELEASED', 'TRANSACTION', $3::uuid, 'Pencairan saldo H+1 pasca check-in')
		`, row.ownerID, releaseAmount, row.txID); err != nil {
			return 0, fmt.Errorf("insert release mutation: %w", err)
		}
		releasedCount++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit escrow release tx: %w", err)
	}
	return releasedCount, nil
}

func (r *PgxOperationsRepository) UpsertKYB(ctx context.Context, userID, encKTP, encNPWP string, req domain.SubmitKYBRequest) (domain.KYBSubmissionResponse, error) {
	var res domain.KYBSubmissionResponse
	err := r.pool.QueryRow(ctx, `
		INSERT INTO owner_legalities (
			user_id, ktp_number, ktp_photo_url, npwp_number, npwp_photo_url,
			nib_number, bank_code, bank_account_number, bank_account_name,
			verification_status, updated_at
		)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			ktp_number = EXCLUDED.ktp_number,
			ktp_photo_url = EXCLUDED.ktp_photo_url,
			npwp_number = EXCLUDED.npwp_number,
			npwp_photo_url = EXCLUDED.npwp_photo_url,
			nib_number = EXCLUDED.nib_number,
			bank_code = EXCLUDED.bank_code,
			bank_account_number = EXCLUDED.bank_account_number,
			bank_account_name = EXCLUDED.bank_account_name,
			verification_status = 'PENDING',
			rejection_reason = NULL,
			updated_at = NOW()
		RETURNING id::text, verification_status::text
	`, userID, encKTP, req.KTPPhotoURL, encNPWP, req.NPWPPhotoURL, req.NIBNumber, req.BankCode, req.BankAccountNumber, req.BankAccountName).Scan(
		&res.ID,
		&res.VerificationStatus,
	)
	if err != nil {
		return domain.KYBSubmissionResponse{}, fmt.Errorf("upsert kyb: %w", err)
	}
	return res, nil
}

func (r *PgxOperationsRepository) ListMitraVenues(ctx context.Context, ownerID, todayDate string) ([]domain.MitraVenueDTO, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, venue_code, name, kota_kode, is_published
		FROM venues
		WHERE owner_id = $1::uuid
		ORDER BY created_at ASC
	`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("list mitra venues: %w", err)
	}

	venues := make([]domain.MitraVenueDTO, 0)
	for rows.Next() {
		var v domain.MitraVenueDTO
		if err := rows.Scan(&v.ID, &v.VenueCode, &v.Nama, &v.KotaKode, &v.IsPublished); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan mitra venue: %w", err)
		}
		v.Tickets = []domain.TicketProduct{}
		venues = append(venues, v)
	}
	rows.Close()

	for i := range venues {
		tRows, err := r.pool.Query(ctx, `
			SELECT
				t.id::text, t.venue_id::text, t.title, t.description, t.price::bigint, t.daily_quota,
				COALESCE(SUM(CASE WHEN tr.payment_status = 'PAID' THEN ti.quantity ELSE 0 END), 0)::int,
				COALESCE(SUM(CASE WHEN tr.payment_status = 'PENDING' AND tr.expired_at > NOW() THEN ti.quantity ELSE 0 END), 0)::int
			FROM tickets t
			LEFT JOIN transaction_items ti ON ti.ticket_id = t.id AND ti.booking_date = $2::date
			LEFT JOIN transactions tr ON tr.id = ti.transaction_id
			WHERE t.venue_id = $1::uuid
			GROUP BY t.id
			ORDER BY t.created_at ASC
		`, venues[i].ID, todayDate)
		if err != nil {
			return nil, fmt.Errorf("list mitra tickets: %w", err)
		}
		for tRows.Next() {
			var tkt domain.TicketProduct
			if err := tRows.Scan(&tkt.ID, &tkt.VenueID, &tkt.Title, &tkt.Description, &tkt.Price, &tkt.DailyQuota, &tkt.UsedQuotaPaid, &tkt.UsedQuotaPending); err != nil {
				tRows.Close()
				return nil, fmt.Errorf("scan mitra ticket: %w", err)
			}
			venues[i].Tickets = append(venues[i].Tickets, tkt)
		}
		tRows.Close()
	}

	return venues, nil
}

func (r *PgxOperationsRepository) CreateMitraTicket(ctx context.Context, ownerID string, req domain.CreateTicketRequest) (domain.TicketProduct, error) {
	var owns bool
	if err := r.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM venues WHERE id = $1::uuid AND owner_id = $2::uuid)`, req.VenueID, ownerID).Scan(&owns); err != nil {
		return domain.TicketProduct{}, fmt.Errorf("verify venue ownership: %w", err)
	}
	if !owns {
		return domain.TicketProduct{}, domain.NewAppError(domain.ErrForbidden, "NOT_VENUE_OWNER", "Anda tidak memiliki akses ke destinasi ini.", nil)
	}

	var tkt domain.TicketProduct
	err := r.pool.QueryRow(ctx, `
		INSERT INTO tickets (venue_id, title, description, price, daily_quota)
		VALUES ($1::uuid, $2, $3, $4, $5)
		RETURNING id::text, venue_id::text, title, description, price::bigint, daily_quota
	`, req.VenueID, req.Title, req.Description, req.Price, req.DailyQuota).Scan(
		&tkt.ID, &tkt.VenueID, &tkt.Title, &tkt.Description, &tkt.Price, &tkt.DailyQuota,
	)
	if err != nil {
		return domain.TicketProduct{}, fmt.Errorf("insert mitra ticket: %w", err)
	}
	return tkt, nil
}

func (r *PgxOperationsRepository) UpdateMitraTicket(ctx context.Context, ownerID, ticketID string, req domain.UpdateTicketRequest) (domain.TicketProduct, error) {
	var tkt domain.TicketProduct
	err := r.pool.QueryRow(ctx, `
		UPDATE tickets t
		SET
			title = COALESCE($3, t.title),
			description = COALESCE($4, t.description),
			price = COALESCE($5, t.price),
			daily_quota = COALESCE($6, t.daily_quota),
			is_active = COALESCE($7, t.is_active)
		FROM venues v
		WHERE t.id = $1::uuid AND t.venue_id = v.id AND v.owner_id = $2::uuid
		RETURNING t.id::text, t.venue_id::text, t.title, t.description, t.price::bigint, t.daily_quota
	`, ticketID, ownerID, req.Title, req.Description, req.Price, req.DailyQuota, req.IsActive).Scan(
		&tkt.ID, &tkt.VenueID, &tkt.Title, &tkt.Description, &tkt.Price, &tkt.DailyQuota,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.TicketProduct{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.TicketProduct{}, fmt.Errorf("update mitra ticket: %w", err)
	}
	return tkt, nil
}

func (r *PgxOperationsRepository) ListMitraStaffs(ctx context.Context, ownerID string) ([]domain.MitraStaffDTO, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.id::text, s.venue_id::text, v.venue_code, s.staff_name, s.is_active, s.created_at
		FROM staffs s
		JOIN venues v ON v.id = s.venue_id
		WHERE v.owner_id = $1::uuid
		ORDER BY s.created_at DESC
	`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("list mitra staffs: %w", err)
	}
	defer rows.Close()

	wib := time.FixedZone("WIB", 7*3600)
	list := make([]domain.MitraStaffDTO, 0)
	for rows.Next() {
		var s domain.MitraStaffDTO
		var createdAt time.Time
		if err := rows.Scan(&s.ID, &s.VenueID, &s.VenueCode, &s.Name, &s.IsActive, &createdAt); err != nil {
			return nil, fmt.Errorf("scan mitra staff: %w", err)
		}
		s.CreatedAt = createdAt.In(wib).Format(time.RFC3339)
		list = append(list, s)
	}
	return list, rows.Err()
}

func (r *PgxOperationsRepository) CreateMitraStaff(ctx context.Context, ownerID, venueID, name, pinHash string) (domain.MitraStaffDTO, error) {
	var venueCode string
	err := r.pool.QueryRow(ctx, `SELECT venue_code FROM venues WHERE id = $1::uuid AND owner_id = $2::uuid`, venueID, ownerID).Scan(&venueCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.MitraStaffDTO{}, domain.NewAppError(domain.ErrForbidden, "NOT_VENUE_OWNER", "Anda tidak memiliki akses ke destinasi ini.", nil)
	}
	if err != nil {
		return domain.MitraStaffDTO{}, fmt.Errorf("verify staff venue ownership: %w", err)
	}

	var s domain.MitraStaffDTO
	var createdAt time.Time
	err = r.pool.QueryRow(ctx, `
		INSERT INTO staffs (venue_id, staff_name, pin_hash)
		VALUES ($1::uuid, $2, $3)
		RETURNING id::text, venue_id::text, staff_name, is_active, created_at
	`, venueID, name, pinHash).Scan(&s.ID, &s.VenueID, &s.Name, &s.IsActive, &createdAt)
	if err != nil {
		return domain.MitraStaffDTO{}, fmt.Errorf("insert mitra staff: %w", err)
	}
	s.VenueCode = venueCode
	s.CreatedAt = createdAt.In(time.FixedZone("WIB", 7*3600)).Format(time.RFC3339)
	return s, nil
}

func (r *PgxOperationsRepository) UpdateMitraStaff(ctx context.Context, ownerID, staffID string, pinHash *string, isActive *bool) (domain.MitraStaffDTO, error) {
	var s domain.MitraStaffDTO
	var createdAt time.Time
	err := r.pool.QueryRow(ctx, `
		UPDATE staffs s
		SET
			pin_hash = COALESCE($3, s.pin_hash),
			is_active = COALESCE($4, s.is_active)
		FROM venues v
		WHERE s.id = $1::uuid AND s.venue_id = v.id AND v.owner_id = $2::uuid
		RETURNING s.id::text, s.venue_id::text, v.venue_code, s.staff_name, s.is_active, s.created_at
	`, staffID, ownerID, pinHash, isActive).Scan(&s.ID, &s.VenueID, &s.VenueCode, &s.Name, &s.IsActive, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.MitraStaffDTO{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.MitraStaffDTO{}, fmt.Errorf("update mitra staff: %w", err)
	}
	s.CreatedAt = createdAt.In(time.FixedZone("WIB", 7*3600)).Format(time.RFC3339)
	return s, nil
}

func (r *PgxOperationsRepository) GetMitraFinance(ctx context.Context, ownerID string) (domain.MitraFinanceSummary, error) {
	summary := domain.MitraFinanceSummary{
		Mutations: []domain.BalanceMutationDTO{},
		Payouts:   []domain.PayoutDTO{},
	}

	_ = r.pool.QueryRow(ctx, `
		SELECT COALESCE(pending_balance, 0)::bigint, COALESCE(available_balance, 0)::bigint
		FROM owner_balances
		WHERE owner_id = $1::uuid
	`, ownerID).Scan(&summary.PendingBalance, &summary.AvailableBalance)

	if err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(ti.unit_price), 0)::bigint
		FROM redemptions r
		JOIN transaction_items ti ON ti.id = r.transaction_item_id
		JOIN transactions tr ON tr.id = ti.transaction_id
		JOIN venues v ON v.id = tr.venue_id
		WHERE v.owner_id = $1::uuid AND tr.payment_status = 'PAID' AND r.status = 'VALID'
	`, ownerID).Scan(&summary.HoldingPlatformBalance); err != nil {
		return summary, fmt.Errorf("query holding platform balance: %w", err)
	}

	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM redemptions r
		JOIN transaction_items ti ON ti.id = r.transaction_item_id
		JOIN transactions tr ON tr.id = ti.transaction_id
		JOIN venues v ON v.id = tr.venue_id
		WHERE v.owner_id = $1::uuid AND r.status = 'REFUNDED'
	`, ownerID).Scan(&summary.RefundedCount); err != nil {
		return summary, fmt.Errorf("query refunded count: %w", err)
	}

	wib := time.FixedZone("WIB", 7*3600)
	mRows, err := r.pool.Query(ctx, `
		SELECT id::text, amount::bigint, type::text, description, created_at
		FROM balance_mutations
		WHERE owner_id = $1::uuid
		ORDER BY created_at DESC
		LIMIT 50
	`, ownerID)
	if err != nil {
		return summary, fmt.Errorf("query balance mutations: %w", err)
	}
	for mRows.Next() {
		var m domain.BalanceMutationDTO
		var createdAt time.Time
		if err := mRows.Scan(&m.ID, &m.Amount, &m.Type, &m.Description, &createdAt); err != nil {
			mRows.Close()
			return summary, fmt.Errorf("scan balance mutation: %w", err)
		}
		m.CreatedAt = createdAt.In(wib).Format(time.RFC3339)
		summary.Mutations = append(summary.Mutations, m)
	}
	mRows.Close()

	pRows, err := r.pool.Query(ctx, `
		SELECT id::text, amount::bigint, admin_fee::bigint, bank_code, bank_account_number, bank_account_name, status::text, created_at, transferred_at
		FROM payouts
		WHERE owner_id = $1::uuid
		ORDER BY created_at DESC
		LIMIT 30
	`, ownerID)
	if err != nil {
		return summary, fmt.Errorf("query payouts: %w", err)
	}
	for pRows.Next() {
		var p domain.PayoutDTO
		var createdAt time.Time
		var transferredAt *time.Time
		if err := pRows.Scan(&p.ID, &p.Amount, &p.AdminFee, &p.BankCode, &p.BankAccountNumber, &p.BankAccountName, &p.Status, &createdAt, &transferredAt); err != nil {
			pRows.Close()
			return summary, fmt.Errorf("scan payout: %w", err)
		}
		p.NetAmount = p.Amount - p.AdminFee
		p.CreatedAt = createdAt.In(wib).Format(time.RFC3339)
		if transferredAt != nil {
			formatted := transferredAt.In(wib).Format(time.RFC3339)
			p.TransferredAt = &formatted
		}
		summary.Payouts = append(summary.Payouts, p)
	}
	pRows.Close()

	return summary, nil
}

func (r *PgxOperationsRepository) CreatePayoutTx(ctx context.Context, ownerID string, amount, adminFee int64) (domain.PayoutDTO, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.PayoutDTO{}, fmt.Errorf("begin payout tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var available int64
	err = tx.QueryRow(ctx, `
		SELECT available_balance::bigint
		FROM owner_balances
		WHERE owner_id = $1::uuid
		FOR UPDATE
	`, ownerID).Scan(&available)
	if errors.Is(err, pgx.ErrNoRows) || available < amount {
		return domain.PayoutDTO{}, domain.NewAppError(domain.ErrConflict, "INSUFFICIENT_BALANCE", "Saldo siap tarik tidak mencukupi.", nil)
	}
	if err != nil {
		return domain.PayoutDTO{}, fmt.Errorf("lock owner balance: %w", err)
	}

	var bankCode, bankAccount, bankName, kybStatus string
	err = tx.QueryRow(ctx, `
		SELECT bank_code, bank_account_number, bank_account_name, verification_status::text
		FROM owner_legalities
		WHERE user_id = $1::uuid
	`, ownerID).Scan(&bankCode, &bankAccount, &bankName, &kybStatus)
	if errors.Is(err, pgx.ErrNoRows) || kybStatus != "APPROVED" {
		return domain.PayoutDTO{}, domain.NewAppError(domain.ErrForbidden, "KYB_NOT_APPROVED", "Rekening bank belum terverifikasi KYB.", nil)
	}
	if err != nil {
		return domain.PayoutDTO{}, fmt.Errorf("fetch kyb bank account: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE owner_balances
		SET available_balance = available_balance - $2, updated_at = NOW()
		WHERE owner_id = $1::uuid
	`, ownerID, amount); err != nil {
		return domain.PayoutDTO{}, fmt.Errorf("deduct available balance: %w", err)
	}

	var payout domain.PayoutDTO
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO payouts (owner_id, amount, admin_fee, bank_code, bank_account_number, bank_account_name, status)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, 'PENDING')
		RETURNING id::text, amount::bigint, admin_fee::bigint, bank_code, bank_account_number, bank_account_name, status::text, created_at
	`, ownerID, amount, adminFee, bankCode, bankAccount, bankName).Scan(
		&payout.ID, &payout.Amount, &payout.AdminFee, &payout.BankCode, &payout.BankAccountNumber, &payout.BankAccountName, &payout.Status, &createdAt,
	)
	if err != nil {
		return domain.PayoutDTO{}, fmt.Errorf("insert payout: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO balance_mutations (owner_id, amount, type, reference_type, reference_id, description)
		VALUES ($1::uuid, $2, 'PAYOUT_WITHDRAW', 'PAYOUT', $3::uuid, $4)
	`, ownerID, -amount, payout.ID, fmt.Sprintf("Penarikan dana ke %s %s", bankCode, bankAccount)); err != nil {
		return domain.PayoutDTO{}, fmt.Errorf("insert payout mutation: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.PayoutDTO{}, fmt.Errorf("commit payout tx: %w", err)
	}

	payout.NetAmount = payout.Amount - payout.AdminFee
	payout.CreatedAt = createdAt.In(time.FixedZone("WIB", 7*3600)).Format(time.RFC3339)
	return payout, nil
}
