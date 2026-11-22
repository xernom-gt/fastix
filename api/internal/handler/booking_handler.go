package handler

import (
	"fastix/api/internal/domain"
	"fastix/api/internal/middleware"
	"fastix/api/internal/response"
	"fastix/api/internal/service"

	"github.com/gofiber/fiber/v2"
)

// BookingHandler exposes checkout, QRIS webhook, and e-ticket endpoints.
type BookingHandler struct {
	svc *service.BookingService
}

// NewBookingHandler constructs a BookingHandler.
func NewBookingHandler(svc *service.BookingService) *BookingHandler {
	return &BookingHandler{svc: svc}
}

func (h *BookingHandler) CreateBooking(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}

	var req domain.CreateBookingRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	tx, err := h.svc.CreateBooking(c.UserContext(), claims.SubjectID, req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.Created(c, tx, nil)
}

func (h *BookingHandler) GetBooking(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}

	tx, err := h.svc.GetBooking(c.UserContext(), c.Params("invoiceId"), claims.SubjectID)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, tx, nil)
}

func (h *BookingHandler) QRISWebhook(c *fiber.Ctx) error {
	var req domain.QRISWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	tx, err := h.svc.HandleQRISWebhook(c.UserContext(), c.Body(), c.Get("X-Fastix-Signature"), req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, tx, nil)
}

func (h *BookingHandler) SimulatePay(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}

	tx, err := h.svc.SimulatePay(c.UserContext(), c.Params("invoiceId"), claims.SubjectID)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, tx, nil)
}

func (h *BookingHandler) ListTickets(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}

	tickets, err := h.svc.ListMyTickets(c.UserContext(), claims.SubjectID)
	if err != nil {
		return handleDomainError(c, err)
	}
	total := len(tickets)
	return response.OK(c, tickets, &response.Meta{Total: &total})
}

func (h *BookingHandler) GetTicket(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}

	ticket, err := h.svc.GetMyTicket(c.UserContext(), c.Params("ticketCode"), claims.SubjectID)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, ticket, nil)
}
