package config

import (
	"net/url"
	"testing"
)

func setBaseSecurityEnv(t *testing.T) {
	t.Helper()
	t.Setenv("JWT_SECRET", "test-jwt-secret-123456")
	t.Setenv("QR_HMAC_SECRET", "test-hmac-secret-123456")
	t.Setenv("APP_ENV", "development")
	t.Setenv("MIDTRANS_ENV", "")
	t.Setenv("MIDTRANS_SERVER_KEY", "")
}

func TestLoadMidtransConfigValidation(t *testing.T) {
	setBaseSecurityEnv(t)
	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/fastix?sslmode=disable")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected dev Load() to succeed without MIDTRANS_SERVER_KEY, got %v", err)
	}
	if cfg.MidtransEnv != "sandbox" {
		t.Fatalf("expected default MidtransEnv=sandbox, got %q", cfg.MidtransEnv)
	}

	t.Setenv("APP_ENV", "production")
	if _, err := Load(); err == nil {
		t.Fatal("expected error when APP_ENV=production and MIDTRANS_SERVER_KEY is empty")
	}

	t.Setenv("MIDTRANS_SERVER_KEY", "Mid-server-prod-key")
	t.Setenv("MIDTRANS_ENV", "production")
	prodCfg, err := Load()
	if err != nil {
		t.Fatalf("expected production Load() with server key to succeed, got %v", err)
	}
	if prodCfg.MidtransEnv != "production" || prodCfg.MidtransServerKey != "Mid-server-prod-key" {
		t.Fatalf("unexpected prod config: %+v", prodCfg)
	}
}

func TestResolveSplitDBConfigAndFallback(t *testing.T) {
	setBaseSecurityEnv(t)
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DB_HOST", "localhost")
	t.Setenv("DB_PORT", "5433")
	t.Setenv("DB_USER", "fastix_user")
	t.Setenv("DB_PASSWORD", "p@ss:word/123?#")
	t.Setenv("DB_NAME", "fastix")
	t.Setenv("DB_SSLMODE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected split DB_* Load() to succeed, got %v", err)
	}

	parsed, err := url.Parse(cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("parse built DatabaseURL: %v", err)
	}
	if parsed.Host != "localhost:5433" || parsed.Path != "/fastix" {
		t.Fatalf("unexpected DSN host/path: %s", cfg.DatabaseURL)
	}
	pw, ok := parsed.User.Password()
	if !ok || pw != "p@ss:word/123?#" {
		t.Fatalf("expected special-char password to round-trip, got %q (ok=%v)", pw, ok)
	}
	if parsed.Query().Get("sslmode") != "disable" {
		t.Fatalf("expected default sslmode=disable, got %q", parsed.Query().Get("sslmode"))
	}

	// DATABASE_URL overrides split DB_* variables when explicitly set
	t.Setenv("DATABASE_URL", "postgres://paas:secret@db.internal:5432/prod_db?sslmode=require")
	overrideCfg, err := Load()
	if err != nil {
		t.Fatalf("expected DATABASE_URL override to succeed, got %v", err)
	}
	if overrideCfg.DatabaseURL != "postgres://paas:secret@db.internal:5432/prod_db?sslmode=require" {
		t.Fatalf("unexpected override DSN: %s", overrideCfg.DatabaseURL)
	}

	// Missing both DATABASE_URL and DB_* must fail
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DB_HOST", "")
	if _, err := Load(); err == nil {
		t.Fatal("expected error when both DATABASE_URL and DB_HOST are missing")
	}
}
