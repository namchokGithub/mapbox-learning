package mapbox

import (
	"fmt"
	"strings"

	"github.com/go-resty/resty/v2"
)

const directionsBaseURL = "https://api.mapbox.com"

// DirectionsGeometry is the GeoJSON LineString geometry from Mapbox.
type DirectionsGeometry struct {
	Type        string      `json:"type"`
	Coordinates [][]float64 `json:"coordinates"`
}

// DirectionsRoute is a single route from the Mapbox Directions API response.
type DirectionsRoute struct {
	Distance float64            `json:"distance"`
	Duration float64            `json:"duration"`
	Geometry DirectionsGeometry `json:"geometry"`
}

// Coordinate is an ordered longitude/latitude pair for route building.
type Coordinate struct {
	Lng float64
	Lat float64
}

type directionsResponse struct {
	Routes []DirectionsRoute `json:"routes"`
}

// Client wraps the Resty HTTP client for Mapbox API calls.
type Client struct {
	http  *resty.Client
	token string
}

// NewClient creates a Mapbox API client using the given secret token.
func NewClient(token string) *Client {
	return &Client{
		http:  resty.New().SetBaseURL(directionsBaseURL),
		token: token,
	}
}

// GetDirections fetches route for origin -> waypoints -> destination chain.
// Returns the first route from the Mapbox response.
func (c *Client) GetDirections(coords []Coordinate) (*DirectionsRoute, error) {
	if len(coords) < 2 {
		return nil, fmt.Errorf("at least origin and destination are required")
	}

	parts := make([]string, 0, len(coords))
	for _, coord := range coords {
		parts = append(parts, fmt.Sprintf("%f,%f", coord.Lng, coord.Lat))
	}

	var result directionsResponse
	resp, err := c.http.R().
		SetQueryParams(map[string]string{
			"geometries":   "geojson",
			"overview":     "full",
			"access_token": c.token,
		}).
		SetResult(&result).
		Get(fmt.Sprintf("/directions/v5/mapbox/driving/%s", strings.Join(parts, ";")))

	if err != nil {
		return nil, fmt.Errorf("mapbox request failed: %w", err)
	}
	if resp.IsError() {
		return nil, fmt.Errorf("mapbox returned status %d: %s", resp.StatusCode(), resp.String())
	}
	if len(result.Routes) == 0 {
		return nil, fmt.Errorf("no route found")
	}

	return &result.Routes[0], nil
}
