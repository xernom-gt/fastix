package handler

import (
	"strconv"

	"fastix/api/internal/domain"
	"fastix/api/internal/response"
	"fastix/api/internal/service"

	"github.com/gofiber/fiber/v2"
)

// DiscoveryHandler exposes public region, partner lead, and venue endpoints.
type DiscoveryHandler struct {
	svc *service.DiscoveryService
}

// NewDiscoveryHandler constructs a DiscoveryHandler.
func NewDiscoveryHandler(svc *service.DiscoveryService) *DiscoveryHandler {
	return &DiscoveryHandler{svc: svc}
}

func (h *DiscoveryHandler) ListRegions(c *fiber.Ctx) error {
	regions, err := h.svc.ListRegions(c.UserContext())
	if err != nil {
		return handleDomainError(c, err)
	}
	total := len(regions)
	return response.OK(c, regions, &response.Meta{Total: &total})
}

func (h *DiscoveryHandler) CreatePartnerLead(c *fiber.Ctx) error {
	var req domain.PartnerLeadRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	res, err := h.svc.CreatePartnerLead(c.UserContext(), req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.Created(c, res, nil)
}

func (h *DiscoveryHandler) ListVenues(c *fiber.Ctx) error {
	filter := domain.VenueListFilter{
		Query:    c.Query("q"),
		Kota:     c.Query("kota", "all"),
		Kategori: c.Query("kategori", "all"),
		Tanggal:  c.Query("tanggal"),
		SortBy:   c.Query("sortBy", "popularitas"),
		Limit:    c.QueryInt("limit", 20),
		Offset:   c.QueryInt("offset", 0),
	}

	if latStr := c.Query("lat"); latStr != "" {
		if latVal, err := strconv.ParseFloat(latStr, 64); err == nil {
			filter.Lat = &latVal
		}
	}
	if lngStr := c.Query("lng"); lngStr != "" {
		if lngVal, err := strconv.ParseFloat(lngStr, 64); err == nil {
			filter.Lng = &lngVal
		}
	}

	res, err := h.svc.ListVenues(c.UserContext(), filter)
	if err != nil {
		return handleDomainError(c, err)
	}

	total := res.Total
	isFuzzy := res.IsFuzzyMatch
	return response.OK(c, res.Venues, &response.Meta{
		Total:          &total,
		Tanggal:        res.Tanggal,
		IsFuzzyMatch:   &isFuzzy,
		CorrectedQuery: res.CorrectedQuery,
	})
}

func (h *DiscoveryHandler) GetVenueDetail(c *fiber.Ctx) error {
	venueID := c.Params("id")
	tanggal := c.Query("tanggal")

	detail, err := h.svc.GetVenueDetail(c.UserContext(), venueID, tanggal)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, detail, nil)
}
