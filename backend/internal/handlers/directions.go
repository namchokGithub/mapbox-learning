package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/namchok/mapbox-learning/internal/services"
)

// directionsGetter is the service interface the handler depends on.
// Using an interface enables testing without a real Mapbox token.
type directionsGetter interface {
	GetDirections(fromLng, fromLat, toLng, toLat float64) (*services.DirectionsResult, error)
}

// DirectionsHandler handles GET /api/directions requests.
type DirectionsHandler struct {
	service directionsGetter
}

// NewDirectionsHandler creates a handler backed by the given service.
func NewDirectionsHandler(service directionsGetter) *DirectionsHandler {
	return &DirectionsHandler{service: service}
}

// GetDirections validates query params, calls the service, and returns JSON.
func (h *DirectionsHandler) GetDirections(w http.ResponseWriter, r *http.Request) {
	fromLng, err := parseCoord(r, "fromLng", -180, 180)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	fromLat, err := parseCoord(r, "fromLat", -90, 90)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	toLng, err := parseCoord(r, "toLng", -180, 180)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	toLat, err := parseCoord(r, "toLat", -90, 90)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	result, err := h.service.GetDirections(fromLng, fromLat, toLng, toLat)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get directions"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func parseCoord(r *http.Request, key string, min, max float64) (float64, error) {
	val := r.URL.Query().Get(key)
	if val == "" {
		return 0, fmt.Errorf("missing required parameter: %s", key)
	}
	f, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid value for %s: must be a number", key)
	}
	if f < min || f > max {
		return 0, fmt.Errorf("invalid value for %s: must be between %g and %g", key, min, max)
	}
	return f, nil
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
