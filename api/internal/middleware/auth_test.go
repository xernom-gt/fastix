package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"fastix/api/internal/domain"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func TestRequireAuthAndRoles(t *testing.T) {
	const secret = "test-jwt-secret-key-123456"
	app := fiber.New()
	app.Get("/tourist", RequireAuth(secret), RequireRoles(domain.RoleTourist), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	// Missing token -> 401
	reqNoAuth := httptest.NewRequest(http.MethodGet, "/tourist", nil)
	respNoAuth, err := app.Test(reqNoAuth)
	if err != nil {
		t.Fatalf("app.Test(no auth): %v", err)
	}
	if respNoAuth.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", respNoAuth.StatusCode)
	}

	// Wrong role -> 403
	gateToken := signTestToken(t, secret, "stf-1", domain.RoleGateStaff)
	reqWrongRole := httptest.NewRequest(http.MethodGet, "/tourist", nil)
	reqWrongRole.Header.Set("Authorization", "Bearer "+gateToken)
	respWrongRole, err := app.Test(reqWrongRole)
	if err != nil {
		t.Fatalf("app.Test(wrong role): %v", err)
	}
	if respWrongRole.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", respWrongRole.StatusCode)
	}

	// Valid role -> 200
	touristToken := signTestToken(t, secret, "usr-1", domain.RoleTourist)
	reqValid := httptest.NewRequest(http.MethodGet, "/tourist", nil)
	reqValid.Header.Set("Authorization", "Bearer "+touristToken)
	respValid, err := app.Test(reqValid)
	if err != nil {
		t.Fatalf("app.Test(valid): %v", err)
	}
	if respValid.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respValid.StatusCode)
	}
}

func signTestToken(t *testing.T, secret, subjectID, role string) string {
	t.Helper()
	claims := domain.AuthClaims{
		SubjectID: subjectID,
		Role:      role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subjectID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("signTestToken: %v", err)
	}
	return signed
}
