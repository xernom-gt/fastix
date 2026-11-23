package domain

import "time"

const (
	PaymentStatusPending   = "PENDING"
	PaymentStatusPaid      = "PAID"
	PaymentStatusRefunded  = "REFUNDED"
	PaymentStatusExpired   = "EXPIRED"
	PaymentStatusCancelled = "CANCELLED"

	RedemptionStatusValid    = "VALID"
	RedemptionStatusRedeemed = "REDEEMED"
	RedemptionStatusRefunded = "REFUNDED"
	RedemptionStatusExpired  = "EXPIRED"
)

// BookingItemInput represents a single ticket line requested during checkout.
type BookingItemInput struct {
	TicketID string `json:"ticketId"`
	Quantity int    `json:"quantity"`
}

// CreateBookingRequest is the input for POST /api/v1/bookings.
type CreateBookingRequest struct {
	VenueID     string             `json:"venueId"`
	BookingDate string             `json:"bookingDate"`
	Items       []BookingItemInput `json:"items"`
}

// TransactionItemDTO represents a booked ticket line in transaction responses.
type TransactionItemDTO struct {
	TicketID    string `json:"ticketId"`
	TicketTitle string `json:"ticketTitle"`
	BookingDate string `json:"bookingDate"`
	Quantity    int    `json:"quantity"`
	UnitPrice   int64  `json:"unitPrice"`
}

// TransactionDTO represents a booking invoice returned by booking endpoints.
type TransactionDTO struct {
	ID              string               `json:"id"`
	InvoiceNumber   string               `json:"invoiceNumber"`
	VenueID         string               `json:"venueId"`
	VenueCode       string               `json:"venueCode"`
	VenueName       string               `json:"venueName"`
	VenueAddress    string               `json:"venueAddress"`
	BookingDate     string               `json:"bookingDate"`
	Items           []TransactionItemDTO `json:"items"`
	Subtotal        int64                `json:"subtotal"`
	PlatformFee     int64                `json:"platformFee"`
	TotalAmount     int64                `json:"totalAmount"`
	PaymentStatus   string               `json:"paymentStatus"`
	QRString        string               `json:"qrString"`
	SnapToken       string               `json:"snapToken,omitempty"`
	SnapRedirectURL string               `json:"snapRedirectUrl,omitempty"`
	ExpiredAt       string               `json:"expiredAt"`
	PaidAt          *string              `json:"paidAt,omitempty"`
	CreatedAt       string               `json:"createdAt"`
}

// CustomerContact holds tourist identity fields for payment gateway checkout.
type CustomerContact struct {
	FullName    string
	Email       string
	PhoneNumber string
}

// SnapCreateResponse holds the token and redirect URL returned by Midtrans Snap.
type SnapCreateResponse struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
}

// QRISWebhookRequest represents either a Midtrans HTTP notification or internal QRIS callback.
type QRISWebhookRequest struct {
	InvoiceNumber     string `json:"invoiceNumber"`
	PaymentGatewayRef string `json:"paymentGatewayRef"`
	Status            string `json:"status"`

	OrderID           string `json:"order_id"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	SignatureKey      string `json:"signature_key"`
	TransactionStatus string `json:"transaction_status"`
	TransactionID     string `json:"transaction_id"`
}

// ETicketDTO represents a single redeemable QR e-ticket.
type ETicketDTO struct {
	ID            string  `json:"id"`
	TicketCode    string  `json:"ticketCode"`
	InvoiceNumber string  `json:"invoiceNumber"`
	VenueID       string  `json:"venueId"`
	VenueCode     string  `json:"venueCode"`
	VenueName     string  `json:"venueName"`
	VenueAddress  string  `json:"venueAddress"`
	TicketTitle   string  `json:"ticketTitle"`
	BookingDate   string  `json:"bookingDate"`
	SignatureHash string  `json:"signatureHash"`
	QRPayload     string  `json:"qrPayload"`
	Status        string  `json:"status"`
	HolderName    string  `json:"holderName"`
	PaidAt        string  `json:"paidAt"`
	RedeemedAt    *string `json:"redeemedAt,omitempty"`
}

// LockedTicketQuota holds locked ticket metadata and used counts inside a booking transaction.
type LockedTicketQuota struct {
	TicketID         string
	VenueID          string
	Title            string
	Price            int64
	DailyQuota       int
	UsedQuotaPaid    int
	UsedQuotaPending int
}

// PendingTransactionCreate holds all fields needed to persist a new pending booking.
type PendingTransactionCreate struct {
	CustomerID    string
	VenueID       string
	InvoiceNumber string
	BookingDate   time.Time
	Subtotal      int64
	PlatformFee   int64
	TotalAmount   int64
	QRString      string
	ExpiredAt     time.Time
	Items         []PendingTransactionItemCreate
}

// PendingTransactionItemCreate holds a single item to insert into transaction_items.
type PendingTransactionItemCreate struct {
	TicketID  string
	Quantity  int
	UnitPrice int64
}

// RedemptionCreate holds a generated e-ticket row to insert upon payment settlement.
type RedemptionCreate struct {
	TransactionItemID string
	TicketCode        string
	SignatureHash     string
}
