package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/namchok/mapbox-learning/internal/services"
)

// mockDirectionsService always returns success; never called for validation tests.
type mockDirectionsService struct{}

func (m *mockDirectionsService) GetDirections(_, _, _, _ float64) (*services.DirectionsResult, error) {
	return nil, nil
}

func TestGetDirections_MissingParam(t *testing.T) {
	h := NewDirectionsHandler(&mockDirectionsService{})

	req := httptest.NewRequest(http.MethodGet, "/api/directions", nil)
	rec := httptest.NewRecorder()

	h.GetDirections(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["error"] != "missing required parameter: fromLng" {
		t.Fatalf("unexpected error message: %s", body["error"])
	}
}

func TestGetDirections_InvalidCoord(t *testing.T) {
	h := NewDirectionsHandler(&mockDirectionsService{})

	req := httptest.NewRequest(http.MethodGet, "/api/directions?fromLng=not-a-number", nil)
	rec := httptest.NewRecorder()

	h.GetDirections(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestGetDirections_OutOfRangeCoord(t *testing.T) {
	h := NewDirectionsHandler(&mockDirectionsService{})

	req := httptest.NewRequest(http.MethodGet, "/api/directions?fromLng=200", nil)
	rec := httptest.NewRecorder()

	h.GetDirections(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
