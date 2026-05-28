# Directions Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real road routing — click two map points, fetch route from Mapbox Directions API via Go backend, draw the route on the map, show distance + ETA.

**Architecture:** New Go backend `GET /api/directions` proxies Mapbox Directions API using Resty HTTP client, following the Handler → Service → MapboxClient layered pattern. New frontend `RouteView.tsx` component handles click logic, API fetch, GeoJSON route drawing, and info panel. `App.tsx` uses simple state-based page navigation (`'map' | 'route'`) — no React Router needed.

**Tech Stack:** Go 1.24, Chi v5, Resty v2, Vite + React 19 + TypeScript, mapbox-gl v3

> **No commits.** Backend: verify with `curl`. Frontend: verify visually in browser.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `backend/internal/mapbox/client.go` | Resty HTTP client; single Mapbox API call |
| Create | `backend/internal/services/directions.go` | formats raw route → DirectionsResult |
| Create | `backend/internal/handlers/directions.go` | validates params, calls service, JSON response |
| Modify | `backend/go.mod` + `go.sum` | add resty v2 |
| Modify | `backend/cmd/server/main.go` | wire deps, register `GET /api/directions` |
| Modify | `backend/.env.example` | rename MAPBOX_TOKEN → MAPBOX_SECRET_TOKEN |
| Create | `frontend/src/components/RouteView.tsx` | map + click + fetch + draw + panel |
| Create | `frontend/src/pages/RoutePage.tsx` | page wrapper with onBack prop |
| Modify | `frontend/src/App.tsx` | page state, render MapPage or RoutePage |
| Modify | `frontend/src/pages/MapPage.tsx` | add onNavigateToRoute prop + nav button |
| Modify | `docs/CONTEXT.md` | update learning flow, file tree, env vars |
| Modify | `README.md` | add routing architecture + directions API section |

---

## Task 1: Add Resty to go.mod

**Files:**
- Modify: `backend/go.mod`
- Modify: `backend/go.sum`

- [ ] **Step 1: Add resty dependency**

Run from `backend/`:
```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/backend
go get github.com/go-resty/resty/v2
```

Expected output: `go: added github.com/go-resty/resty/v2 v2.x.x`

- [ ] **Step 2: Verify go.mod**

```bash
grep resty go.mod
```

Expected: `github.com/go-resty/resty/v2 v2.x.x`

- [ ] **Step 3: Verify build still passes**

```bash
go build ./...
```

Expected: no output (success).

---

## Task 2: Mapbox client

**Files:**
- Create: `backend/internal/mapbox/client.go`

- [ ] **Step 1: Create `backend/internal/mapbox/client.go`**

```go
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
		return nil, fmt.Errorf("mapbox returned status %d", resp.StatusCode())
	}
	if len(result.Routes) == 0 {
		return nil, fmt.Errorf("no route found")
	}

	return &result.Routes[0], nil
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/backend && go build ./...
```

Expected: no output.

---

## Task 3: Directions service

**Files:**
- Create: `backend/internal/services/directions.go`

- [ ] **Step 1: Create `backend/internal/services/directions.go`**

```go
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
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/backend && go build ./...
```

Expected: no output.

---

## Task 4: Directions handler

**Files:**
- Create: `backend/internal/handlers/directions.go`

- [ ] **Step 1: Create `backend/internal/handlers/directions.go`**

```go
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
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/backend && go build ./...
```

Expected: no output.

- [ ] **Step 3: Write handler validation tests**

Create `backend/internal/handlers/directions_test.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/namchok/mapbox-learning/internal/services"
)

// mockDirectionsService always returns an error (never called for validation tests).
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
	json.NewDecoder(rec.Body).Decode(&body)
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
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/backend && go test ./internal/handlers/... -v
```

Expected:
```
--- PASS: TestGetDirections_MissingParam
--- PASS: TestGetDirections_InvalidCoord
--- PASS: TestGetDirections_OutOfRangeCoord
PASS
```

---

## Task 5: Wire backend in main.go

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Replace `backend/cmd/server/main.go` with wired version**

```go
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/namchok/mapbox-learning/internal/handlers"
	"github.com/namchok/mapbox-learning/internal/mapbox"
	"github.com/namchok/mapbox-learning/internal/services"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file, reading from environment")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mapboxToken := os.Getenv("MAPBOX_SECRET_TOKEN")
	if mapboxToken == "" {
		log.Fatal("MAPBOX_SECRET_TOKEN is required")
	}

	mapboxClient := mapbox.NewClient(mapboxToken)
	directionsService := services.NewDirectionsService(mapboxClient)
	directionsHandler := handlers.NewDirectionsHandler(directionsService)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Route("/api", func(api chi.Router) {
		api.Get("/health", handlers.Health)
		api.Get("/directions", directionsHandler.GetDirections)
	})

	log.Printf("server listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 2: Update `backend/.env` — rename token key**

Edit `backend/.env` (already exists, gitignored):
- Rename `MAPBOX_TOKEN=<value>` → `MAPBOX_SECRET_TOKEN=<value>`
- Keep the same token value

- [ ] **Step 3: Build and run server**

```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/backend && go build ./... && go run ./cmd/server
```

Expected: `server listening on :8080`

- [ ] **Step 4: Curl health check**

```bash
curl http://localhost:8080/api/health
```

Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 5: Curl directions (Bangkok → airport)**

```bash
curl "http://localhost:8080/api/directions?fromLng=100.5018&fromLat=13.7563&toLng=100.7501&toLat=13.6900"
```

Expected (shape):
```json
{
  "distanceMeters": ...,
  "distanceKm": ...,
  "durationSeconds": ...,
  "durationMinutes": ...,
  "geometry": { "type": "LineString", "coordinates": [[...], ...] }
}
```

- [ ] **Step 6: Curl bad request**

```bash
curl "http://localhost:8080/api/directions?fromLng=abc"
```

Expected: `{"error":"invalid value for fromLng: must be a number"}`

---

## Task 6: Update backend .env.example

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Replace content of `backend/.env.example`**

```env
# Mapbox secret token (sk.*) — NEVER commit real tokens, NEVER use in frontend
# Get from: mapbox.com → Account → Tokens → Create a secret token
MAPBOX_SECRET_TOKEN=sk.your_secret_token_here

PORT=8080
```

---

## Task 7: Update App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace content of `frontend/src/App.tsx`**

```tsx
import { useState } from "react";
import { MapPage } from "./pages/MapPage";
import { RoutePage } from "./pages/RoutePage";

type Page = "map" | "route";

function App() {
  const [page, setPage] = useState<Page>("map");

  if (page === "route") {
    return <RoutePage onBack={() => setPage("map")} />;
  }
  return <MapPage onNavigateToRoute={() => setPage("route")} />;
}

export default App;
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/frontend && pnpm tsc --noEmit 2>&1
```

Expected: errors about missing `onNavigateToRoute` prop in `MapPage` and missing `RoutePage` module — these are expected at this stage, resolved in later tasks.

---

## Task 8: Update MapPage.tsx

**Files:**
- Modify: `frontend/src/pages/MapPage.tsx`

- [ ] **Step 1: Replace content of `frontend/src/pages/MapPage.tsx`**

```tsx
import { MapView } from "../components/MapView";

interface MapPageProps {
  onNavigateToRoute: () => void;
}

export function MapPage({ onNavigateToRoute }: MapPageProps) {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <MapView />
      <button
        onClick={onNavigateToRoute}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          padding: "8px 16px",
          borderRadius: 8,
          border: "none",
          backgroundColor: "#6366f1",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: 14,
          boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
        }}
      >
        Try Routing →
      </button>
    </div>
  );
}
```

---

## Task 9: Create RoutePage.tsx

**Files:**
- Create: `frontend/src/pages/RoutePage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/RoutePage.tsx`**

```tsx
import { RouteView } from "../components/RouteView";

interface RoutePageProps {
  onBack: () => void;
}

export function RoutePage({ onBack }: RoutePageProps) {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <RouteView onBack={onBack} />
    </div>
  );
}
```

---

## Task 10: Create RouteView.tsx

**Files:**
- Create: `frontend/src/components/RouteView.tsx`

This is the main component. It initialises a Mapbox map, handles 3-click flow (set A → set B + fetch → reset), draws the GeoJSON route, and shows an info panel.

- [ ] **Step 1: Create `frontend/src/components/RouteView.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Public token — same as MapView.tsx. Set here so RouteView works standalone.
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

const ROUTE_SOURCE_ID = "route-source";
const ROUTE_LAYER_ID = "route-layer";
const DEFAULT_CENTER: [number, number] = [100.5018, 13.7563];

// Avoid GeoJSON namespace — use explicit local types that match the API response.
interface LineStringGeometry {
  type: string;
  coordinates: number[][];
}

interface DirectionsApiResponse {
  distanceKm: number;
  durationMinutes: number;
  geometry: LineStringGeometry;
}

interface RouteInfo {
  pointA: [number, number] | null;
  pointB: [number, number] | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  loading: boolean;
  error: string | null;
}

const INITIAL_ROUTE_INFO: RouteInfo = {
  pointA: null,
  pointB: null,
  distanceKm: null,
  durationMinutes: null,
  loading: false,
  error: null,
};

interface RouteViewProps {
  onBack: () => void;
}

export function RouteView({ onBack }: RouteViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pointAMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pointBMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pointARef = useRef<mapboxgl.LngLat | null>(null);
  const pointBRef = useRef<mapboxgl.LngLat | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo>(INITIAL_ROUTE_INFO);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: 10,
    });

    map.addControl(new mapboxgl.NavigationControl());
    mapRef.current = map;

    const clearRoute = () => {
      const source = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | null;
      source?.setData({ type: "FeatureCollection", features: [] });
    };

    const drawRoute = (geometry: LineStringGeometry) => {
      const source = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | null;
      source?.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: geometry.coordinates },
        properties: {},
      });

      if (geometry.coordinates.length > 1) {
        const bounds = geometry.coordinates.reduce(
          (acc, coord) => acc.extend(coord as [number, number]),
          new mapboxgl.LngLatBounds(
            geometry.coordinates[0] as [number, number],
            geometry.coordinates[0] as [number, number],
          ),
        );
        map.fitBounds(bounds, { padding: 80 });
      }
    };

    const clearMarkers = () => {
      pointAMarkerRef.current?.remove();
      pointBMarkerRef.current?.remove();
      pointAMarkerRef.current = null;
      pointBMarkerRef.current = null;
      pointARef.current = null;
      pointBRef.current = null;
    };

    const placePointA = (lngLat: mapboxgl.LngLat) => {
      pointAMarkerRef.current?.remove();
      pointARef.current = lngLat;
      pointAMarkerRef.current = new mapboxgl.Marker({ color: "#ef4444" })
        .setLngLat(lngLat)
        .addTo(map);
    };

    const placePointB = (lngLat: mapboxgl.LngLat) => {
      pointBMarkerRef.current?.remove();
      pointBRef.current = lngLat;
      pointBMarkerRef.current = new mapboxgl.Marker({ color: "#eab308" })
        .setLngLat(lngLat)
        .addTo(map);
    };

    const fetchDirections = async (
      pointA: mapboxgl.LngLat,
      pointB: mapboxgl.LngLat,
    ) => {
      setRouteInfo((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
        const url =
          `${base}/api/directions` +
          `?fromLng=${pointA.lng}&fromLat=${pointA.lat}` +
          `&toLng=${pointB.lng}&toLat=${pointB.lat}`;

        const resp = await fetch(url);

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({ error: "request failed" }));
          throw new Error((body as { error?: string }).error ?? "request failed");
        }

        const data = (await resp.json()) as DirectionsApiResponse;

        drawRoute(data.geometry);
        setRouteInfo({
          pointA: [pointA.lng, pointA.lat],
          pointB: [pointB.lng, pointB.lat],
          distanceKm: data.distanceKm,
          durationMinutes: data.durationMinutes,
          loading: false,
          error: null,
        });
      } catch (err) {
        setRouteInfo((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "unknown error",
        }));
      }
    };

    const handleMapLoad = () => {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#6366f1",
          "line-width": 5,
          "line-opacity": 0.9,
        },
      });
    };

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      const clicked = new mapboxgl.LngLat(event.lngLat.lng, event.lngLat.lat);

      // Third click: reset everything, then set new point A
      if (pointARef.current && pointBRef.current) {
        clearMarkers();
        clearRoute();
        placePointA(clicked);
        setRouteInfo({ ...INITIAL_ROUTE_INFO, pointA: [clicked.lng, clicked.lat] });
        return;
      }

      // First click: set point A
      if (!pointARef.current) {
        placePointA(clicked);
        setRouteInfo({ ...INITIAL_ROUTE_INFO, pointA: [clicked.lng, clicked.lat] });
        return;
      }

      // Second click: set point B and fetch route
      placePointB(clicked);
      setRouteInfo((prev) => ({ ...prev, pointB: [clicked.lng, clicked.lat] }));
      fetchDirections(pointARef.current, clicked);
    };

    map.on("load", handleMapLoad);
    map.on("click", handleMapClick);

    return () => {
      map.off("load", handleMapLoad);
      map.off("click", handleMapClick);
      pointAMarkerRef.current?.remove();
      pointBMarkerRef.current?.remove();
      pointAMarkerRef.current = null;
      pointBMarkerRef.current = null;
      pointARef.current = null;
      pointBRef.current = null;
      if (map.isStyleLoaded()) {
        if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
        if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          padding: "8px 16px",
          borderRadius: 8,
          border: "none",
          backgroundColor: "rgba(255,255,255,0.92)",
          color: "#374151",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: 14,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        ← Back
      </button>

      {/* Info panel */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 1,
          width: "min(280px, calc(100% - 100px))",
          padding: "12px 14px",
          borderRadius: 12,
          backgroundColor: "rgba(255,255,255,0.94)",
          boxShadow: "0 10px 30px rgba(15,23,42,0.15)",
          color: "#0f172a",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Route Planner</div>
        <div>
          A:{" "}
          {routeInfo.pointA
            ? `${routeInfo.pointA[1].toFixed(5)}, ${routeInfo.pointA[0].toFixed(5)}`
            : "Click map to set"}
        </div>
        <div>
          B:{" "}
          {routeInfo.pointB
            ? `${routeInfo.pointB[1].toFixed(5)}, ${routeInfo.pointB[0].toFixed(5)}`
            : "Click map to set"}
        </div>

        {routeInfo.loading && (
          <div style={{ marginTop: 8, color: "#6366f1", fontWeight: 600 }}>
            Loading route...
          </div>
        )}

        {routeInfo.error && (
          <div style={{ marginTop: 8, color: "#ef4444" }}>{routeInfo.error}</div>
        )}

        {!routeInfo.loading && !routeInfo.error && routeInfo.distanceKm !== null && (
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontWeight: 600 }}>
              Distance: {routeInfo.distanceKm.toFixed(2)} km
            </div>
            <div style={{ fontWeight: 600 }}>
              ETA:{" "}
              {routeInfo.durationMinutes !== null
                ? routeInfo.durationMinutes.toFixed(1)
                : "-"}{" "}
              min
            </div>
          </div>
        )}

        {routeInfo.pointA && routeInfo.pointB && !routeInfo.loading && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>
            Click again to reset
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/frontend && pnpm tsc --noEmit 2>&1
```

Expected: no errors.

---

## Task 11: Update docs/CONTEXT.md and README.md

**Files:**
- Modify: `docs/CONTEXT.md`
- Modify: `README.md`

### CONTEXT.md changes

- [ ] **Step 1: Update Learning Flow Progress table in `docs/CONTEXT.md`**

Find:
```
| 2    | Add Marker           | pending |
| 3    | Click Events         | pending |
| 4    | Search Location      | pending |
| 5    | Geocoding            | pending |
| 6    | Route Directions     | pending |
| 7    | Draw Route           | pending |
```

Replace with:
```
| 2    | Add Marker           | done    |
| 3    | Click Events         | done    |
| 4    | Search Location      | pending |
| 5    | Geocoding            | pending |
| 6    | Route Directions     | done    |
| 7    | Draw Route           | done    |
```

- [ ] **Step 2: Update Project Structure tree in `docs/CONTEXT.md`**

Find:
```
│   │   │   └── MapView.tsx     ← mapbox-gl map component (NavigationControl, token)
```

Replace with:
```
│   │   │   ├── MapView.tsx     ← straight-line distance measurement
│   │   │   └── RouteView.tsx   ← real-road routing, directions, route drawing
```

Find:
```
│   │   ├── pages/
│   │   │   └── MapPage.tsx     ← full-screen map page
```

Replace with:
```
│   │   ├── pages/
│   │   │   ├── MapPage.tsx     ← distance measure page
│   │   │   └── RoutePage.tsx   ← route planning page
```

- [ ] **Step 3: Update Environment Variables in `docs/CONTEXT.md`**

Find:
```
VITE_MAPBOX_PUBLIC_TOKEN=pk.your_public_token_here
VITE_API_BASE_URL=http://localhost:8080
```

(no change needed for frontend env vars)

Find:
```
MAPBOX_TOKEN=your_mapbox_token_here
PORT=8080
```

Replace with:
```
MAPBOX_SECRET_TOKEN=sk.your_secret_token_here
PORT=8080
```

- [ ] **Step 4: Update Current API Endpoints table in `docs/CONTEXT.md`**

Find:
```
| GET    | /health   | done   | health check         |
```

Replace with:
```
| GET    | /health                  | done   | health check                     |
| GET    | /api/directions          | done   | proxy Mapbox Directions API      |
```

### README.md changes

- [ ] **Step 5: Add Routing Architecture section to `README.md`**

Append before the Learning Flow section:

```markdown
## Routing Architecture

```
Browser click (lat/lng)
        ↓
  RouteView.tsx (frontend)
        ↓  GET /api/directions?fromLng=...&fromLat=...&toLng=...&toLat=...
  Go backend (Chi)
        ↓  GET https://api.mapbox.com/directions/v5/mapbox/driving/...
  Mapbox Directions API
        ↓
  GeoJSON LineString route
```

**Frontend responsibilities:** map rendering, click interaction, route drawing (GeoJSON layer), info panel display.

**Backend responsibilities:** coordinate validation, Mapbox API proxy, response formatting. Designed for future caching and rate limiting.

**Token separation:**
- Frontend uses `VITE_MAPBOX_PUBLIC_TOKEN` (`pk.*`) — map rendering only
- Backend uses `MAPBOX_SECRET_TOKEN` (`sk.*`) — Directions API proxy

**Cost considerations:** Route is fetched only after two points are selected (one request per route). No polling, no debounce needed (fetch is click-triggered, not input-triggered).

**Straight-line vs real-road:** The distance measurement page (`MapView`) shows straight-line (as-the-crow-flies) distance using the Haversine formula. The routing page (`RouteView`) fetches real road distance and drive time from Mapbox.
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Ensure backend is running**

```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/backend && go run ./cmd/server
```

Expected: `server listening on :8080`

- [ ] **Step 2: Ensure frontend is running**

```bash
cd /Users/socket9companylimited/Documents/playground/mapbox-learning/frontend && pnpm dev
```

Expected: `http://localhost:5173`

- [ ] **Step 3: Test MapPage navigation**

Open http://localhost:5173. Verify:
- Bangkok map renders
- "Try Routing →" purple button visible top-right
- Click button → navigates to Route Planner page

- [ ] **Step 4: Test route flow**

On Route Planner page:
- Info panel shows "Route Planner" with empty A/B fields
- Click anywhere on map → red marker appears, point A coordinates shown
- Click second location → yellow marker appears, "Loading route..." shown briefly
- Route appears as purple/indigo line on real roads
- Map fits bounds to show full route
- Distance (km) and ETA (min) shown in panel
- "Click again to reset" hint shown

- [ ] **Step 5: Test reset**

Click map a third time → all markers removed, route cleared, panel reset to initial state. Click starts new route from new point A.

- [ ] **Step 6: Test back navigation**

Click "← Back" button → returns to MapPage with distance measurement map.

- [ ] **Step 7: Check browser console**

No errors. No duplicate layer/source warnings.
