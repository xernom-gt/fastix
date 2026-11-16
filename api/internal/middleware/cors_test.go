package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestCORSAllowedOrigins(t *testing.T) {
	app := fiber.New()
	app.Use(NewCORS("http://localhost:5173,http://localhost:5174,http://localhost:5175"))
	app.Get("/api/v1/health", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	for _, origin := range []string{"http://localhost:5173", "http://localhost:5174", "http://localhost:5175"} {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
		req.Header.Set("Origin", origin)
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("app.Test(%s): %v", origin, err)
		}
		if got := resp.Header.Get("Access-Control-Allow-Origin"); got != origin {
			t.Fatalf("origin %s: expected ACAO %q, got %q", origin, origin, got)
		}
	}

	blockedReq := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	blockedReq.Header.Set("Origin", "http://evil.example.com")
	blockedResp, err := app.Test(blockedReq)
	if err != nil {
		t.Fatalf("app.Test(blocked): %v", err)
	}
	if got := blockedResp.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected empty ACAO for unknown origin, got %q", got)
	}
}
