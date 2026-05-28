# MapView Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Step 1 of the learning flow — render a working fullscreen Mapbox map with navigation controls, proper token handling, and correct env var naming.

**Architecture:** Rename `Map.tsx` → `MapView.tsx`, add `mapboxgl.accessToken` at module level, add `NavigationControl` and a `mapRef` guard against double-init. Update `MapPage.tsx` import, `.env.example`, and root `README.md`.

**Tech Stack:** Vite, React 18, TypeScript, mapbox-gl

> **Note:** No commits per user instruction. Verify each task visually in the browser.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `frontend/src/components/MapView.tsx` | Fullscreen map, token, nav controls |
| Delete | `frontend/src/components/Map.tsx` | Replaced by MapView.tsx |
| Modify | `frontend/src/pages/MapPage.tsx` | Update import |
| Modify | `frontend/.env.example` | Rename var, add pk/sk comments |
| Modify | `README.md` | Token setup + security notes |

---

## Task 1: Create `MapView.tsx`

**Files:**
- Create: `frontend/src/components/MapView.tsx`

- [ ] **Step 1: Write `MapView.tsx`**

```tsx
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Public token (pk.*) — safe to use in frontend
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
}

export function MapView({ center = [100.5018, 13.7563], zoom = 10 }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: center,
      zoom: zoom,
    });

    map.addControl(new mapboxgl.NavigationControl());
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{ width: "100%", height: "100vh" }}
    />
  );
}
```

- [ ] **Step 2: Verify file saved, no TypeScript errors**

Run from `frontend/`:
```bash
pnpm tsc --noEmit
```
Expected: no errors (zero output).

---

## Task 2: Update `MapPage.tsx` import

**Files:**
- Modify: `frontend/src/pages/MapPage.tsx`

- [ ] **Step 1: Update import**

Replace current content of `frontend/src/pages/MapPage.tsx`:

```tsx
import { MapView } from "../components/MapView";

export function MapPage() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <MapView />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```
Expected: no errors.

---

## Task 3: Delete old `Map.tsx`

**Files:**
- Delete: `frontend/src/components/Map.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm frontend/src/components/Map.tsx
```

- [ ] **Step 2: Verify no imports remain**

```bash
grep -r "from.*components/Map\"" frontend/src/
```
Expected: no output (zero matches).

- [ ] **Step 3: Verify TypeScript still clean**

```bash
cd frontend && pnpm tsc --noEmit
```
Expected: no errors.

---

## Task 4: Update `frontend/.env.example`

**Files:**
- Modify: `frontend/.env.example`

- [ ] **Step 1: Replace content**

New content for `frontend/.env.example`:

```env
# PUBLIC token (pk.*) — safe to expose in frontend builds
# Get from: mapbox.com → Account → Tokens → Create a token
# NEVER use sk.* secret tokens here — secret tokens belong only in backend/.env
VITE_MAPBOX_PUBLIC_TOKEN=pk.your_token_here

# Go backend base URL
VITE_API_BASE_URL=http://localhost:8080
```

---

## Task 5: Update root `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace Frontend setup section**

Find this block in `README.md`:

```markdown
### Frontend

```bash
cd frontend
cp .env.example .env
# fill VITE_MAPBOX_TOKEN in .env
pnpm install
pnpm dev
```
```

Replace with:

```markdown
### Frontend

```bash
cd frontend
cp .env.example .env
# fill VITE_MAPBOX_PUBLIC_TOKEN with your pk.* token
pnpm install
pnpm dev
```

Open: http://localhost:5173
```

- [ ] **Step 2: Add Token Setup section after Setup**

Insert after the Setup section and before Architecture:

```markdown
## Token Setup

Mapbox provides two token types:

| Token | Prefix | Where |
|---|---|---|
| Public token | `pk.*` | Frontend `.env` — safe to expose in browser |
| Secret token | `sk.*` | Backend `.env` only — never in frontend |

**Frontend** uses `VITE_MAPBOX_PUBLIC_TOKEN` (`pk.*`) for map rendering only.  
**Backend** uses `MAPBOX_TOKEN` (`sk.*`) for proxying geocoding/directions APIs.

Never commit `.env` files. `.env.example` files are safe to commit.
```

- [ ] **Step 3: Update Architecture section**

Find:
```markdown
Frontend never calls Mapbox directly. All API calls go through the Go backend.
```

Replace with:
```markdown
Frontend uses a public Mapbox token (`pk.*`) only for rendering the map via mapbox-gl.  
All business API calls (geocoding, directions) go through the Go backend, which holds the secret token (`sk.*`).
```

---

## Task 6: Visual Verification

- [ ] **Step 1: Copy env and set token**

```bash
cd frontend
cp .env.example .env
# Edit .env: set VITE_MAPBOX_PUBLIC_TOKEN=pk.<your_real_token>
```

- [ ] **Step 2: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 3: Open browser**

Open http://localhost:5173

Expected:
- Fullscreen map of Bangkok centered at zoom 10
- Navigation controls (zoom +/- buttons + compass) visible top-right
- Streets style (roads, labels, etc.)
- No console errors about missing token

- [ ] **Step 4: Check React StrictMode double-init guard**

Open browser DevTools → Console.  
Expected: map initializes once (no duplicate Mapbox init warnings).

---

## Task 7: Update `docs/CONTEXT.md`

**Files:**
- Modify: `docs/CONTEXT.md`

- [ ] **Step 1: Update Learning Flow Progress table**

Find:
```markdown
| 1    | Render Map           | pending |
```

Replace with:
```markdown
| 1    | Render Map           | done    |
```

- [ ] **Step 2: Update Project Structure tree**

Find:
```markdown
│   │   │   └── Map.tsx         ← mapbox-gl map component (NavigationControl)
```

Replace with:
```markdown
│   │   │   └── MapView.tsx     ← mapbox-gl map component (NavigationControl, token)
```

- [ ] **Step 3: Update Environment Variables section**

Find:
```markdown
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

Replace with:
```markdown
VITE_MAPBOX_PUBLIC_TOKEN=pk.your_public_token_here
```
