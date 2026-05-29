package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"strconv"

	"github.com/namchok/mapbox-learning/internal/mapbox"
	"github.com/namchok/mapbox-learning/internal/services"
)

// directionsGetter is the service interface the handler depends on.
// Using an interface enables testing without a real Mapbox token.
type directionsGetter interface {
	GetDirections(coords []mapbox.Coordinate) (*services.DirectionsResult, error)
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

	coords := []mapbox.Coordinate{
		{Lng: fromLng, Lat: fromLat},
	}

	waypoints, err := parseWaypoints(r.URL.Query().Get("waypoints"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	coords = append(coords, waypoints...)
	coords = append(coords, mapbox.Coordinate{Lng: toLng, Lat: toLat})

	result, err := h.service.GetDirections(coords)
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

func parseWaypoints(raw string) ([]mapbox.Coordinate, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}

	parts := strings.Split(raw, ";")
	waypoints := make([]mapbox.Coordinate, 0, len(parts))

	for index, part := range parts {
		coordParts := strings.Split(strings.TrimSpace(part), ",")
		if len(coordParts) != 2 {
			return nil, fmt.Errorf("invalid waypoint at position %d: must be lng,lat", index+1)
		}

		lng, err := strconv.ParseFloat(coordParts[0], 64)
		if err != nil || lng < -180 || lng > 180 {
			return nil, fmt.Errorf("invalid waypoint longitude at position %d", index+1)
		}

		lat, err := strconv.ParseFloat(coordParts[1], 64)
		if err != nil || lat < -90 || lat > 90 {
			return nil, fmt.Errorf("invalid waypoint latitude at position %d", index+1)
		}

		waypoints = append(waypoints, mapbox.Coordinate{Lng: lng, Lat: lat})
	}

	return waypoints, nil
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
