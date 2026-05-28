# mapbox-learning

Fullstack learning project: Go backend + Vite React frontend + Mapbox APIs.

## Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Frontend | Vite, React, TypeScript, mapbox-gl |
| Backend  | Go, Chi router, Resty HTTP client |

## Structure

```
mapbox-learning/
├── frontend/           # Vite React TypeScript
│   ├── src/
│   │   ├── components/ # Map and UI components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── pages/      # Page-level components
│   │   └── types/      # TypeScript types
│   └── .env.example
└── backend/            # Go API server
    ├── cmd/server/     # Entry point
    ├── internal/
    │   ├── handlers/   # HTTP handlers
    │   ├── services/   # Business logic
    │   ├── mapbox/     # Mapbox API client
    │   ├── middleware/ # HTTP middleware
    │   └── models/     # Data models
    └── .env.example
```

## Setup

### Backend

```bash
cd backend
cp .env.example .env
# fill MAPBOX_SECRET_TOKEN in .env
go run ./cmd/server
```

Health check: `GET http://localhost:8080/health`

### Frontend

```bash
cd frontend
cp .env.example .env
# fill VITE_MAPBOX_PUBLIC_TOKEN with your pk.* token
pnpm install
pnpm dev
```

Open: http://localhost:5173

## Token Setup

Mapbox provides two token types:

| Token | Prefix | Where |
|---|---|---|
| Public token | `pk.*` | Frontend `.env` — safe to expose in browser |
| Secret token | `sk.*` | Backend `.env` only — never in frontend |

**Frontend** uses `VITE_MAPBOX_PUBLIC_TOKEN` (`pk.*`) for map rendering only.  
**Backend** uses `MAPBOX_SECRET_TOKEN` (`sk.*`) for proxying geocoding/directions APIs.

Never commit `.env` files. `.env.example` files are safe to commit.

## Architecture

```
Frontend (Vite React)
        ↓
   Go API (Chi)
        ↓
   Mapbox APIs
```

Frontend uses a public Mapbox token (`pk.*`) only for rendering the map via mapbox-gl.  
All business API calls (geocoding, directions) go through the Go backend, which holds the secret token (`sk.*`).

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

**Backend responsibilities:** coordinate validation, Mapbox API proxy, response formatting.

**Token separation:**
- Frontend uses `VITE_MAPBOX_PUBLIC_TOKEN` (`pk.*`) — map rendering only
- Backend uses `MAPBOX_SECRET_TOKEN` (`sk.*`) — Directions API proxy

**Cost considerations:** Route fetched only after two points selected — one request per route. No polling.

**Straight-line vs real-road:** `MapView` shows straight-line distance (Haversine). `RouteView` fetches real road distance and drive time from Mapbox.

## Learning Flow

1. Render Map
2. Add Marker
3. Click Events
4. Straight-line Distance Measure
5. Search Location (Geocoding)
6. Route Directions
7. Draw Route on Map
8. Current Location (Geolocation)
9. Save Route
10. Optimize API Usage

## Distance Measurement

Frontend includes lightweight distance measurement inside `MapView` using `mapbox-gl` only.

- First click places point A
- Second click places point B, draws line, and shows distance in kilometers
- Third click resets old measurement and starts new one

Distance uses `LngLat.distanceTo()` for straight-line geometry on client side. This keeps feature frontend-only and avoids Directions API calls, backend traffic, and extra Mapbox request costs.

## Distance Limitation

Measured value is straight-line distance, not road distance or travel distance.

- Good for quick geometry checks
- Not suitable for turn-by-turn routing
- Real road distance will require Directions API later
