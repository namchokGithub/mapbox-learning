export type LngLatTuple = [number, number];

export type ActionMode =
  | "select"
  | "set-origin"
  | "set-destination"
  | "add-waypoint"
  | "remove-marker"
  | "vehicle-simulation";

export interface MarkerPoint {
  id: string;
  label: string;
  lngLat: LngLatTuple;
}

export interface LineStringGeometry {
  type: string;
  coordinates: number[][];
}

export interface DirectionsApiResponse {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  geometry: LineStringGeometry;
}

export interface RouteInfo {
  distanceKm: number | null;
  durationMinutes: number | null;
  loading: boolean;
  error: string | null;
}

export interface VehicleSimulationState {
  status: "idle" | "ready" | "playing" | "paused" | "completed";
  speed: 1 | 2 | 4;
  progressPercent: number;
  currentCoordinate: LngLatTuple | null;
  bearing: number;
}
