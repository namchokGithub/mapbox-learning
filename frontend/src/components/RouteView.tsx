import { useEffect, useRef, useState, type MutableRefObject } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ActionModePanel } from "./route-playground/ActionModePanel";
import { MockGpsPanel } from "./route-playground/MockGpsPanel";
import { VehicleSimulationPanel } from "./route-playground/VehicleSimulationPanel";
import { useVehicleSimulation } from "../hooks/useVehicleSimulation";
import type {
  ActionMode,
  DirectionsApiResponse,
  LngLatTuple,
  MarkerPoint,
  RouteInfo,
} from "../types/navigation";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

const ROUTE_SOURCE_ID = "route-source";
const ROUTE_LAYER_ID = "route-layer";
const DEFAULT_CENTER: LngLatTuple = [100.5018, 13.7563];
const EMPTY_ROUTE_DATA = {
  type: "FeatureCollection" as const,
  features: [],
};
const INITIAL_ROUTE_INFO: RouteInfo = {
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
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const vehicleMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeCacheRef = useRef(new Map<string, DirectionsApiResponse>());
  const modeRef = useRef<ActionMode>("select");
  const originRef = useRef<MarkerPoint | null>(null);
  const destinationRef = useRef<MarkerPoint | null>(null);
  const waypointsRef = useRef<MarkerPoint[]>([]);
  const teleportRef = useRef<(coordinate: LngLatTuple, snapToRoute?: boolean) => void>(
    () => {},
  );

  const [mode, setMode] = useState<ActionMode>("select");
  const [origin, setOrigin] = useState<MarkerPoint | null>(null);
  const [destination, setDestination] = useState<MarkerPoint | null>(null);
  const [waypoints, setWaypoints] = useState<MarkerPoint[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo>(INITIAL_ROUTE_INFO);
  const [routeData, setRouteData] = useState<DirectionsApiResponse | null>(null);
  const activeRouteData = origin && destination ? routeData : null;
  const activeRouteInfo = origin && destination ? routeInfo : INITIAL_ROUTE_INFO;

  const {
    simulation,
    start,
    pause,
    reset,
    replay,
    setSpeed,
    teleportTo,
  } = useVehicleSimulation(
    activeRouteData?.geometry ?? null,
    activeRouteData?.durationSeconds ?? null,
  );

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    teleportRef.current = teleportTo;
  }, [teleportTo]);

  useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

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

    const handleMapLoad = () => {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: EMPTY_ROUTE_DATA,
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
          "line-color": "#0f766e",
          "line-width": 5,
          "line-opacity": 0.88,
        },
      });
    };

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      const clicked: LngLatTuple = [event.lngLat.lng, event.lngLat.lat];

      switch (modeRef.current) {
        case "set-origin":
          setOrigin({
            id: "origin",
            label: "Origin",
            lngLat: clicked,
          });
          return;
        case "set-destination":
          setDestination({
            id: "destination",
            label: "Destination",
            lngLat: clicked,
          });
          return;
        case "add-waypoint":
          setWaypoints((prev) =>
            normalizeWaypoints([
              ...prev,
              createWaypoint(clicked, prev.length + 1),
            ]),
          );
          return;
        case "remove-marker":
          removeNearestMarker(map, clicked, originRef.current, destinationRef.current, waypointsRef.current, {
            onRemoveOrigin: () => setOrigin(null),
            onRemoveDestination: () => setDestination(null),
            onRemoveWaypoint: (waypointId) =>
              setWaypoints((prev) =>
                normalizeWaypoints(prev.filter((waypoint) => waypoint.id !== waypointId)),
              ),
          });
          return;
        case "vehicle-simulation":
          teleportRef.current(clicked, false);
          return;
        case "select":
        default:
          return;
      }
    };

    map.on("load", handleMapLoad);
    map.on("click", handleMapClick);

    return () => {
      map.off("load", handleMapLoad);
      map.off("click", handleMapClick);
      clearAllMarkers(
        originMarkerRef,
        destinationMarkerRef,
        waypointMarkersRef,
        vehicleMarkerRef,
      );
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    syncStaticMarkers(
      map,
      origin,
      destination,
      waypoints,
      originMarkerRef,
      destinationMarkerRef,
      waypointMarkersRef,
    );
  }, [origin, destination, waypoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!activeRouteData) {
      const source = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | null;
      source?.setData(EMPTY_ROUTE_DATA);
      return;
    }

    const source = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | null;
    source?.setData({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: activeRouteData.geometry.coordinates,
      },
      properties: {},
    });

    if (activeRouteData.geometry.coordinates.length > 1) {
      const bounds = activeRouteData.geometry.coordinates.reduce(
        (acc, coord) => acc.extend(coord as [number, number]),
        new mapboxgl.LngLatBounds(
          activeRouteData.geometry.coordinates[0] as [number, number],
          activeRouteData.geometry.coordinates[0] as [number, number],
        ),
      );
      map.fitBounds(bounds, { padding: 90 });
    }
  }, [activeRouteData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!simulation.currentCoordinate) {
      vehicleMarkerRef.current?.remove();
      vehicleMarkerRef.current = null;
      return;
    }

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = new mapboxgl.Marker({
        element: createVehicleElement(),
        anchor: "center",
      })
        .setLngLat(simulation.currentCoordinate)
        .addTo(map);
    } else {
      vehicleMarkerRef.current.setLngLat(simulation.currentCoordinate);
    }

    const markerElement = vehicleMarkerRef.current.getElement();
    markerElement.style.transform = `rotate(${simulation.bearing}deg)`;
  }, [simulation.bearing, simulation.currentCoordinate]);

  useEffect(() => {
    const originPoint = origin?.lngLat;
    const destinationPoint = destination?.lngLat;

    if (!originPoint || !destinationPoint) {
      return;
    }

    const requestKey = buildRouteRequestKey(originPoint, destinationPoint, waypoints);
    const cached = routeCacheRef.current.get(requestKey);
    if (cached) {
      setRouteData(cached);
      setRouteInfo({
        distanceKm: cached.distanceKm,
        durationMinutes: cached.durationMinutes,
        loading: false,
        error: null,
      });
      return;
    }

    const controller = new AbortController();

    setRouteInfo((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    const loadRoute = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
        const url = buildDirectionsUrl(base, originPoint, destinationPoint, waypoints);
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          const body = await response
            .json()
            .catch(() => ({ error: "request failed" }));
          throw new Error(
            (body as { error?: string }).error ?? "request failed",
          );
        }

        const data = (await response.json()) as DirectionsApiResponse;
        routeCacheRef.current.set(requestKey, data);
        setRouteData(data);
        setRouteInfo({
          distanceKm: data.distanceKm,
          durationMinutes: data.durationMinutes,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setRouteData(null);
        setRouteInfo({
          distanceKm: null,
          durationMinutes: null,
          loading: false,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    };

    loadRoute();

    return () => controller.abort();
  }, [destination, origin, waypoints]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      <ActionModePanel mode={mode} onModeChange={setMode} />

      <button
        onClick={onBack}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          padding: "9px 16px",
          borderRadius: 10,
          border: "none",
          backgroundColor: "rgba(255,255,255,0.94)",
          color: "#334155",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(15,23,42,0.16)",
        }}
      >
        ← Back
      </button>

      <VehicleSimulationPanel
        routeInfo={activeRouteInfo}
        currentCoordinate={simulation.currentCoordinate}
        simulation={simulation}
        onStart={start}
        onPause={pause}
        onReset={reset}
        onReplay={replay}
        onSpeedChange={setSpeed}
      />

      <MockGpsPanel
        currentCoordinate={simulation.currentCoordinate}
        mode={mode}
        waypoints={waypoints}
        onModeChange={setMode}
        onMoveVehicleToWaypoint={(waypoint) => teleportTo(waypoint.lngLat, true)}
        onMoveVehicleToOrigin={() => {
          if (origin) teleportTo(origin.lngLat, true);
        }}
        onMoveVehicleToDestination={() => {
          if (destination) teleportTo(destination.lngLat, true);
        }}
      />
    </div>
  );
}

function createWaypoint(lngLat: LngLatTuple, position: number): MarkerPoint {
  return {
    id: `waypoint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: `W${position}`,
    lngLat,
  };
}

function normalizeWaypoints(waypoints: MarkerPoint[]) {
  return waypoints.map((waypoint, index) => ({
    ...waypoint,
    label: `W${index + 1}`,
  }));
}

function buildRouteRequestKey(
  origin: LngLatTuple,
  destination: LngLatTuple,
  waypoints: MarkerPoint[],
) {
  return [
    origin.join(","),
    ...waypoints.map((waypoint) => waypoint.lngLat.join(",")),
    destination.join(","),
  ].join(";");
}

function buildDirectionsUrl(
  base: string,
  origin: LngLatTuple,
  destination: LngLatTuple,
  waypoints: MarkerPoint[],
) {
  const url = new URL(`${base}/api/directions`);
  url.searchParams.set("fromLng", origin[0].toString());
  url.searchParams.set("fromLat", origin[1].toString());
  url.searchParams.set("toLng", destination[0].toString());
  url.searchParams.set("toLat", destination[1].toString());

  if (waypoints.length > 0) {
    url.searchParams.set(
      "waypoints",
      waypoints
        .map((waypoint) => `${waypoint.lngLat[0]},${waypoint.lngLat[1]}`)
        .join(";"),
    );
  }

  return url.toString();
}

function createPointElement(label: string, backgroundColor: string) {
  const el = document.createElement("div");
  el.textContent = label;
  el.style.width = "28px";
  el.style.height = "28px";
  el.style.borderRadius = "999px";
  el.style.backgroundColor = backgroundColor;
  el.style.color = "#ffffff";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = "12px";
  el.style.fontWeight = "700";
  el.style.boxShadow = "0 4px 12px rgba(15,23,42,0.22)";
  return el;
}

function createVehicleElement() {
  const el = document.createElement("div");
  el.textContent = "➤";
  el.style.width = "28px";
  el.style.height = "28px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = "22px";
  el.style.color = "#f97316";
  el.style.filter = "drop-shadow(0 4px 10px rgba(15,23,42,0.35))";
  el.style.transformOrigin = "50% 50%";
  return el;
}

function syncStaticMarkers(
  map: mapboxgl.Map,
  origin: MarkerPoint | null,
  destination: MarkerPoint | null,
  waypoints: MarkerPoint[],
  originMarkerRef: MutableRefObject<mapboxgl.Marker | null>,
  destinationMarkerRef: MutableRefObject<mapboxgl.Marker | null>,
  waypointMarkersRef: MutableRefObject<mapboxgl.Marker[]>,
) {
  originMarkerRef.current?.remove();
  destinationMarkerRef.current?.remove();
  waypointMarkersRef.current.forEach((marker) => marker.remove());
  waypointMarkersRef.current = [];

  if (origin) {
    originMarkerRef.current = new mapboxgl.Marker({
      element: createPointElement("O", "#dc2626"),
      anchor: "center",
    })
      .setLngLat(origin.lngLat)
      .addTo(map);
  } else {
    originMarkerRef.current = null;
  }

  if (destination) {
    destinationMarkerRef.current = new mapboxgl.Marker({
      element: createPointElement("D", "#1d4ed8"),
      anchor: "center",
    })
      .setLngLat(destination.lngLat)
      .addTo(map);
  } else {
    destinationMarkerRef.current = null;
  }

  waypointMarkersRef.current = waypoints.map((waypoint) =>
    new mapboxgl.Marker({
      element: createPointElement(waypoint.label, "#0f766e"),
      anchor: "center",
    })
      .setLngLat(waypoint.lngLat)
      .addTo(map),
  );
}

function removeNearestMarker(
  map: mapboxgl.Map,
  clicked: LngLatTuple,
  origin: MarkerPoint | null,
  destination: MarkerPoint | null,
  waypoints: MarkerPoint[],
  handlers: {
    onRemoveOrigin: () => void;
    onRemoveDestination: () => void;
    onRemoveWaypoint: (waypointId: string) => void;
  },
) {
  const clickedPixel = map.project(clicked);
  const candidates: Array<{
    type: "origin" | "destination" | "waypoint";
    id: string;
    lngLat: LngLatTuple;
  }> = [];

  if (origin) {
    candidates.push({ type: "origin", id: origin.id, lngLat: origin.lngLat });
  }
  if (destination) {
    candidates.push({
      type: "destination",
      id: destination.id,
      lngLat: destination.lngLat,
    });
  }
  waypoints.forEach((waypoint) => {
    candidates.push({ type: "waypoint", id: waypoint.id, lngLat: waypoint.lngLat });
  });

  let nearest:
    | { type: "origin" | "destination" | "waypoint"; id: string; distance: number }
    | null = null;

  candidates.forEach((candidate) => {
    const candidatePixel = map.project(candidate.lngLat);
    const dx = candidatePixel.x - clickedPixel.x;
    const dy = candidatePixel.y - clickedPixel.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 26) return;
    if (!nearest || distance < nearest.distance) {
      nearest = { type: candidate.type, id: candidate.id, distance };
    }
  });

  if (!nearest) return;
  const target: {
    type: "origin" | "destination" | "waypoint";
    id: string;
    distance: number;
  } = nearest;

  if (target.type === "origin") {
    handlers.onRemoveOrigin();
    return;
  }
  if (target.type === "destination") {
    handlers.onRemoveDestination();
    return;
  }
  handlers.onRemoveWaypoint(target.id);
}

function clearAllMarkers(
  originMarkerRef: MutableRefObject<mapboxgl.Marker | null>,
  destinationMarkerRef: MutableRefObject<mapboxgl.Marker | null>,
  waypointMarkersRef: MutableRefObject<mapboxgl.Marker[]>,
  vehicleMarkerRef: MutableRefObject<mapboxgl.Marker | null>,
) {
  originMarkerRef.current?.remove();
  destinationMarkerRef.current?.remove();
  waypointMarkersRef.current.forEach((marker) => marker.remove());
  vehicleMarkerRef.current?.remove();
  originMarkerRef.current = null;
  destinationMarkerRef.current = null;
  waypointMarkersRef.current = [];
  vehicleMarkerRef.current = null;
}
