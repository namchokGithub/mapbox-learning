package services

import (
	"math"

	"github.com/namchok/mapbox-learning/internal/mapbox"
)

// DirectionsResult is the formatted response returned to frontend.
type DirectionsResult struct {
	DistanceMeters  float64                   `json:"distanceMeters"`
	DistanceKm      float64                   `json:"distanceKm"`
	DurationSeconds float64                   `json:"durationSeconds"`
	DurationMinutes float64                   `json:"durationMinutes"`
	Geometry        mapbox.DirectionsGeometry `json:"geometry"`
}

// DirectionsService fetches and formats route data from the Mapbox client.
type DirectionsService struct {
	client *mapbox.Client
}

// NewDirectionsService creates a DirectionsService backed by the given Mapbox client.
func NewDirectionsService(client *mapbox.Client) *DirectionsService {
	return &DirectionsService{client: client}
}

// GetDirections returns a formatted road route between two coordinate pairs.
func (s *DirectionsService) GetDirections(fromLng, fromLat, toLng, toLat float64) (*DirectionsResult, error) {
	route, err := s.client.GetDirections(fromLng, fromLat, toLng, toLat)
	if err != nil {
		return nil, err
	}

	// Round to 2 decimal places for km, 1 decimal place for minutes.
	distanceKm := math.Round(route.Distance/1000*100) / 100
	durationMinutes := math.Round(route.Duration/60*10) / 10

	return &DirectionsResult{
		DistanceMeters:  route.Distance,
		DistanceKm:      distanceKm,
		DurationSeconds: route.Duration,
		DurationMinutes: durationMinutes,
		Geometry:        route.Geometry,
	}, nil
}
