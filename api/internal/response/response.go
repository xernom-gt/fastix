package response

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

// Meta carries pagination, search, and timestamp metadata for success responses.
type Meta struct {
	Timestamp      string  `json:"timestamp"`
	Total          *int    `json:"total,omitempty"`
	Tanggal        string  `json:"tanggal,omitempty"`
	IsFuzzyMatch   *bool   `json:"isFuzzyMatch,omitempty"`
	CorrectedQuery *string `json:"correctedQuery,omitempty"`
}

// SuccessEnvelope wraps all successful JSON payloads per API_CONTRACTS.md.
type SuccessEnvelope[T any] struct {
	Success bool `json:"success"`
	Data    T    `json:"data"`
	Meta    Meta `json:"meta"`
}

// ErrorBody describes a machine-readable error code and user-facing message.
type ErrorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

// ErrorEnvelope wraps all failed JSON responses per API_CONTRACTS.md.
type ErrorEnvelope struct {
	Success bool      `json:"success"`
	Error   ErrorBody `json:"error"`
}

// NewMeta initializes response metadata with the current Asia/Jakarta RFC3339 timestamp.
func NewMeta() Meta {
	loc := time.FixedZone("WIB", 7*3600)
	return Meta{
		Timestamp: time.Now().In(loc).Format(time.RFC3339),
	}
}

// OK writes a 200 JSON response with a strongly typed data payload.
func OK[T any](c *fiber.Ctx, data T, meta *Meta) error {
	return writeSuccess(c, fiber.StatusOK, data, meta)
}

// Created writes a 201 JSON response with a strongly typed data payload.
func Created[T any](c *fiber.Ctx, data T, meta *Meta) error {
	return writeSuccess(c, fiber.StatusCreated, data, meta)
}

// Fail writes a standardized JSON error response.
func Fail(c *fiber.Ctx, status int, code, message string, details map[string]string) error {
	return c.Status(status).JSON(ErrorEnvelope{
		Success: false,
		Error: ErrorBody{
			Code:    code,
			Message: message,
			Details: details,
		},
	})
}

func writeSuccess[T any](c *fiber.Ctx, status int, data T, meta *Meta) error {
	resolved := NewMeta()
	if meta != nil {
		if meta.Timestamp != "" {
			resolved.Timestamp = meta.Timestamp
		}
		resolved.Total = meta.Total
		resolved.Tanggal = meta.Tanggal
		resolved.IsFuzzyMatch = meta.IsFuzzyMatch
		resolved.CorrectedQuery = meta.CorrectedQuery
	}

	return c.Status(status).JSON(SuccessEnvelope[T]{
		Success: true,
		Data:    data,
		Meta:    resolved,
	})
}
