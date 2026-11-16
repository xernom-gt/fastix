package handler

import (
	"context"
	"time"

	"fastix/api/internal/response"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

// HealthData represents the service and database status returned by GET /api/v1/health.
type HealthData struct {
	Status        string `json:"status"`
	Service       string `json:"service"`
	Environment   string `json:"environment"`
	Database      string `json:"database"`
	PgTrgmEnabled bool   `json:"pgTrgmEnabled"`
}

// HealthHandler serves healthcheck requests against the PostgreSQL pool.
type HealthHandler struct {
	pool        *pgxpool.Pool
	environment string
}

// NewHealthHandler constructs a HealthHandler with the shared database pool.
func NewHealthHandler(pool *pgxpool.Pool, environment string) *HealthHandler {
	return &HealthHandler{
		pool:        pool,
		environment: environment,
	}
}

// Check verifies PostgreSQL connectivity and pg_trgm extension availability.
func (h *HealthHandler) Check(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.UserContext(), 3*time.Second)
	defer cancel()

	if err := h.pool.Ping(ctx); err != nil {
		return response.Fail(c, fiber.StatusServiceUnavailable, "DB_UNAVAILABLE", "Koneksi database tidak tersedia.", nil)
	}

	var pgTrgmEnabled bool
	if err := h.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm')`).Scan(&pgTrgmEnabled); err != nil {
		return response.Fail(c, fiber.StatusServiceUnavailable, "DB_CHECK_FAILED", "Gagal memeriksa ekstensi pg_trgm.", nil)
	}

	return response.OK(c, HealthData{
		Status:        "ok",
		Service:       "fastix-api",
		Environment:   h.environment,
		Database:      "connected",
		PgTrgmEnabled: pgTrgmEnabled,
	}, nil)
}
