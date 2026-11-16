package response

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

type samplePayload struct {
	ID string `json:"id"`
}

func TestOKAndFailEnvelopes(t *testing.T) {
	app := fiber.New()
	app.Get("/ok", func(c *fiber.Ctx) error {
		total := 1
		return OK(c, samplePayload{ID: "v-1"}, &Meta{Total: &total})
	})
	app.Get("/fail", func(c *fiber.Ctx) error {
		return Fail(c, fiber.StatusBadRequest, "INVALID_INPUT", "Input tidak valid.", map[string]string{"field": "required"})
	})

	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test(/ok): %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	var okEnv SuccessEnvelope[samplePayload]
	if err := json.Unmarshal(body, &okEnv); err != nil {
		t.Fatalf("unmarshal ok envelope: %v", err)
	}
	if !okEnv.Success || okEnv.Data.ID != "v-1" || okEnv.Meta.Timestamp == "" || okEnv.Meta.Total == nil || *okEnv.Meta.Total != 1 {
		t.Fatalf("unexpected ok envelope: %+v", okEnv)
	}

	failReq := httptest.NewRequest(http.MethodGet, "/fail", nil)
	failResp, err := app.Test(failReq)
	if err != nil {
		t.Fatalf("app.Test(/fail): %v", err)
	}
	if failResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", failResp.StatusCode)
	}
	failBody, _ := io.ReadAll(failResp.Body)
	var errEnv ErrorEnvelope
	if err := json.Unmarshal(failBody, &errEnv); err != nil {
		t.Fatalf("unmarshal error envelope: %v", err)
	}
	if errEnv.Success || errEnv.Error.Code != "INVALID_INPUT" || errEnv.Error.Details["field"] != "required" {
		t.Fatalf("unexpected error envelope: %+v", errEnv)
	}
}
