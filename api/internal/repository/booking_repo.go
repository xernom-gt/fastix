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

// BookingRepository defines atomic persistence for bookings, QRIS settlement, and e-tickets.
type BookingRepository interface {
	CreateBookingTx(ctx context.Context, input domain.PendingTransactionCreate, sortedTicketIDs []string, qtyByTicket map[string]int) (domain.TransactionDTO, error)
	FindBookingByID(ctx context.Context, transactionID, customerID string) (domain.TransactionDTO, error)
	FindBookingIDByInvoice(ctx context.Context, invoiceNumber string) (string, error)
	SettlePaymentTx(ctx context.Context, transactionID, gatewayRef string, buildRedemption func(itemID, venueID, bookingDate string) (domain.RedemptionCreate, error)) (domain.TransactionDTO, error)
	ListTicketsByCustomer(ctx context.Context, customerID string) ([]domain.ETicketDTO, error)
	FindTicketByCode(ctx context.Context, ticketCode, customerID string) (domain.ETicketDTO, error)
	ExpirePendingBookings(ctx context.Context) (int64, error)
	RefundNoShowTickets(ctx context.Context, cutoffDate string) (int64, error)
}

// PgxBookingRepository implements BookingRepository using pgxpool.
type PgxBookingRepository struct {
	pool *pgxpool.Pool
}

// NewPgxBookingRepository creates a PostgreSQL-backed BookingRepository.
func NewPgxBookingRepository(pool *pgxpool.Pool) *PgxBookingRepository {
	return &PgxBookingRepository{pool: pool}
}

func (r *PgxBookingRepository) CreateBookingTx(
	ctx context.Context,
	input domain.PendingTransactionCreate,
	sortedTicketIDs []string,
	qtyByTicket map[string]int,
) (domain.TransactionDTO, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("begin booking tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Lock ticket rows in deterministic UUID order to prevent deadlocks under concurrent checkouts.
	rows, err := tx.Query(ctx, `
		SELECT id::text, venue_id::text, title, price::bigint, daily_quota
		FROM tickets
		WHERE id = ANY($1::uuid[]) AND venue_id = $2::uuid AND is_active = TRUE
		ORDER BY id ASC
		FOR UPDATE
	`, sortedTicketIDs, input.VenueID)
	if err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("lock tickets: %w", err)
	}

	lockedByID := make(map[string]domain.LockedTicketQuota, len(sortedTicketIDs))
	for rows.Next() {
		var t domain.LockedTicketQuota
		if err := rows.Scan(&t.TicketID, &t.VenueID, &t.Title, &t.Price, &t.DailyQuota); err != nil {
			rows.Close()
			return domain.TransactionDTO{}, fmt.Errorf("scan locked ticket: %w", err)
		}
		lockedByID[t.TicketID] = t
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("iterate locked tickets: %w", err)
	}

	if len(lockedByID) != len(sortedTicketIDs) {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrNotFound, "TICKET_NOT_FOUND", "Satu atau lebih jenis tiket tidak ditemukan pada destinasi ini.", nil)
	}

	var subtotal int64
	itemsToInsert := make([]domain.PendingTransactionItemCreate, 0, len(sortedTicketIDs))

	for _, ticketID := range sortedTicketIDs {
		locked := lockedByID[ticketID]
		requestedQty := qtyByTicket[ticketID]

		var used int
		err := tx.QueryRow(ctx, `
			SELECT COALESCE(SUM(ti.quantity), 0)::int
			FROM transaction_items ti
			JOIN transactions tr ON tr.id = ti.transaction_id
			WHERE ti.ticket_id = $1::uuid
			  AND ti.booking_date = $2::date
			  AND (tr.payment_status = 'PAID' OR (tr.payment_status = 'PENDING' AND tr.expired_at > NOW()))
		`, ticketID, input.BookingDate).Scan(&used)
		if err != nil {
			return domain.TransactionDTO{}, fmt.Errorf("check ticket quota: %w", err)
		}

		if locked.DailyQuota-used < requestedQty {
			return domain.TransactionDTO{}, domain.NewAppError(
				domain.ErrConflict,
				"QUOTA_EXCEEDED",
				fmt.Sprintf("Kuota tiket '%s' pada tanggal yang dipilih tidak mencukupi.", locked.Title),
				nil,
			)
		}

		subtotal += locked.Price * int64(requestedQty)
		itemsToInsert = append(itemsToInsert, domain.PendingTransactionItemCreate{
			TicketID:  ticketID,
			Quantity:  requestedQty,
			UnitPrice: locked.Price,
		})
	}

	platformFee := calculatePlatformFee(subtotal)
	totalAmount := subtotal + platformFee

	var txID string
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO transactions (
			customer_id, venue_id, invoice_number, booking_date,
			total_amount, platform_fee, payment_status, qr_string, expired_at
		)
		VALUES ($1::uuid, $2::uuid, $3, $4::date, $5, $6, 'PENDING', $7, $8)
		RETURNING id::text, created_at
	`,
		input.CustomerID,
		input.VenueID,
		input.InvoiceNumber,
		input.BookingDate,
		totalAmount,
		platformFee,
		input.QRString,
		input.ExpiredAt,
	).Scan(&txID, &createdAt)
	if err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("insert transaction: %w", err)
	}

	for _, item := range itemsToInsert {
		if _, err := tx.Exec(ctx, `
			INSERT INTO transaction_items (transaction_id, ticket_id, booking_date, quantity, unit_price)
			VALUES ($1::uuid, $2::uuid, $3::date, $4, $5)
		`, txID, item.TicketID, input.BookingDate, item.Quantity, item.UnitPrice); err != nil {
			return domain.TransactionDTO{}, fmt.Errorf("insert transaction item: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("commit booking tx: %w", err)
	}

	return r.FindBookingByID(ctx, txID, input.CustomerID)
}

func (r *PgxBookingRepository) FindBookingByID(ctx context.Context, transactionID, customerID string) (domain.TransactionDTO, error) {
	var dto domain.TransactionDTO
	var bookingDate time.Time
	var expiredAt time.Time
	var createdAt time.Time
	var paidAt *time.Time

	query := `
		SELECT
			tr.id::text, tr.invoice_number, tr.venue_id::text, v.venue_code, v.name, v.address,
			tr.booking_date, tr.total_amount::bigint, tr.platform_fee::bigint,
			tr.payment_status::text, tr.qr_string, tr.expired_at, tr.paid_at, tr.created_at
		FROM transactions tr
		JOIN venues v ON v.id = tr.venue_id
		WHERE tr.id = $1::uuid
	`
	args := []any{transactionID}
	if customerID != "" {
		query += " AND tr.customer_id = $2::uuid"
		args = append(args, customerID)
	}

	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&dto.ID,
		&dto.InvoiceNumber,
		&dto.VenueID,
		&dto.VenueCode,
		&dto.VenueName,
		&dto.VenueAddress,
		&bookingDate,
		&dto.TotalAmount,
		&dto.PlatformFee,
		&dto.PaymentStatus,
		&dto.QRString,
		&expiredAt,
		&paidAt,
		&createdAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.TransactionDTO{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("find booking by id: %w", err)
	}

	wib := time.FixedZone("WIB", 7*3600)
	dto.BookingDate = bookingDate.Format("2006-01-02")
	dto.Subtotal = dto.TotalAmount - dto.PlatformFee
	dto.ExpiredAt = expiredAt.In(wib).Format(time.RFC3339)
	dto.CreatedAt = createdAt.In(wib).Format(time.RFC3339)
	if paidAt != nil {
		formatted := paidAt.In(wib).Format(time.RFC3339)
		dto.PaidAt = &formatted
	}

	rows, err := r.pool.Query(ctx, `
		SELECT ti.ticket_id::text, t.title, ti.booking_date, ti.quantity, ti.unit_price::bigint
		FROM transaction_items ti
		JOIN tickets t ON t.id = ti.ticket_id
		WHERE ti.transaction_id = $1::uuid
		ORDER BY t.title ASC
	`, transactionID)
	if err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("query booking items: %w", err)
	}
	defer rows.Close()

	dto.Items = make([]domain.TransactionItemDTO, 0)
	for rows.Next() {
		var item domain.TransactionItemDTO
		var itemDate time.Time
		if err := rows.Scan(&item.TicketID, &item.TicketTitle, &itemDate, &item.Quantity, &item.UnitPrice); err != nil {
			return domain.TransactionDTO{}, fmt.Errorf("scan booking item: %w", err)
		}
		item.BookingDate = itemDate.Format("2006-01-02")
		dto.Items = append(dto.Items, item)
	}

	return dto, rows.Err()
}

func (r *PgxBookingRepository) FindBookingIDByInvoice(ctx context.Context, invoiceNumber string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `SELECT id::text FROM transactions WHERE invoice_number = $1`, invoiceNumber).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("find booking by invoice: %w", err)
	}
	return id, nil
}

func (r *PgxBookingRepository) SettlePaymentTx(
	ctx context.Context,
	transactionID, gatewayRef string,
	buildRedemption func(itemID, venueID, bookingDate string) (domain.RedemptionCreate, error),
) (domain.TransactionDTO, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("begin settle tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var venueID string
	var bookingDate time.Time
	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT venue_id::text, booking_date, payment_status::text
		FROM transactions
		WHERE id = $1::uuid
		FOR UPDATE
	`, transactionID).Scan(&venueID, &bookingDate, &currentStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.TransactionDTO{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("lock transaction: %w", err)
	}

	if currentStatus == domain.PaymentStatusPaid {
		_ = tx.Rollback(ctx)
		return r.FindBookingByID(ctx, transactionID, "")
	}
	if currentStatus != domain.PaymentStatusPending {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrConflict, "INVALID_PAYMENT_STATE", "Transaksi sudah tidak dalam status menunggu pembayaran.", nil)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE transactions
		SET payment_status = 'PAID', paid_at = NOW(), payment_gateway_ref = $2
		WHERE id = $1::uuid
	`, transactionID, gatewayRef); err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("update transaction paid: %w", err)
	}

	rows, err := tx.Query(ctx, `
		SELECT id::text, quantity
		FROM transaction_items
		WHERE transaction_id = $1::uuid
	`, transactionID)
	if err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("query items for redemption: %w", err)
	}

	type itemCount struct {
		id  string
		qty int
	}
	var items []itemCount
	for rows.Next() {
		var ic itemCount
		if err := rows.Scan(&ic.id, &ic.qty); err != nil {
			rows.Close()
			return domain.TransactionDTO{}, fmt.Errorf("scan item for redemption: %w", err)
		}
		items = append(items, ic)
	}
	rows.Close()

	bookingDateStr := bookingDate.Format("2006-01-02")
	for _, item := range items {
		for i := 0; i < item.qty; i++ {
			redemption, err := buildRedemption(item.id, venueID, bookingDateStr)
			if err != nil {
				return domain.TransactionDTO{}, fmt.Errorf("build redemption: %w", err)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO redemptions (transaction_item_id, ticket_code, signature_hash, status)
				VALUES ($1::uuid, $2, $3, 'VALID')
			`, redemption.TransactionItemID, redemption.TicketCode, redemption.SignatureHash); err != nil {
				return domain.TransactionDTO{}, fmt.Errorf("insert redemption: %w", err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("commit settle tx: %w", err)
	}
	return r.FindBookingByID(ctx, transactionID, "")
}

func (r *PgxBookingRepository) ListTicketsByCustomer(ctx context.Context, customerID string) ([]domain.ETicketDTO, error) {
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
		WHERE tr.customer_id = $1::uuid
		ORDER BY tr.created_at DESC, r.ticket_code ASC
	`, customerID)
	if err != nil {
		return nil, fmt.Errorf("list customer tickets: %w", err)
	}
	defer rows.Close()

	return scanETickets(rows)
}

func (r *PgxBookingRepository) FindTicketByCode(ctx context.Context, ticketCode, customerID string) (domain.ETicketDTO, error) {
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
		WHERE r.ticket_code = $1 AND tr.customer_id = $2::uuid
	`, ticketCode, customerID)
	if err != nil {
		return domain.ETicketDTO{}, fmt.Errorf("find ticket by code: %w", err)
	}
	defer rows.Close()

	list, err := scanETickets(rows)
	if err != nil {
		return domain.ETicketDTO{}, err
	}
	if len(list) == 0 {
		return domain.ETicketDTO{}, domain.ErrNotFound
	}
	return list[0], nil
}

func (r *PgxBookingRepository) ExpirePendingBookings(ctx context.Context) (int64, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE transactions
		SET payment_status = 'EXPIRED'
		WHERE payment_status = 'PENDING' AND expired_at <= NOW()
	`)
	if err != nil {
		return 0, fmt.Errorf("expire pending bookings: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *PgxBookingRepository) RefundNoShowTickets(ctx context.Context, cutoffDate string) (int64, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin auto-refund tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE redemptions r
		SET status = 'REFUNDED'
		FROM transaction_items ti
		WHERE r.transaction_item_id = ti.id
		  AND r.status = 'VALID'
		  AND ti.booking_date <= $1::date
	`, cutoffDate)
	if err != nil {
		return 0, fmt.Errorf("refund overdue redemptions: %w", err)
	}

	if tag.RowsAffected() > 0 {
		if _, err := tx.Exec(ctx, `
			UPDATE transactions tr
			SET payment_status = 'REFUNDED'
			WHERE tr.payment_status = 'PAID'
			  AND NOT EXISTS (
				SELECT 1
				FROM transaction_items ti
				JOIN redemptions r ON r.transaction_item_id = ti.id
				WHERE ti.transaction_id = tr.id AND r.status <> 'REFUNDED'
			  )
		`); err != nil {
			return 0, fmt.Errorf("sync refunded transactions: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit auto-refund tx: %w", err)
	}
	return tag.RowsAffected(), nil
}

func scanETickets(rows pgx.Rows) ([]domain.ETicketDTO, error) {
	wib := time.FixedZone("WIB", 7*3600)
	tickets := make([]domain.ETicketDTO, 0)
	for rows.Next() {
		var dto domain.ETicketDTO
		var bookingDate time.Time
		var paidAt *time.Time
		var redeemedAt *time.Time

		if err := rows.Scan(
			&dto.ID,
			&dto.TicketCode,
			&dto.InvoiceNumber,
			&dto.VenueID,
			&dto.VenueCode,
			&dto.VenueName,
			&dto.VenueAddress,
			&dto.TicketTitle,
			&bookingDate,
			&dto.SignatureHash,
			&dto.Status,
			&dto.HolderName,
			&paidAt,
			&redeemedAt,
		); err != nil {
			return nil, fmt.Errorf("scan e-ticket: %w", err)
		}

		dto.BookingDate = bookingDate.Format("2006-01-02")
		dto.QRPayload = fmt.Sprintf("%s|%s|%s|%s", dto.TicketCode, dto.VenueID, dto.BookingDate, dto.SignatureHash)
		if paidAt != nil {
			dto.PaidAt = paidAt.In(wib).Format(time.RFC3339)
		}
		if redeemedAt != nil {
			formatted := redeemedAt.In(wib).Format(time.RFC3339)
			dto.RedeemedAt = &formatted
		}
		tickets = append(tickets, dto)
	}
	return tickets, rows.Err()
}

func calculatePlatformFee(subtotal int64) int64 {
	return (subtotal * 5) / 100
}
