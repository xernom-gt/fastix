package domain

// GeoPoint represents latitude and longitude coordinates.
type GeoPoint struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// RegionSummary represents a tourism region and its active venue count.
type RegionSummary struct {
	Kode             string   `json:"kode"`
	Nama             string   `json:"nama"`
	Provinsi         string   `json:"provinsi"`
	Pusat            GeoPoint `json:"pusat"`
	ActiveVenueCount int      `json:"activeVenueCount"`
}

// PartnerLeadRequest is the input for POST /api/v1/partner-leads.
type PartnerLeadRequest struct {
	VenueName string `json:"venueName"`
	KotaKode  string `json:"kotaKode"`
	PicName   string `json:"picName"`
	Whatsapp  string `json:"whatsapp"`
	Email     string `json:"email"`
}

// PartnerLeadResponse is returned by POST /api/v1/partner-leads.
type PartnerLeadResponse struct {
	LeadID string `json:"leadId"`
	Status string `json:"status"`
}

// VenueListFilter holds validated query parameters for GET /api/v1/venues.
type VenueListFilter struct {
	Query    string
	Kota     string
	Kategori string
	Tanggal  string
	SortBy   string
	Lat      *float64
	Lng      *float64
	Limit    int
	Offset   int
}

// VenueSummary represents a venue item in GET /api/v1/venues.
type VenueSummary struct {
	ID             string   `json:"id"`
	VenueCode      string   `json:"venueCode"`
	Nama           string   `json:"nama"`
	KotaKode       string   `json:"kotaKode"`
	Lokasi         string   `json:"lokasi"`
	Kategori       string   `json:"kategori"`
	HargaMulai     int64    `json:"hargaMulai"`
	Rating         float64  `json:"rating"`
	JumlahUlasan   int      `json:"jumlahUlasan"`
	GambarURL      string   `json:"gambarUrl"`
	GambarAlt      string   `json:"gambarAlt"`
	DistanceMeters *int64   `json:"distanceMeters,omitempty"`
	RemainingQuota int      `json:"remainingQuota"`
	IsPublished    bool     `json:"isPublished"`
	Lat            *float64 `json:"-"`
	Lng            *float64 `json:"-"`
}

// TicketProduct represents a bookable ticket type with daily quota counts.
type TicketProduct struct {
	ID               string `json:"id"`
	VenueID          string `json:"venueId"`
	Title            string `json:"title"`
	Description      string `json:"description"`
	Price            int64  `json:"price"`
	DailyQuota       int    `json:"dailyQuota"`
	UsedQuotaPaid    int    `json:"usedQuotaPaid"`
	UsedQuotaPending int    `json:"usedQuotaPending"`
}

// VenueDetail represents the full destination object returned by GET /api/v1/venues/:id.
type VenueDetail struct {
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

// VenueSearchResult bundles venue list items with search metadata.
type VenueSearchResult struct {
	Venues         []VenueSummary
	Total          int
	Tanggal        string
	IsFuzzyMatch   bool
	CorrectedQuery *string
}
