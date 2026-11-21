package config

import "testing"

func TestLoadMidtransConfigValidation(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/fastix?sslmode=disable")
	t.Setenv("JWT_SECRET", "test-jwt-secret-123456")
	t.Setenv("QR_HMAC_SECRET", "test-hmac-secret-123456")
	t.Setenv("APP_ENV", "development")
	t.Setenv("MIDTRANS_ENV", "")
	t.Setenv("MIDTRANS_SERVER_KEY", "")

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
