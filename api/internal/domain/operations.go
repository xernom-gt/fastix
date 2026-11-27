package domain

const (
	MutationPayinInflow     = "PAYIN_INFLOW"
	MutationHoldingReleased = "HOLDING_RELEASED"
	MutationPayoutWithdraw  = "PAYOUT_WITHDRAW"
	MutationPayoutRefund    = "PAYOUT_REFUND"

	MutationRefTransaction = "TRANSACTION"
	MutationRefPayout      = "PAYOUT"

	PayoutAdminFee int64 = 6500
	MinPayoutAmount int64 = 50000
)

// GateRedeemRequest is the input for POST /api/v1/gate/redeem.
type GateRedeemRequest struct {
	QRPayload  string `json:"qrPayload"`
	TicketCode string `json:"ticketCode"`
}

// GateRedeemResult represents the outcome of scanning or redeeming a ticket.
type GateRedeemResult struct {
	TicketCode string  `json:"ticketCode"`
	Status     string  `json:"status"`
	TicketName string  `json:"ticketName"`
	HolderName string  `json:"holderName"`
	RedeemedAt string  `json:"redeemedAt"`
	Message    string  `json:"message"`
}

// GateSyncItem represents one offline scan queued on a gate device.
type GateSyncItem struct {
	TicketCode string `json:"ticketCode"`
	ScannedAt  string `json:"scannedAt"`
}

// GateSyncRequest is the input for POST /api/v1/gate/sync.
type GateSyncRequest struct {
	Items []GateSyncItem `json:"items"`
}

// GateSyncItemResult reports the sync outcome of a single offline scan.
type GateSyncItemResult struct {
	TicketCode string `json:"ticketCode"`
	Outcome    string `json:"outcome"`
	Message    string `json:"message"`
}

// SubmitKYBRequest is the input for POST /api/v1/mitra/kyb.
type SubmitKYBRequest struct {
	KTPNumber         string `json:"ktpNumber"`
	KTPPhotoURL       string `json:"ktpPhotoUrl"`
	NPWPNumber        string `json:"npwpNumber"`
	NPWPPhotoURL      string `json:"npwpPhotoUrl"`
	NIBNumber         string `json:"nibNumber"`
	BankCode          string `json:"bankCode"`
	BankAccountNumber string `json:"bankAccountNumber"`
	BankAccountName   string `json:"bankAccountName"`
}

// KYBSubmissionResponse is returned after submitting mitra legality documents.
type KYBSubmissionResponse struct {
	ID                 string `json:"id"`
	VerificationStatus string `json:"verificationStatus"`
}

// MitraVenueDTO represents an owner's venue with its ticket products.
type MitraVenueDTO struct {
	ID           string          `json:"id"`
	VenueCode    string          `json:"venueCode"`
	Nama         string          `json:"nama"`
	KotaKode     string          `json:"kotaKode"`
	Lokasi       string          `json:"lokasi"`
	Alamat       string          `json:"alamat"`
	JamBuka      string          `json:"jamBuka"`
	Deskripsi    string          `json:"deskripsi"`
	Kategori     string          `json:"kategori"`
	HargaMulai   int64           `json:"hargaMulai"`
	Rating       float64         `json:"rating"`
	JumlahUlasan int             `json:"jumlahUlasan"`
	GambarURL    string          `json:"gambarUrl"`
	GambarAlt    string          `json:"gambarAlt"`
	Fasilitas    []string        `json:"fasilitas"`
	Koordinat    GeoPoint        `json:"koordinat"`
	IsPublished  bool            `json:"isPublished"`
	Tickets      []TicketProduct `json:"tickets"`
}

// UpdateMitraVenueRequest is the input for PATCH /api/v1/mitra/venues/:id.
type UpdateMitraVenueRequest struct {
	Nama      string   `json:"nama"`
	Alamat    string   `json:"alamat"`
	JamBuka   string   `json:"jamBuka"`
	Deskripsi string   `json:"deskripsi"`
	Fasilitas []string `json:"fasilitas"`
}

// CreateTicketRequest is the input for POST /api/v1/mitra/tickets.
type CreateTicketRequest struct {
	VenueID     string `json:"venueId"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Price       int64  `json:"price"`
	DailyQuota  int    `json:"dailyQuota"`
}

// UpdateTicketRequest is the input for PATCH /api/v1/mitra/tickets/:id.
type UpdateTicketRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Price       *int64  `json:"price"`
	DailyQuota  *int    `json:"dailyQuota"`
	IsActive    *bool   `json:"isActive"`
}

// MitraStaffDTO represents a gate staff account managed by an owner.
type MitraStaffDTO struct {
	ID        string `json:"id"`
	VenueID   string `json:"venueId"`
	VenueCode string `json:"venueCode"`
	Name      string `json:"name"`
	IsActive  bool   `json:"isActive"`
	CreatedAt string `json:"createdAt"`
}

// CreateStaffRequest is the input for POST /api/v1/mitra/staffs.
type CreateStaffRequest struct {
	VenueID string `json:"venueId"`
	Name    string `json:"name"`
	Pin     string `json:"pin"`
}

// UpdateStaffRequest is the input for PATCH /api/v1/mitra/staffs/:id.
type UpdateStaffRequest struct {
	Pin      *string `json:"pin"`
	IsActive *bool   `json:"isActive"`
}

// BalanceMutationDTO represents a ledger entry in owner balance history.
type BalanceMutationDTO struct {
	ID          string `json:"id"`
	Amount      int64  `json:"amount"`
	Type        string `json:"type"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
}

// PayoutDTO represents a withdrawal request to the verified KYB bank account.
type PayoutDTO struct {
	ID                string  `json:"id"`
	Amount            int64   `json:"amount"`
	AdminFee          int64   `json:"adminFee"`
	NetAmount         int64   `json:"netAmount"`
	BankCode          string  `json:"bankCode"`
	BankAccountNumber string  `json:"bankAccountNumber"`
	BankAccountName   string  `json:"bankAccountName"`
	Status            string  `json:"status"`
	CreatedAt         string  `json:"createdAt"`
	TransferredAt     *string `json:"transferredAt,omitempty"`
}

// MitraFinanceSummary aggregates holding platform funds, escrow balances, mutations, and payouts.
type MitraFinanceSummary struct {
	GrossRevenue           int64                `json:"grossRevenue"`
	PlatformFee            int64                `json:"platformFee"`
	HoldingPlatformBalance int64                `json:"holdingPlatformBalance"`
	PendingBalance         int64                `json:"pendingBalance"`
	AvailableBalance       int64                `json:"availableBalance"`
	RefundedCount          int                  `json:"refundedCount"`
	Mutations              []BalanceMutationDTO `json:"mutations"`
	Payouts                []PayoutDTO          `json:"payouts"`
}

// CreatePayoutRequest is the input for POST /api/v1/mitra/payouts.
type CreatePayoutRequest struct {
	Amount int64 `json:"amount"`
}
