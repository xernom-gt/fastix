package config

import (
	"encoding/hex"
	"fmt"
	"net"
	"net/url"
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
	MidtransEnv        string
	MidtransMerchantID string
	MidtransClientKey  string
	MidtransServerKey  string
	GoogleClientID     string
}

// Load reads .env if present and returns validated application configuration.
func Load() (Config, error) {
	// Ignore missing .env so container and CI environments can inject vars directly.
	_ = godotenv.Load()

	databaseURL, err := resolveDatabaseURL()
	if err != nil {
		return Config{}, err
	}

	cfg := Config{
		AppEnv:             getEnvOrDefault("APP_ENV", "development"),
		AppPort:            getEnvOrDefault("APP_PORT", "8080"),
		DatabaseURL:        databaseURL,
		CORSAllowedOrigins: getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175"),
		JWTSecret:          strings.TrimSpace(os.Getenv("JWT_SECRET")),
		QRHMACSecret:       strings.TrimSpace(os.Getenv("QR_HMAC_SECRET")),
		MidtransEnv:        strings.ToLower(getEnvOrDefault("MIDTRANS_ENV", "sandbox")),
		MidtransMerchantID: strings.TrimSpace(os.Getenv("MIDTRANS_MERCHANT_ID")),
		MidtransClientKey:  strings.TrimSpace(os.Getenv("MIDTRANS_CLIENT_KEY")),
		MidtransServerKey:  strings.TrimSpace(os.Getenv("MIDTRANS_SERVER_KEY")),
		GoogleClientID:     strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")),
	}

	if len(cfg.JWTSecret) < 16 {
		return Config{}, fmt.Errorf("JWT_SECRET must be at least 16 characters")
	}
	if len(cfg.QRHMACSecret) < 16 {
		return Config{}, fmt.Errorf("QR_HMAC_SECRET must be at least 16 characters")
	}

	if cfg.MidtransEnv != "sandbox" && cfg.MidtransEnv != "production" {
		return Config{}, fmt.Errorf("MIDTRANS_ENV must be sandbox or production")
	}
	if strings.EqualFold(cfg.AppEnv, "production") && cfg.MidtransServerKey == "" {
		return Config{}, fmt.Errorf("MIDTRANS_SERVER_KEY is required when APP_ENV=production")
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

func resolveDatabaseURL() (string, error) {
	if direct := strings.TrimSpace(os.Getenv("DATABASE_URL")); direct != "" {
		return direct, nil
	}

	host := strings.TrimSpace(os.Getenv("DB_HOST"))
	port := getEnvOrDefault("DB_PORT", "5432")
	user := strings.TrimSpace(os.Getenv("DB_USER"))
	password := os.Getenv("DB_PASSWORD")
	name := strings.TrimSpace(os.Getenv("DB_NAME"))
	sslMode := getEnvOrDefault("DB_SSLMODE", "disable")

	if host == "" || user == "" || name == "" {
		return "", fmt.Errorf("DATABASE_URL or DB_HOST/DB_USER/DB_NAME is required")
	}

	query := url.Values{}
	query.Set("sslmode", sslMode)

	dsn := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(user, password),
		Host:     net.JoinHostPort(host, port),
		Path:     name,
		RawQuery: query.Encode(),
	}
	return dsn.String(), nil
}

func getEnvOrDefault(key, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	return val
}
