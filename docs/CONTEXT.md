# Project Context — Go Mapbox Learning

Lightweight fullstack learning project integrating:

- Golang Backend API
- Mapbox APIs
- Vite React Frontend
- Interactive Maps and Geolocation Features

Learning goals:

- Map rendering
- Geocoding
- Directions / Routing
- Frontend map interactions
- Backend API proxy architecture
- Geo-based UI and APIs
- Fullstack communication flow

---

# Tech Stack

## Frontend

- Vite + React + TypeScript
- mapbox-gl
- Node deps managed via pnpm

## Backend

- Go (module: `github.com/namchok/mapbox-learning`)
- Chi Router (`github.com/go-chi/chi/v5`)
- Resty HTTP Client (`github.com/go-resty/resty/v2`)
- godotenv (`github.com/joho/godotenv`)

---

# Architecture

```text
Frontend (Vite React)
        ↓  HTTP (localhost:8080)
   Go API (Chi)
        ↓
   Mapbox APIs
```

Frontend NEVER calls Mapbox directly. All Mapbox communication goes through backend.

Backend responsibilities:
- proxy Mapbox API requests
- validation
- caching
- rate limiting
- response formatting
- API key protection

---

# Project Structure

```text
mapbox-learning/
├── docs/
│   └── CONTEXT.md              ← this file
├── frontend/                   ← Vite React TypeScript app
│   ├── src/
│   │   ├── components/
│   │   │   └── MapView.tsx     ← mapbox-gl map component (NavigationControl, token)
│   │   ├── hooks/              ← custom React hooks (empty, ready)
│   │   ├── pages/
│   │   │   └── MapPage.tsx     ← full-screen map page
│   │   ├── types/              ← TypeScript types (empty, ready)
│   │   ├── App.tsx             ← renders MapPage
│   │   └── main.tsx
│   ├── .env.example
│   └── package.json
└── backend/                    ← Go API server
    ├── cmd/server/
    │   └── main.go             ← entry point, chi router setup
    ├── internal/
    │   ├── handlers/
    │   │   └── health.go       ← GET /health
    │   ├── services/           ← business logic (empty, ready)
    │   ├── mapbox/             ← Mapbox API client (empty, ready)
    │   ├── middleware/         ← HTTP middleware (empty, ready)
    │   └── models/             ← data models (empty, ready)
    ├── go.mod
    ├── go.sum
    └── .env.example
```

---

# Current API Endpoints

| Method | Path      | Status | Description          |
|--------|-----------|--------|----------------------|
| GET    | /health   | done   | health check         |

Next endpoints to implement (follow learning flow order):
- GET /api/geocode?q=... — proxy Mapbox geocoding
- GET /api/directions?from=...&to=... — proxy Mapbox directions

---

# Environment Variables

## Frontend (`frontend/.env`)

```env
VITE_MAPBOX_PUBLIC_TOKEN=pk.your_public_token_here
VITE_API_BASE_URL=http://localhost:8080
```

## Backend (`backend/.env`)

```env
MAPBOX_TOKEN=your_mapbox_token_here
PORT=8080
```

Never commit real tokens. `.env` is gitignored. `.env.example` is safe to commit.

---

# Running the Project

## Backend

```bash
cd backend
cp .env.example .env   # then fill MAPBOX_TOKEN
go run ./cmd/server
# → listens on :8080
```

## Frontend

```bash
cd frontend
cp .env.example .env   # then fill VITE_MAPBOX_TOKEN
pnpm install
pnpm dev
# → http://localhost:5173
```

---

# Important Development Rules

## API Cost Awareness

Mapbox APIs have usage limits and billing costs. Minimize all requests.

DO NOT:
- spam geocoding on every keystroke
- refetch unchanged map data
- make duplicate API calls
- trigger requests during unnecessary rerenders

ALWAYS:
- debounce search inputs (min 300ms)
- cache repeated queries
- reuse existing frontend state
- avoid duplicate fetch calls
- use lazy loading where appropriate

---

# Frontend Guidelines

Keep frontend lightweight.

Prefer:
- simple React components
- isolated map components (Map.tsx pattern)
- reusable hooks in `hooks/`
- minimal global state

Avoid:
- overengineering
- heavy state management (no Redux etc. unless clearly needed)
- unnecessary abstractions

Map component pattern:
- `useRef` for map container and map instance
- `useEffect` for init/cleanup
- never re-init if map already mounted
- cleanup on unmount via `map.remove()`

---

# Backend Guidelines

Follow clean architecture — handlers call services, services call mapbox client.

```text
Handler → Service → Mapbox Client → Mapbox API
```

## Handlers (`internal/handlers/`)
- HTTP request/response only
- no business logic
- encode JSON responses

## Services (`internal/services/`)
- business logic
- orchestration
- caching strategy

## Mapbox Client (`internal/mapbox/`)
- external API communication only
- use Resty HTTP client
- read MAPBOX_TOKEN from env

---

# Performance Goals

- low Mapbox API usage
- fast map rendering
- simple architecture
- maintainable code
- minimal network traffic

---

# Learning Flow Progress

| Step | Feature              | Status  |
|------|----------------------|---------|
| 1    | Render Map           | done    |
| 2    | Add Marker           | pending |
| 3    | Click Events         | pending |
| 4    | Search Location      | pending |
| 5    | Geocoding            | pending |
| 6    | Route Directions     | pending |
| 7    | Draw Route           | pending |
| 8    | Current Location     | pending |
| 9    | Save Route           | pending |
| 10   | Optimize API Usage   | pending |

---

# Notes for AI Agents

## Code Generation Rules

- keep code simple and readable
- avoid premature optimization
- avoid unnecessary dependencies
- avoid unnecessary API calls
- prefer explicit over magic abstractions
- preserve project structure consistency
- update README.md when major features are added
- update this CONTEXT.md when completing steps or adding new files

## Handover Protocol

When context grows large or switching agents:

1. update learning flow progress table above
2. update current API endpoints table above
3. update project structure tree if new files added
4. create `docs/progress/YYYY-MM-DD-<topic>.md` summarizing completed work
5. continue incrementally from next pending step

## Key Constraints for Next Agent

- backend default port: 8080
- frontend default port: 5173 (Vite default)
- map default center: Bangkok [100.5018, 13.7563], zoom 10
- Go module path: `github.com/namchok/mapbox-learning`
- never add frontend-side Mapbox business logic
- never commit `.env` files
