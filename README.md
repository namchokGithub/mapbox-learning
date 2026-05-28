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
# fill MAPBOX_TOKEN in .env
go run ./cmd/server
```

Health check: `GET http://localhost:8080/health`

### Frontend

```bash
cd frontend
cp .env.example .env
# fill VITE_MAPBOX_TOKEN in .env
pnpm install
pnpm dev
```

## Architecture

```
Frontend (Vite React)
        ↓
   Go API (Chi)
        ↓
   Mapbox APIs
```

Frontend never calls Mapbox directly. All API calls go through the Go backend.

## Learning Flow

1. Render Map
2. Add Marker
3. Click Events
4. Search Location (Geocoding)
5. Route Directions
6. Draw Route on Map
7. Current Location (Geolocation)
8. Save Route
9. Optimize API Usage
