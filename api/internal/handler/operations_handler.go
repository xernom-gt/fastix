package handler

import (
	"io"

	"fastix/api/internal/domain"
	"fastix/api/internal/middleware"
	"fastix/api/internal/response"
	"fastix/api/internal/service"

	"github.com/gofiber/fiber/v2"
)

// OperationsHandler exposes gate scanner and mitra/owner endpoints.
type OperationsHandler struct {
	svc *service.OperationsService
}

// NewOperationsHandler constructs an OperationsHandler.
func NewOperationsHandler(svc *service.OperationsService) *OperationsHandler {
	return &OperationsHandler{svc: svc}
}

func (h *OperationsHandler) ListTodayGateTickets(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	venueID := claims.VenueID
	if venueID == "" {
		venueID = c.Query("venueId")
	}

	tickets, err := h.svc.ListTodayGateTickets(c.UserContext(), venueID)
	if err != nil {
		return handleDomainError(c, err)
	}
	total := len(tickets)
	return response.OK(c, tickets, &response.Meta{Total: &total})
}

func (h *OperationsHandler) GateRedeem(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.GateRedeemRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	staffID := ""
	if claims.Role == domain.RoleGateStaff {
		staffID = claims.SubjectID
	}

	res, err := h.svc.RedeemAtGate(c.UserContext(), claims.VenueID, staffID, req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, res, nil)
}

func (h *OperationsHandler) GateSync(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.GateSyncRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	staffID := ""
	if claims.Role == domain.RoleGateStaff {
		staffID = claims.SubjectID
	}

	res, err := h.svc.SyncOfflineScans(c.UserContext(), claims.VenueID, staffID, req)
	if err != nil {
		return handleDomainError(c, err)
	}
	total := len(res)
	return response.OK(c, res, &response.Meta{Total: &total})
}

func (h *OperationsHandler) SubmitKYB(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.SubmitKYBRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	res, err := h.svc.SubmitKYB(c.UserContext(), claims.SubjectID, req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.Created(c, res, nil)
}

func (h *OperationsHandler) DemoApproveKYB(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.DemoApproveKYBRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
		}
	}

	res, err := h.svc.DemoApproveKYB(c.UserContext(), claims.SubjectID, req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, res, nil)
}

func (h *OperationsHandler) ListMitraVenues(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	venues, err := h.svc.ListMitraVenues(c.UserContext(), claims.SubjectID)
	if err != nil {
		return handleDomainError(c, err)
	}
	total := len(venues)
	return response.OK(c, venues, &response.Meta{Total: &total})
}

func (h *OperationsHandler) UpdateMitraVenue(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.UpdateMitraVenueRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}
	venue, err := h.svc.UpdateMitraVenue(c.UserContext(), claims.SubjectID, c.Params("id"), req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, venue, nil)
}

func (h *OperationsHandler) UploadMitraVenueImage(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	fileHeader, err := c.FormFile("image")
	if err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "FILE_REQUIRED", "File foto destinasi wajib diunggah.", nil)
	}
	if fileHeader.Size > 5*1024*1024 {
		return response.Fail(c, fiber.StatusBadRequest, "FILE_TOO_LARGE", "Ukuran foto maksimal 5 MB.", nil)
	}
	file, err := fileHeader.Open()
	if err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "FILE_READ_ERROR", "Gagal membaca file foto yang diunggah.", nil)
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, 5*1024*1024+1))
	if err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "FILE_READ_ERROR", "Gagal membaca file foto yang diunggah.", nil)
	}

	venue, err := h.svc.UploadMitraVenueImage(c.UserContext(), claims.SubjectID, c.Params("id"), data)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, venue, nil)
}

func (h *OperationsHandler) CreateMitraTicket(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.CreateTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}
	tkt, err := h.svc.CreateMitraTicket(c.UserContext(), claims.SubjectID, req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.Created(c, tkt, nil)
}

func (h *OperationsHandler) UpdateMitraTicket(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.UpdateTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}
	tkt, err := h.svc.UpdateMitraTicket(c.UserContext(), claims.SubjectID, c.Params("id"), req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, tkt, nil)
}

func (h *OperationsHandler) ListMitraStaffs(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	staffs, err := h.svc.ListMitraStaffs(c.UserContext(), claims.SubjectID)
	if err != nil {
		return handleDomainError(c, err)
	}
	total := len(staffs)
	return response.OK(c, staffs, &response.Meta{Total: &total})
}

func (h *OperationsHandler) CreateMitraStaff(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.CreateStaffRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}
	staff, err := h.svc.CreateMitraStaff(c.UserContext(), claims.SubjectID, req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.Created(c, staff, nil)
}

func (h *OperationsHandler) UpdateMitraStaff(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.UpdateStaffRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}
	staff, err := h.svc.UpdateMitraStaff(c.UserContext(), claims.SubjectID, c.Params("id"), req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, staff, nil)
}

func (h *OperationsHandler) GetMitraFinance(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	finance, err := h.svc.GetMitraFinance(c.UserContext(), claims.SubjectID)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, finance, nil)
}

func (h *OperationsHandler) CreatePayout(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}
	var req domain.CreatePayoutRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}
	payout, err := h.svc.RequestPayout(c.UserContext(), claims.SubjectID, req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.Created(c, payout, nil)
}
