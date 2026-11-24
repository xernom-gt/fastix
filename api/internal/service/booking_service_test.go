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
	"strings"
	"testing"
	"time"

	"fastix/api/internal/domain"
)

type stubBookingRepo struct {
	createdInput      domain.PendingTransactionCreate
	cutoffSeen        string
	snapToken         string
	snapURL           string
	qrString          string
	invoiceNumber     string
	lookupInvoiceSeen string
	settledGatewayRef string
}

func (r *stubBookingRepo) CreateBookingTx(_ context.Context, input domain.PendingTransactionCreate, _ []string, _ map[string]int) (domain.TransactionDTO, error) {
	r.createdInput = input
	return domain.TransactionDTO{
		ID:            "tx-1",
		InvoiceNumber: input.InvoiceNumber,
		TotalAmount:   105000,
		PaymentStatus: domain.PaymentStatusPending,
		QRString:      input.QRString,
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

func (r *stubBookingRepo) UpdateTransactionQRString(_ context.Context, _, qrString string) error {
	r.qrString = qrString
	return nil
}

func (r *stubBookingRepo) FindBookingByID(_ context.Context, transactionID, _ string) (domain.TransactionDTO, error) {
	return domain.TransactionDTO{
		ID:            transactionID,
		InvoiceNumber: r.invoiceNumber,
		PaymentStatus: domain.PaymentStatusPending,
	}, nil
}

func (r *stubBookingRepo) FindBookingIDByInvoice(_ context.Context, invoiceNumber string) (string, error) {
	r.lookupInvoiceSeen = invoiceNumber
	return "tx-1", nil
}

func (r *stubBookingRepo) SettlePaymentTx(_ context.Context, transactionID, gatewayRef string, _ func(string, string, string) (domain.RedemptionCreate, error)) (domain.TransactionDTO, error) {
	r.settledGatewayRef = gatewayRef
	return domain.TransactionDTO{
		ID:            transactionID,
		InvoiceNumber: r.invoiceNumber,
		PaymentStatus: domain.PaymentStatusPaid,
	}, nil
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

	orderID := "PWL-INV-20261121-0042"
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
	if repo.lookupInvoiceSeen != "PWL/INV/20261121/0042" {
		t.Fatalf("expected invoice lookup PWL/INV/20261121/0042, got %q", repo.lookupInvoiceSeen)
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
	wantOrderID := toMidtransOrderID(tx.InvoiceNumber)
	if strings.Contains(gotOrderID, "/") || gotOrderID != wantOrderID || gotGross != 105000 {
		t.Fatalf("unexpected Snap payload order=%s want=%s gross=%d", gotOrderID, wantOrderID, gotGross)
	}
	if tx.SnapToken != "snap-tok-123" || repo.snapToken != "snap-tok-123" {
		t.Fatalf("expected snapToken persisted and returned, got tx=%q repo=%q", tx.SnapToken, repo.snapToken)
	}
}

func TestCreateBookingWithMidtransSnapFallback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	snapClient := &HTTPMidtransSnapClient{
		endpoint:  srv.URL,
		serverKey: "SB-Mid-server-invalid",
		client:    srv.Client(),
	}
	repo := &stubBookingRepo{}
	svc := NewBookingService(repo, "qr-hmac-secret-key-123456", "SB-Mid-server-invalid", "development", snapClient)

	futureDate := time.Now().In(wibZone).AddDate(0, 0, 2).Format("2006-01-02")
	tx, err := svc.CreateBooking(context.Background(), "usr-1", domain.CreateBookingRequest{
		VenueID:     "11111111-1111-1111-1111-111111111111",
		BookingDate: futureDate,
		Items:       []domain.BookingItemInput{{TicketID: "22222222-2222-2222-2222-222222222222", Quantity: 1}},
	})
	if err != nil {
		t.Fatalf("expected fallback on Snap API error, got %v", err)
	}

	wantToken := "sandbox-snap-" + tx.InvoiceNumber
	wantURL := "https://simulator.sandbox.midtrans.com/qris/index?order_id=" + toMidtransOrderID(tx.InvoiceNumber) + "&amount=105000"
	if tx.SnapToken != wantToken || repo.snapToken != wantToken {
		t.Fatalf("expected fallback snapToken %q, got tx=%q repo=%q", wantToken, tx.SnapToken, repo.snapToken)
	}
	if tx.SnapRedirectURL != wantURL || repo.snapURL != wantURL {
		t.Fatalf("expected fallback snapRedirectURL %q, got tx=%q repo=%q", wantURL, tx.SnapRedirectURL, repo.snapURL)
	}
}

func TestMidtransCheckConnection(t *testing.T) {
	t.Run("empty server key returns false", func(t *testing.T) {
		client := &HTTPMidtransSnapClient{
			endpoint:  "https://example.invalid/snap/v1/transactions",
			serverKey: "   ",
			client:    http.DefaultClient,
		}
		if client.CheckConnection(context.Background()) {
			t.Fatal("expected CheckConnection to return false for empty server key")
		}
	})

	cases := []struct {
		name       string
		statusCode int
		want       bool
	}{
		{name: "401 unauthorized returns false", statusCode: http.StatusUnauthorized, want: false},
		{name: "400 bad request returns true", statusCode: http.StatusBadRequest, want: true},
		{name: "200 ok returns true", statusCode: http.StatusOK, want: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			const serverKey = "SB-Mid-server-check-test"
			var gotMethod string
			var gotAuth string
			var gotContentType string

			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotMethod = r.Method
				gotAuth = r.Header.Get("Authorization")
				gotContentType = r.Header.Get("Content-Type")
				w.WriteHeader(tc.statusCode)
			}))
			defer srv.Close()

			client := &HTTPMidtransSnapClient{
				endpoint:  srv.URL,
				serverKey: serverKey,
				client:    srv.Client(),
			}

			got := client.CheckConnection(context.Background())
			if got != tc.want {
				t.Fatalf("CheckConnection() = %v, want %v", got, tc.want)
			}
			if gotMethod != http.MethodPost {
				t.Fatalf("expected POST request, got %s", gotMethod)
			}
			expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(serverKey+":"))
			if gotAuth != expectedAuth {
				t.Fatalf("expected Authorization %q, got %q", expectedAuth, gotAuth)
			}
			if gotContentType != "application/json" {
				t.Fatalf("expected Content-Type application/json, got %q", gotContentType)
			}
		})
	}
}

func TestCreateBookingWithMidtransCoreQRIS(t *testing.T) {
	const serverKey = "SB-Mid-server-core-qris-test"
	const expectedQRString = "00020101021226620014ID.CO.QRIS.WWW01189360091431234567890215ID10200123456780303UME51440014ID.CO.QRIS.WWW0215ID10200123456780303UME52045999530336054061050005802ID5911FASTIX TEST6007JAKARTA6105123456304ABCD"

	var gotPaymentType string
	var gotOrderID string
	var gotGross int64

	snapSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"token":"snap-tok-qris","redirect_url":"https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-tok-qris"}`))
	}))
	defer snapSrv.Close()

	coreSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/charge" || r.Method != http.MethodPost {
			t.Fatalf("unexpected Core API request: %s %s", r.Method, r.URL.Path)
		}
		var payload struct {
			PaymentType        string `json:"payment_type"`
			TransactionDetails struct {
				OrderID     string `json:"order_id"`
				GrossAmount int64  `json:"gross_amount"`
			} `json:"transaction_details"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode core charge body: %v", err)
		}
		gotPaymentType = payload.PaymentType
		gotOrderID = payload.TransactionDetails.OrderID
		gotGross = payload.TransactionDetails.GrossAmount

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status_code":"201","transaction_status":"pending","qr_string":"` + expectedQRString + `"}`))
	}))
	defer coreSrv.Close()

	snapClient := &HTTPMidtransSnapClient{
		endpoint:    snapSrv.URL,
		coreBaseURL: coreSrv.URL,
		serverKey:   serverKey,
		client:      coreSrv.Client(),
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
		t.Fatalf("CreateBooking with Core QRIS: %v", err)
	}

	wantOrderID := toMidtransOrderID(tx.InvoiceNumber)
	if gotPaymentType != "qris" || strings.Contains(gotOrderID, "/") || gotOrderID != wantOrderID || gotGross != 105000 {
		t.Fatalf("unexpected Core QRIS payload: type=%s order=%s want=%s gross=%d", gotPaymentType, gotOrderID, wantOrderID, gotGross)
	}
	if tx.QRString != expectedQRString || repo.qrString != expectedQRString {
		t.Fatalf("expected qrString %q persisted and returned, got tx=%q repo=%q", expectedQRString, tx.QRString, repo.qrString)
	}
}

func TestGetBookingAutoSyncsMidtransSettlement(t *testing.T) {
	const serverKey = "SB-Mid-server-status-test"
	const invoiceNumber = "PWL/INV/20261124/ABCD"
	const midtransTxID = "mid-qris-tx-999"

	var gotStatusPath string
	var gotAuth string

	coreSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotStatusPath = r.URL.EscapedPath()
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"order_id":"PWL-INV-20261124-ABCD","transaction_id":"` + midtransTxID + `","transaction_status":"settlement","status_code":"200"}`))
	}))
	defer coreSrv.Close()

	snapClient := &HTTPMidtransSnapClient{
		coreBaseURL: coreSrv.URL,
		serverKey:   serverKey,
		client:      coreSrv.Client(),
	}
	repo := &stubBookingRepo{invoiceNumber: invoiceNumber}
	svc := NewBookingService(repo, "qr-hmac-secret-key-123456", serverKey, "development", snapClient)

	tx, err := svc.GetBooking(context.Background(), "tx-1", "usr-1")
	if err != nil {
		t.Fatalf("GetBooking auto-sync: %v", err)
	}

	expectedPath := "/v2/PWL-INV-20261124-ABCD/status"
	if gotStatusPath != expectedPath {
		t.Fatalf("expected status path %q, got %q", expectedPath, gotStatusPath)
	}
	expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(serverKey+":"))
	if gotAuth != expectedAuth {
		t.Fatalf("expected Basic auth %q, got %q", expectedAuth, gotAuth)
	}
	if tx.PaymentStatus != domain.PaymentStatusPaid {
		t.Fatalf("expected PAID after Midtrans settlement sync, got %s", tx.PaymentStatus)
	}
	if repo.settledGatewayRef != midtransTxID {
		t.Fatalf("expected gatewayRef %q, got %q", midtransTxID, repo.settledGatewayRef)
	}

	// Verify CheckOrderStatus error is ignored and returns PENDING
	errSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer errSrv.Close()

	svcErr := NewBookingService(
		&stubBookingRepo{invoiceNumber: invoiceNumber},
		"qr-hmac-secret-key-123456",
		serverKey,
		"development",
		&HTTPMidtransSnapClient{coreBaseURL: errSrv.URL, serverKey: serverKey, client: errSrv.Client()},
	)
	pendingTx, err := svcErr.GetBooking(context.Background(), "tx-1", "usr-1")
	if err != nil {
		t.Fatalf("expected GetBooking to ignore CheckOrderStatus error, got %v", err)
	}
	if pendingTx.PaymentStatus != domain.PaymentStatusPending {
		t.Fatalf("expected PENDING when CheckOrderStatus fails, got %s", pendingTx.PaymentStatus)
	}
}
