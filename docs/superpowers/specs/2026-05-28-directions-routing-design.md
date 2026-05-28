# Directions Routing — Design Spec

Date: 2026-05-28
Status: Approved

---

## Goal

Implement real road routing: click two points on a map, fetch a real road route from the Mapbox Directions API via the Go backend, draw the route on the map, and display distance and ETA.

---

## Scope

- New backend endpoint: `GET /api/directions`
- New frontend page: `RoutePage` with `RouteView` component
- Simple state-based navigation in `App.tsx`
- No changes to existing `MapView.tsx`

Out of scope:
- Geocoding / search
- Multiple waypoints
- Route alternatives
- Moving-car animation (future step)

---

## Architecture

```
Frontend (RouteView.tsx)
        ↓ GET /api/directions?fromLng=&fromLat=&toLng=&toLat=
   Go API (Chi router)
        ↓ GET https://api.mapbox.com/directions/v5/mapbox/driving/{coords}
   Mapbox Directions API
```

**Security:** Backend holds `MAPBOX_SECRET_TOKEN` (`sk.*`). Frontend never touches secret token. Frontend only uses public token (`pk.*`) for map rendering.

---

## Backend

### New files

| File | Responsibility |
|---|---|
| `backend/internal/mapbox/client.go` | Resty HTTP client; calls Mapbox Directions API |
| `backend/internal/services/directions.go` | Business logic; formats response |
| `backend/internal/handlers/directions.go` | HTTP handler; validates coords; returns JSON |

### Modified files

| File | Change |
|---|---|
| `backend/cmd/server/main.go` | Register `GET /api/directions` |
| `backend/go.mod` | Add `github.com/go-resty/resty/v2` |
| `backend/.env.example` | Rename `MAPBOX_TOKEN` → `MAPBOX_SECRET_TOKEN` |

### Endpoint

```
GET /api/directions?fromLng=100.5018&fromLat=13.7563&toLng=100.5518&toLat=13.7963
```

**Query parameters:**

| Param | Type | Validation |
|---|---|---|
| `fromLng` | float64 | -180 to 180 |
| `fromLat` | float64 | -90 to 90 |
| `toLng` | float64 | -180 to 180 |
| `toLat` | float64 | -90 to 90 |

Missing or invalid params → `400 Bad Request` with JSON `{"error": "..."}`.

**Success response (200):**

```json
{
  "distanceMeters": 4123.5,
  "distanceKm": 4.12,
  "durationSeconds": 620.0,
  "durationMinutes": 10.33,
  "geometry": {
    "type": "LineString",
    "coordinates": [[100.5018, 13.7563], ...]
  }
}
```

**Error response (400/500):**

```json
{ "error": "message here" }
```

### Mapbox Directions API call

```
GET https://api.mapbox.com/directions/v5/mapbox/driving/{fromLng},{fromLat};{toLng},{toLat}
  ?geometries=geojson
  &overview=full
  &access_token={MAPBOX_SECRET_TOKEN}
```

Parse: `routes[0].distance`, `routes[0].duration`, `routes[0].geometry`.

If `routes` is empty → 500 with `{"error": "no route found"}`.

### Clean architecture layers

```
Handler → validates HTTP, calls service, encodes JSON
Service → calls Mapbox client, formats DirectionsResult
Mapbox client → HTTP call only, returns raw parsed response
```

---

## Frontend

### New files

| File | Responsibility |
|---|---|
| `frontend/src/components/RouteView.tsx` | Map + click logic + route drawing + info panel |
| `frontend/src/pages/RoutePage.tsx` | Page wrapper for RouteView |

### Modified files

| File | Change |
|---|---|
| `frontend/src/App.tsx` | Add `page` state (`'map' \| 'route'`), render MapPage or RoutePage |
| `frontend/src/pages/MapPage.tsx` | Add "Try Routing →" button linking to route page |

### App.tsx navigation

```tsx
const [page, setPage] = useState<'map' | 'route'>('map');

if (page === 'route') return <RoutePage onBack={() => setPage('map')} />;
return <MapPage onNavigateToRoute={() => setPage('route')} />;
```

### RouteView.tsx design

**State (refs only — no unnecessary re-renders):**

```
mapContainerRef   HTMLDivElement ref
mapRef            mapboxgl.Map ref
pointAMarkerRef   mapboxgl.Marker ref
pointBMarkerRef   mapboxgl.Marker ref
pointARef         mapboxgl.LngLat ref
pointBRef         mapboxgl.LngLat ref
```

**React state (panel only):**

```
routeInfo: {
  pointA: [lng, lat] | null
  pointB: [lng, lat] | null
  distanceKm: number | null
  durationMinutes: number | null
  loading: boolean
  error: string | null
}
```

**Click flow:**

```
click 1  → set point A (red marker), update panel
click 2  → set point B (yellow marker), fetch /api/directions
           → on success: draw route line, fitBounds, update panel
           → on error: show error in panel
click 3  → reset all (remove markers, clear route, reset panel)
```

**Route layer IDs:**

```
ROUTE_SOURCE_ID = "route-source"
ROUTE_LAYER_ID  = "route-layer"
```

Added on map `load` event. Route drawn by calling `setData()` on existing source (not recreating layer).

**Route line style:**

```json
{
  "line-color": "#6366f1",
  "line-width": 5,
  "line-opacity": 0.9,
  "line-cap": "round",
  "line-join": "round"
}
```

**fitBounds:** After route drawn, call `map.fitBounds(routeBounds, { padding: 80 })`.

**Info panel fields:**

```
Point A:   lat, lng (5 decimals)
Point B:   lat, lng (5 decimals)
Distance:  X.XX km
ETA:       X.X min
[error message if fetch failed]
[Loading... while fetching]
```

### API fetch

```
GET {VITE_API_BASE_URL}/api/directions?fromLng=...&fromLat=...&toLng=...&toLat=...
```

`VITE_API_BASE_URL` defaults to `http://localhost:8080` (Go backend). Read from `import.meta.env.VITE_API_BASE_URL`.

Only fetch after both points selected. No debouncing needed (fetch only on second click, not on drag).

### Cleanup on unmount

```
remove pointA marker
remove pointB marker
remove route layer (if exists)
remove route source (if exists)
remove map click listener
remove map load listener
map.remove()
mapRef.current = null
```

---

## Token

Rename `MAPBOX_TOKEN` → `MAPBOX_SECRET_TOKEN` in:
- `backend/.env.example`
- `backend/internal/mapbox/client.go` (reads from env)
- `docs/CONTEXT.md`

Existing `backend/.env` (gitignored) not touched by code — user updates manually.

---

## Constraints

- No geocoding
- No directions on every click (only after 2nd click)
- No duplicate layer/source creation
- No React Router
- No Redux or heavy state
- Max 2 markers at a time
- Fetch only after both points selected
- fitBounds optional enhancement — include if simple
