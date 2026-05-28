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
      const clicked = event.lngLat;

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
