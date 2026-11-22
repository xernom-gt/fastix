package domain

import "errors"

var (
	ErrNotFound     = errors.New("resource not found")
	ErrConflict     = errors.New("resource conflict")
	ErrValidation   = errors.New("validation failed")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
)

// AppError pairs a machine-readable error code and user message with an HTTP-mappable kind.
type AppError struct {
	Kind    error
	Code    string
	Message string
	Details map[string]string
}

func (e *AppError) Error() string {
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Kind
}

// NewAppError builds a typed domain error for clean HTTP status mapping in handlers.
func NewAppError(kind error, code, message string, details map[string]string) *AppError {
	return &AppError{
		Kind:    kind,
		Code:    code,
		Message: message,
		Details: details,
	}
}
