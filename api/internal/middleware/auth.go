package middleware

import (
	"fmt"
	"strings"
	"time"

	"fastix/api/internal/domain"
	"fastix/api/internal/response"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/golang-jwt/jwt/v5"
)

const authClaimsLocalKey = "fastix_auth_claims"

// RequireAuth validates Bearer JWT tokens and stores parsed claims in Fiber locals.
func RequireAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := strings.TrimSpace(c.Get("Authorization"))
		if !strings.HasPrefix(header, "Bearer ") {
			return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Token autentikasi tidak ditemukan.", nil)
		}

		rawToken := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		if rawToken == "" {
			return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Token autentikasi tidak valid.", nil)
		}

		claims := &domain.AuthClaims{}
		parsed, err := jwt.ParseWithClaims(rawToken, claims, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !parsed.Valid || claims.SubjectID == "" {
			return response.Fail(c, fiber.StatusUnauthorized, "INVALID_TOKEN", "Sesi Anda telah berakhir atau token tidak valid.", nil)
		}

		c.Locals(authClaimsLocalKey, claims)
		return c.Next()
	}
}

// RequireRoles restricts access to callers whose JWT role matches one of allowedRoles.
func RequireRoles(allowedRoles ...string) fiber.Handler {
	allowed := make(map[string]struct{}, len(allowedRoles))
	for _, r := range allowedRoles {
		allowed[r] = struct{}{}
	}

	return func(c *fiber.Ctx) error {
		claims, ok := GetAuthClaims(c)
		if !ok {
			return response.Fail(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Autentikasi diperlukan.", nil)
		}

		if _, permitted := allowed[claims.Role]; !permitted {
			return response.Fail(c, fiber.StatusForbidden, "FORBIDDEN", "Anda tidak memiliki izin untuk mengakses fitur ini.", nil)
		}

		return c.Next()
	}
}

// GetAuthClaims retrieves authenticated JWT claims set by RequireAuth.
func GetAuthClaims(c *fiber.Ctx) (*domain.AuthClaims, bool) {
	claims, ok := c.Locals(authClaimsLocalKey).(*domain.AuthClaims)
	return claims, ok && claims != nil
}

// NewRateLimiter protects sensitive auth and gate endpoints against brute-force attempts.
func NewRateLimiter(maxRequests int, window time.Duration) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        maxRequests,
		Expiration: window,
		LimitReached: func(c *fiber.Ctx) error {
			return response.Fail(c, fiber.StatusTooManyRequests, "RATE_LIMITED", "Terlalu banyak percobaan. Silakan coba beberapa saat lagi.", nil)
		},
	})
}
