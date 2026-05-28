package mapbox

import (
	"fmt"

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

// GetDirections fetches the driving route between two coordinate pairs.
// Returns the first route from the Mapbox response.
func (c *Client) GetDirections(fromLng, fromLat, toLng, toLat float64) (*DirectionsRoute, error) {
	coords := fmt.Sprintf("%f,%f;%f,%f", fromLng, fromLat, toLng, toLat)

	var result directionsResponse
	resp, err := c.http.R().
		SetQueryParams(map[string]string{
			"geometries":   "geojson",
			"overview":     "full",
			"access_token": c.token,
		}).
		SetResult(&result).
		Get(fmt.Sprintf("/directions/v5/mapbox/driving/%s", coords))

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
