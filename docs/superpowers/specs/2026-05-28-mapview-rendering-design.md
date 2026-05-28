# MapView Rendering — Design Spec

Date: 2026-05-28
Status: Approved

---

## Goal

Complete Step 1 of the learning flow: render a working Mapbox map in the frontend with proper token handling and navigation controls.

---

## Scope

Frontend only. No geocoding, no directions, no backend changes.

---

## Gap Analysis (current state)

| Item | Status |
|---|---|
| Map renders with streets-v12 style | done |
| Bangkok default center | done |
| Cleanup on unmount | done |
| `mapboxgl.accessToken` set | **missing** |
| `NavigationControl` added | **missing** |
| Token var `VITE_MAPBOX_PUBLIC_TOKEN` | **missing** (currently `VITE_MAPBOX_TOKEN`) |
| `MapView.tsx` file name | **missing** (currently `Map.tsx`) |
| `.env.example` public/secret comments | **missing** |
| README security notes | **missing** |

---

## Architecture

```
Frontend (MapView.tsx)
  ↓ uses public token (pk.*)
Mapbox GL JS (renders map in browser)

Frontend
  ↓ future: HTTP to Go backend
Go API (Chi)
  ↓ uses secret token (sk.*)
Mapbox APIs
```

**Security constraint:** Frontend never uses `sk.*` token. Only `pk.*` public tokens allowed in frontend env vars.

---

## Files Changed

### `frontend/src/components/Map.tsx` → `MapView.tsx`

Rename. Update with:
- `mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN` (module level, outside useEffect)
- `map.addControl(new mapboxgl.NavigationControl())` after map init inside useEffect
- Export name: `MapView` (was `Map`)

### `frontend/src/pages/MapPage.tsx`

Update import: `Map` → `MapView`, path `../components/MapView`.

### `frontend/.env.example`

```env
# PUBLIC token (pk.*) — safe to expose in frontend
# Get from: mapbox.com → Account → Tokens
VITE_MAPBOX_PUBLIC_TOKEN=pk.your_token_here

# API base URL for Go backend
VITE_API_BASE_URL=http://localhost:8080

# NEVER put sk.* secret tokens in frontend env vars
```

### `README.md` (root)

Add:
- Token setup section explaining `pk.*` vs `sk.*`
- Security note: frontend holds only public token
- Architecture note: future API calls go through Go backend, never direct to Mapbox

---

## Component Design

```tsx
// MapView.tsx
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
}

export function MapView({ center = [100.5018, 13.7563], zoom = 10 }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);  // guard against re-init

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;  // skip if already mounted

    const map = new mapboxgl.Map({ ... });
    map.addControl(new mapboxgl.NavigationControl());
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);  // empty deps — init once only

  return <div ref={mapContainerRef} style={{ width: "100%", height: "100vh" }} />;
}
```

Note: `center` and `zoom` are init-only values. Empty `useEffect` deps prevent re-init on prop change (correct for Mapbox — re-init is expensive and causes flicker).

---

## Constraints

- No geocoding implementation
- No directions implementation
- No Redux or heavy state
- No unnecessary API calls
- `mapboxgl.accessToken` set once at module level
- `mapRef` guards against double-init (React StrictMode fires effects twice in dev)
