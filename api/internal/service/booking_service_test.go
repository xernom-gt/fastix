package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"fastix/api/internal/domain"
)

type stubBookingRepo struct {
	createdInput domain.PendingTransactionCreate
	cutoffSeen   string
	snapToken    string
	snapURL      string
}

func (r *stubBookingRepo) CreateBookingTx(_ context.Context, input domain.PendingTransactionCreate, _ []string, _ map[string]int) (domain.TransactionDTO, error) {
	r.createdInput = input
	return domain.TransactionDTO{
		ID:            "tx-1",
		InvoiceNumber: input.InvoiceNumber,
		TotalAmount:   105000,
		PaymentStatus: domain.PaymentStatusPending,
	}, nil
}

func (r *stubBookingRepo) FindCustomerContact(_ context.Context, _ string) (domain.CustomerContact, error) {
	return domain.CustomerContact{
		FullName:    "Raka Pratama",
		Email:       "raka.pratama@gmail.com",
		PhoneNumber: "081234567890",
	}, nil
}

func (r *stubBookingRepo) UpdateTransactionSnap(_ context.Context, _, snapToken, snapRedirectURL string) error {
	r.snapToken = snapToken
	r.snapURL = snapRedirectURL
	return nil
}

func (r *stubBookingRepo) FindBookingByID(_ context.Context, transactionID, _ string) (domain.TransactionDTO, error) {
	return domain.TransactionDTO{ID: transactionID, PaymentStatus: domain.PaymentStatusPending}, nil
}

func (r *stubBookingRepo) FindBookingIDByInvoice(_ context.Context, _ string) (string, error) {
	return "tx-1", nil
}

func (r *stubBookingRepo) SettlePaymentTx(_ context.Context, transactionID, _ string, _ func(string, string, string) (domain.RedemptionCreate, error)) (domain.TransactionDTO, error) {
	return domain.TransactionDTO{ID: transactionID, PaymentStatus: domain.PaymentStatusPaid}, nil
}

func (r *stubBookingRepo) ListTicketsByCustomer(_ context.Context, _ string) ([]domain.ETicketDTO, error) {
	return []domain.ETicketDTO{}, nil
}

func (r *stubBookingRepo) FindTicketByCode(_ context.Context, _, _ string) (domain.ETicketDTO, error) {
	return domain.ETicketDTO{}, domain.ErrNotFound
}

func (r *stubBookingRepo) ExpirePendingBookings(_ context.Context) (int64, error) {
	return 2, nil
}

func (r *stubBookingRepo) RefundNoShowTickets(_ context.Context, cutoffDate string) (int64, error) {
	r.cutoffSeen = cutoffDate
	return 3, nil
}

func TestCalculateFeeAndHMAC(t *testing.T) {
	if fee := CalculateBookingFee(100000); fee != 5000 {
		t.Fatalf("expected 5000 fee, got %d", fee)
	}

	const secret = "qr-hmac-secret-key-123456"
	sig := SignQRPayload(secret, "PWL-TIX-ABCD1234", "v-borobudur", "2026-11-21")
	payload := "PWL-TIX-ABCD1234|v-borobudur|2026-11-21|" + sig

	code, venueID, bDate, ok := VerifyQRPayload(secret, payload)
	if !ok || code != "PWL-TIX-ABCD1234" || venueID != "v-borobudur" || bDate != "2026-11-21" {
		t.Fatalf("VerifyQRPayload failed: ok=%v code=%s venue=%s date=%s", ok, code, venueID, bDate)
	}

	if _, _, _, valid := VerifyQRPayload(secret, "PWL-TIX-ABCD1234|v-other|2026-11-21|"+sig); valid {
		t.Fatal("expected tampered venueId to fail HMAC verification")
	}
}

func TestBookingPastDateAndMaintenanceCutoff(t *testing.T) {
	repo := &stubBookingRepo{}
	svc := NewBookingService(repo, "qr-hmac-secret-key-123456", "", "development", nil)
	ctx := context.Background()

	// Invalid venueId UUID must fail validation (400)
	futureDate := time.Now().In(wibZone).AddDate(0, 0, 2).Format("2006-01-02")
	if _, err := svc.CreateBooking(ctx, "usr-1", domain.CreateBookingRequest{
		VenueID:     "not-a-uuid",
		BookingDate: futureDate,
		Items:       []domain.BookingItemInput{{TicketID: "11111111-1111-1111-1111-111111111111", Quantity: 1}},
	}); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected ErrValidation for invalid venueId UUID, got %v", err)
	}

	// Invalid ticketId UUID must fail validation (400)
	if _, err := svc.CreateBooking(ctx, "usr-1", domain.CreateBookingRequest{
		VenueID:     "11111111-1111-1111-1111-111111111111",
		BookingDate: futureDate,
		Items:       []domain.BookingItemInput{{TicketID: "t-1", Quantity: 1}},
	}); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected ErrValidation for invalid ticketId UUID, got %v", err)
	}

	// Past booking date must fail validation
	yesterday := time.Now().In(wibZone).AddDate(0, 0, -1).Format("2006-01-02")
	_, err := svc.CreateBooking(ctx, "usr-1", domain.CreateBookingRequest{
		VenueID:     "11111111-1111-1111-1111-111111111111",
		BookingDate: yesterday,
		Items:       []domain.BookingItemInput{{TicketID: "22222222-2222-2222-2222-222222222222", Quantity: 1}},
	})
	if !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected ErrValidation for past date, got %v", err)
	}

	// Maintenance worker passes 7-day WIB cutoff
	exp, ref, err := svc.RunMaintenanceWorkers(ctx)
	if err != nil {
		t.Fatalf("RunMaintenanceWorkers: %v", err)
	}
	if exp != 2 || ref != 3 {
		t.Fatalf("expected exp=2 ref=3, got %d %d", exp, ref)
	}
	expectedCutoff := time.Now().In(wibZone).AddDate(0, 0, -7).Format("2006-01-02")
	if repo.cutoffSeen != expectedCutoff {
		t.Fatalf("expected cutoff %s, got %s", expectedCutoff, repo.cutoffSeen)
	}

	// Webhook signature verification
	raw := []byte(`{"invoiceNumber":"PWL/INV/20261121/0001","status":"PAID"}`)
	mac := hmac.New(sha256.New, []byte("qr-hmac-secret-key-123456"))
	mac.Write(raw)
	validSig := hex.EncodeToString(mac.Sum(nil))
	if _, err := svc.HandleQRISWebhook(ctx, raw, validSig, domain.QRISWebhookRequest{
		InvoiceNumber: "PWL/INV/20261121/0001",
		Status:        "PAID",
	}); err != nil {
		t.Fatalf("HandleQRISWebhook valid sig: %v", err)
	}
}

func TestMidtransWebhookSignatureVerification(t *testing.T) {
	const serverKey = "SB-Mid-server-test-key"
	repo := &stubBookingRepo{}
	svc := NewBookingService(repo, "qr-hmac-secret-key-123456", serverKey, "production", nil)
	ctx := context.Background()

	orderID := "PWL/INV/20261121/0042"
	statusCode := "200"
	grossAmount := "105000.00"
	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	validSig := hex.EncodeToString(sum[:])

	tx, err := svc.HandleQRISWebhook(ctx, nil, "", domain.QRISWebhookRequest{
		OrderID:           orderID,
		StatusCode:        statusCode,
		GrossAmount:       grossAmount,
		SignatureKey:      validSig,
		TransactionStatus: "settlement",
		TransactionID:     "mid-tx-001",
	})
	if err != nil {
		t.Fatalf("expected valid Midtrans webhook to succeed, got %v", err)
	}
	if tx.PaymentStatus != domain.PaymentStatusPaid {
		t.Fatalf("expected PAID, got %s", tx.PaymentStatus)
	}

	// Tampered gross_amount must fail signature check
	if _, err := svc.HandleQRISWebhook(ctx, nil, "", domain.QRISWebhookRequest{
		OrderID:           orderID,
		StatusCode:        statusCode,
		GrossAmount:       "1000.00",
		SignatureKey:      validSig,
		TransactionStatus: "settlement",
	}); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized for tampered Midtrans webhook, got %v", err)
	}
}

func TestCreateBookingWithMidtransSnap(t *testing.T) {
	const serverKey = "SB-Mid-server-snap-test"
	var gotAuth string
	var gotOrderID string
	var gotGross int64

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		var payload struct {
			TransactionDetails struct {
				OrderID     string `json:"order_id"`
				GrossAmount int64  `json:"gross_amount"`
			} `json:"transaction_details"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode snap body: %v", err)
		}
		gotOrderID = payload.TransactionDetails.OrderID
		gotGross = payload.TransactionDetails.GrossAmount

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"token":"snap-tok-123","redirect_url":"https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-tok-123"}`))
	}))
	defer srv.Close()

	snapClient := &HTTPMidtransSnapClient{
		endpoint:  srv.URL,
		serverKey: serverKey,
		client:    srv.Client(),
	}
	repo := &stubBookingRepo{}
	svc := NewBookingService(repo, "qr-hmac-secret-key-123456", serverKey, "development", snapClient)

	futureDate := time.Now().In(wibZone).AddDate(0, 0, 2).Format("2006-01-02")
	tx, err := svc.CreateBooking(context.Background(), "usr-1", domain.CreateBookingRequest{
		VenueID:     "11111111-1111-1111-1111-111111111111",
		BookingDate: futureDate,
		Items:       []domain.BookingItemInput{{TicketID: "22222222-2222-2222-2222-222222222222", Quantity: 2}},
	})
	if err != nil {
		t.Fatalf("CreateBooking with Snap: %v", err)
	}

	expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(serverKey+":"))
	if gotAuth != expectedAuth {
		t.Fatalf("expected Basic auth %q, got %q", expectedAuth, gotAuth)
	}
	if gotOrderID != tx.InvoiceNumber || gotGross != 105000 {
		t.Fatalf("unexpected Snap payload order=%s gross=%d", gotOrderID, gotGross)
	}
	if tx.SnapToken != "snap-tok-123" || repo.snapToken != "snap-tok-123" {
		t.Fatalf("expected snapToken persisted and returned, got tx=%q repo=%q", tx.SnapToken, repo.snapToken)
	}
}
