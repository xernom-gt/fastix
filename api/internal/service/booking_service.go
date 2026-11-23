package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"fastix/api/internal/domain"
	"fastix/api/internal/repository"
)

const (
	bookingLockTTL      = 15 * time.Minute
	autoRefundAfterDays = 7
)

// BookingService handles atomic bookings, QRIS settlement, e-tickets, and scheduled workers.
type BookingService struct {
	repo              repository.BookingRepository
	qrHMACSecret      string
	midtransServerKey string
	isDev             bool
}

// NewBookingService constructs a BookingService.
func NewBookingService(repo repository.BookingRepository, qrHMACSecret, midtransServerKey, appEnv string) *BookingService {
	return &BookingService{
		repo:              repo,
		qrHMACSecret:      qrHMACSecret,
		midtransServerKey: midtransServerKey,
		isDev:             strings.EqualFold(appEnv, "development"),
	}
}

func (s *BookingService) CreateBooking(ctx context.Context, customerID string, req domain.CreateBookingRequest) (domain.TransactionDTO, error) {
	venueID := strings.TrimSpace(req.VenueID)
	if venueID == "" || len(req.Items) == 0 {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrValidation, "VALIDATION_ERROR", "Destinasi, tanggal kunjungan, dan minimal 1 tiket wajib diisi.", nil)
	}
	if !isValidUUID(venueID) {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrValidation, "INVALID_VENUE_ID", "Format venueId harus berupa UUID yang valid.", nil)
	}

	bookingDate, err := time.Parse("2006-01-02", strings.TrimSpace(req.BookingDate))
	if err != nil {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrValidation, "INVALID_DATE", "Format bookingDate harus YYYY-MM-DD.", nil)
	}

	todayWIB := time.Now().In(wibZone).Format("2006-01-02")
	if req.BookingDate < todayWIB {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrValidation, "PAST_BOOKING_DATE", "Tanggal kunjungan tidak boleh di masa lalu.", nil)
	}

	qtyByTicket := make(map[string]int, len(req.Items))
	for _, item := range req.Items {
		ticketID := strings.TrimSpace(item.TicketID)
		if !isValidUUID(ticketID) {
			return domain.TransactionDTO{}, domain.NewAppError(domain.ErrValidation, "INVALID_TICKET_ID", "Format ticketId harus berupa UUID yang valid.", nil)
		}
		if item.Quantity <= 0 || item.Quantity > 50 {
			return domain.TransactionDTO{}, domain.NewAppError(domain.ErrValidation, "INVALID_QUANTITY", "Jumlah tiket harus antara 1 hingga 50 per item.", nil)
		}
		qtyByTicket[ticketID] += item.Quantity
	}

	sortedTicketIDs := make([]string, 0, len(qtyByTicket))
	for id := range qtyByTicket {
		sortedTicketIDs = append(sortedTicketIDs, id)
	}
	sort.Strings(sortedTicketIDs)

	invoiceNumber, err := generateInvoiceNumber(time.Now().In(wibZone))
	if err != nil {
		return domain.TransactionDTO{}, fmt.Errorf("generate invoice number: %w", err)
	}

	pending := domain.PendingTransactionCreate{
		CustomerID:    customerID,
		VenueID:       venueID,
		InvoiceNumber: invoiceNumber,
		BookingDate:   bookingDate,
		QRString:      fmt.Sprintf("FASTIX-QRIS-%s", invoiceNumber),
		ExpiredAt:     time.Now().UTC().Add(bookingLockTTL),
	}

	return s.repo.CreateBookingTx(ctx, pending, sortedTicketIDs, qtyByTicket)
}

func (s *BookingService) GetBooking(ctx context.Context, invoiceID, customerID string) (domain.TransactionDTO, error) {
	tx, err := s.repo.FindBookingByID(ctx, strings.TrimSpace(invoiceID), customerID)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrNotFound, "BOOKING_NOT_FOUND", "Transaksi tidak ditemukan.", nil)
	}
	if err != nil {
		return domain.TransactionDTO{}, err
	}
	return tx, nil
}

func (s *BookingService) HandleQRISWebhook(ctx context.Context, rawBody []byte, signatureHeader string, req domain.QRISWebhookRequest) (domain.TransactionDTO, error) {
	invoiceNumber := strings.TrimSpace(req.InvoiceNumber)
	if req.OrderID != "" {
		invoiceNumber = strings.TrimSpace(req.OrderID)
	}
	gatewayRef := strings.TrimSpace(req.PaymentGatewayRef)
	if req.TransactionID != "" {
		gatewayRef = strings.TrimSpace(req.TransactionID)
	}

	if s.midtransServerKey != "" {
		if !VerifyMidtransSignature(req.OrderID, req.StatusCode, req.GrossAmount, s.midtransServerKey, req.SignatureKey) {
			return domain.TransactionDTO{}, domain.NewAppError(domain.ErrUnauthorized, "INVALID_WEBHOOK_SIGNATURE", "Signature Midtrans tidak valid.", nil)
		}
		if !isMidtransSettled(req.TransactionStatus) && !strings.EqualFold(req.Status, domain.PaymentStatusPaid) {
			return domain.TransactionDTO{}, domain.NewAppError(domain.ErrValidation, "UNSUPPORTED_WEBHOOK_STATUS", "Status webhook tidak diproses.", nil)
		}
	} else {
		if !s.verifySignatureHex(rawBody, signatureHeader) {
			return domain.TransactionDTO{}, domain.NewAppError(domain.ErrUnauthorized, "INVALID_WEBHOOK_SIGNATURE", "Signature webhook tidak valid.", nil)
		}
		if !strings.EqualFold(req.Status, domain.PaymentStatusPaid) {
			return domain.TransactionDTO{}, domain.NewAppError(domain.ErrValidation, "UNSUPPORTED_WEBHOOK_STATUS", "Status webhook tidak diproses.", nil)
		}
	}

	txID, err := s.repo.FindBookingIDByInvoice(ctx, invoiceNumber)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrNotFound, "BOOKING_NOT_FOUND", "Invoice tidak ditemukan.", nil)
	}
	if err != nil {
		return domain.TransactionDTO{}, err
	}

	return s.settleTransaction(ctx, txID, gatewayRef)
}

func (s *BookingService) SimulatePay(ctx context.Context, invoiceID, customerID string) (domain.TransactionDTO, error) {
	if !s.isDev {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrForbidden, "DEV_ONLY", "Endpoint simulasi hanya tersedia pada mode development.", nil)
	}

	tx, err := s.repo.FindBookingByID(ctx, strings.TrimSpace(invoiceID), customerID)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.TransactionDTO{}, domain.NewAppError(domain.ErrNotFound, "BOOKING_NOT_FOUND", "Transaksi tidak ditemukan.", nil)
	}
	if err != nil {
		return domain.TransactionDTO{}, err
	}

	return s.settleTransaction(ctx, tx.ID, "SIM-QRIS-"+tx.InvoiceNumber)
}

func (s *BookingService) ListMyTickets(ctx context.Context, customerID string) ([]domain.ETicketDTO, error) {
	return s.repo.ListTicketsByCustomer(ctx, customerID)
}

func (s *BookingService) GetMyTicket(ctx context.Context, ticketCode, customerID string) (domain.ETicketDTO, error) {
	ticket, err := s.repo.FindTicketByCode(ctx, strings.TrimSpace(ticketCode), customerID)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.ETicketDTO{}, domain.NewAppError(domain.ErrNotFound, "TICKET_NOT_FOUND", "E-ticket tidak ditemukan.", nil)
	}
	if err != nil {
		return domain.ETicketDTO{}, err
	}
	return ticket, nil
}

func (s *BookingService) RunMaintenanceWorkers(ctx context.Context) (expiredCount, refundedCount int64, err error) {
	expiredCount, err = s.repo.ExpirePendingBookings(ctx)
	if err != nil {
		return 0, 0, err
	}

	cutoff := time.Now().In(wibZone).AddDate(0, 0, -autoRefundAfterDays).Format("2006-01-02")
	refundedCount, err = s.repo.RefundNoShowTickets(ctx, cutoff)
	if err != nil {
		return expiredCount, 0, err
	}
	return expiredCount, refundedCount, nil
}

func (s *BookingService) settleTransaction(ctx context.Context, txID, gatewayRef string) (domain.TransactionDTO, error) {
	return s.repo.SettlePaymentTx(ctx, txID, gatewayRef, func(itemID, venueID, bookingDate string) (domain.RedemptionCreate, error) {
		ticketCode, err := generateTicketCode()
		if err != nil {
			return domain.RedemptionCreate{}, err
		}
		sig := SignQRPayload(s.qrHMACSecret, ticketCode, venueID, bookingDate)
		return domain.RedemptionCreate{
			TransactionItemID: itemID,
			TicketCode:        ticketCode,
			SignatureHash:     sig,
		}, nil
	})
}

// CalculateBookingFee computes the 5% Fastix platform fee for a booking subtotal.
func CalculateBookingFee(subtotal int64) int64 {
	return (subtotal * 5) / 100
}

// SignQRPayload produces an HMAC-SHA256 signature for offline-verifiable QR tickets.
func SignQRPayload(secret, ticketCode, venueID, bookingDate string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%s|%s|%s", ticketCode, venueID, bookingDate)))
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyQRPayload validates a 4-part QR payload string against the HMAC-SHA256 secret.
func VerifyQRPayload(secret, qrPayload string) (ticketCode, venueID, bookingDate string, valid bool) {
	parts := strings.Split(strings.TrimSpace(qrPayload), "|")
	if len(parts) != 4 {
		return "", "", "", false
	}
	ticketCode, venueID, bookingDate, sigHex := parts[0], parts[1], parts[2], parts[3]
	expected := SignQRPayload(secret, ticketCode, venueID, bookingDate)

	gotBytes, errGot := hex.DecodeString(sigHex)
	expBytes, errExp := hex.DecodeString(expected)
	if errGot != nil || errExp != nil {
		return "", "", "", false
	}
	if !hmac.Equal(gotBytes, expBytes) {
		return "", "", "", false
	}
	return ticketCode, venueID, bookingDate, true
}

// VerifyMidtransSignature checks SHA512(order_id + status_code + gross_amount + serverKey).
func VerifyMidtransSignature(orderID, statusCode, grossAmount, serverKey, signatureKey string) bool {
	if orderID == "" || statusCode == "" || grossAmount == "" || serverKey == "" || signatureKey == "" {
		return false
	}
	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	gotBytes, err := hex.DecodeString(strings.ToLower(strings.TrimSpace(signatureKey)))
	if err != nil {
		return false
	}
	return hmac.Equal(gotBytes, sum[:])
}

func isMidtransSettled(txStatus string) bool {
	return strings.EqualFold(txStatus, "settlement") || strings.EqualFold(txStatus, "capture")
}

func (s *BookingService) verifySignatureHex(rawBody []byte, signatureHeader string) bool {
	gotBytes, err := hex.DecodeString(strings.TrimSpace(signatureHeader))
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(s.qrHMACSecret))
	mac.Write(rawBody)
	return hmac.Equal(gotBytes, mac.Sum(nil))
}

func generateInvoiceNumber(now time.Time) (string, error) {
	suffix, err := randomHexUpper(2)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("PWL/INV/%s/%s", now.Format("20060102"), suffix), nil
}

func generateTicketCode() (string, error) {
	suffix, err := randomHexUpper(4)
	if err != nil {
		return "", err
	}
	return "PWL-TIX-" + suffix, nil
}

func randomHexUpper(byteLen int) (string, error) {
	buf := make([]byte, byteLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return strings.ToUpper(hex.EncodeToString(buf)), nil
}

func isValidUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i := 0; i < 36; i++ {
		c := s[i]
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
