package config

import (
	"encoding/hex"
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds runtime settings loaded from environment variables.
type Config struct {
	AppEnv             string
	AppPort            string
	DatabaseURL        string
	CORSAllowedOrigins string
	JWTSecret          string
	QRHMACSecret       string
	KYBEncryptionKey   []byte
}

// Load reads .env if present and returns validated application configuration.
func Load() (Config, error) {
	// Ignore missing .env so container and CI environments can inject vars directly.
	_ = godotenv.Load()

	cfg := Config{
		AppEnv:             getEnvOrDefault("APP_ENV", "development"),
		AppPort:            getEnvOrDefault("APP_PORT", "8080"),
		DatabaseURL:        strings.TrimSpace(os.Getenv("DATABASE_URL")),
		CORSAllowedOrigins: getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175"),
		JWTSecret:          strings.TrimSpace(os.Getenv("JWT_SECRET")),
		QRHMACSecret:       strings.TrimSpace(os.Getenv("QR_HMAC_SECRET")),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if len(cfg.JWTSecret) < 16 {
		return Config{}, fmt.Errorf("JWT_SECRET must be at least 16 characters")
	}
	if len(cfg.QRHMACSecret) < 16 {
		return Config{}, fmt.Errorf("QR_HMAC_SECRET must be at least 16 characters")
	}

	kybHex := strings.TrimSpace(os.Getenv("KYB_ENCRYPTION_KEY"))
	if kybHex != "" {
		decoded, err := hex.DecodeString(kybHex)
		if err != nil || len(decoded) != 32 {
			return Config{}, fmt.Errorf("KYB_ENCRYPTION_KEY must be a 64-char hex AES-256 key")
		}
		cfg.KYBEncryptionKey = decoded
	}

	return cfg, nil
}

func getEnvOrDefault(key, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	return val
}
