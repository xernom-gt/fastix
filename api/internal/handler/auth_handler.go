package handler

import (
	"errors"
	"log/slog"

	"fastix/api/internal/domain"
	"fastix/api/internal/middleware"
	"fastix/api/internal/response"
	"fastix/api/internal/service"

	"github.com/gofiber/fiber/v2"
)

// AuthHandler exposes tourist registration, login, profile, and gate staff auth routes.
type AuthHandler struct {
	authSvc *service.AuthService
}

// NewAuthHandler constructs an AuthHandler.
func NewAuthHandler(authSvc *service.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req domain.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	res, err := h.authSvc.Register(c.UserContext(), req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.Created(c, res, nil)
}

func (h *AuthHandler) VerifyRegistrationOTP(c *fiber.Ctx) error {
	var req domain.VerifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	res, err := h.authSvc.VerifyRegistrationOTP(c.UserContext(), req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, res, nil)
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req domain.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	res, err := h.authSvc.Login(c.UserContext(), req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, res, nil)
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}

	profile, err := h.authSvc.GetProfile(c.UserContext(), claims.SubjectID)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, profile, nil)
}

func (h *AuthHandler) UpdateProfile(c *fiber.Ctx) error {
	claims, ok := middleware.GetAuthClaims(c)
	if !ok {
		return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
	}

	var req domain.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	profile, err := h.authSvc.UpdateProfile(c.UserContext(), claims.SubjectID, req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, profile, nil)
}

func (h *AuthHandler) GateLogin(c *fiber.Ctx) error {
	var req domain.GateLoginRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Fail(c, fiber.StatusBadRequest, "INVALID_JSON", "Format JSON tidak valid.", nil)
	}

	res, err := h.authSvc.GateLogin(c.UserContext(), req)
	if err != nil {
		return handleDomainError(c, err)
	}
	return response.OK(c, res, nil)
}

func handleDomainError(c *fiber.Ctx, err error) error {
	var appErr *domain.AppError
	if errors.As(err, &appErr) {
		status := fiber.StatusInternalServerError
		switch {
		case errors.Is(appErr.Kind, domain.ErrValidation):
			status = fiber.StatusBadRequest
		case errors.Is(appErr.Kind, domain.ErrUnauthorized):
			status = fiber.StatusUnauthorized
		case errors.Is(appErr.Kind, domain.ErrForbidden):
			status = fiber.StatusForbidden
		case errors.Is(appErr.Kind, domain.ErrNotFound):
			status = fiber.StatusNotFound
		case errors.Is(appErr.Kind, domain.ErrConflict):
			status = fiber.StatusConflict
		}
		return response.Fail(c, status, appErr.Code, appErr.Message, appErr.Details)
	}

	slog.Error("unexpected handler error", "error", err, "path", c.Path())
	return response.Fail(c, fiber.StatusInternalServerError, "INTERNAL_ERROR", "Terjadi kesalahan pada server.", nil)
}
