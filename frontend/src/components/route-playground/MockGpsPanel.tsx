import type {
  ActionMode,
  LngLatTuple,
  MarkerPoint,
} from "../../types/navigation";

interface MockGpsPanelProps {
  currentCoordinate: LngLatTuple | null;
  mode: ActionMode;
  waypoints: MarkerPoint[];
  onModeChange: (mode: ActionMode) => void;
  onMoveVehicleToWaypoint: (waypoint: MarkerPoint) => void;
  onMoveVehicleToOrigin: () => void;
  onMoveVehicleToDestination: () => void;
}

export function MockGpsPanel({
  currentCoordinate,
  mode,
  waypoints,
  onModeChange,
  onMoveVehicleToWaypoint,
  onMoveVehicleToOrigin,
  onMoveVehicleToDestination,
}: MockGpsPanelProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        zIndex: 10,
        width: "min(340px, calc(100% - 32px))",
        padding: 14,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.94)",
        boxShadow: "0 10px 30px rgba(15,23,42,0.16)",
        color: "#0f172a",
        boxSizing: "border-box",
      }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Mock GPS Panel</div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        <div>
          Current Position:{" "}
          {currentCoordinate
            ? `${currentCoordinate[1].toFixed(5)}, ${currentCoordinate[0].toFixed(5)}`
            : "-"}
        </div>
        <div>Active Mode: {mode}</div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => onModeChange("vehicle-simulation")}
          style={getModeButtonStyle(mode === "vehicle-simulation")}>
          Teleport Vehicle
        </button>
        <button
          onClick={() => onModeChange("add-waypoint")}
          style={getModeButtonStyle(mode === "add-waypoint")}>
          Add Waypoint
        </button>
        <button
          onClick={() => onModeChange("remove-marker")}
          style={getModeButtonStyle(mode === "remove-marker")}>
          Remove Waypoint
        </button>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onMoveVehicleToOrigin} style={buttonStyle}>
          Move To Origin
        </button>
        <button onClick={onMoveVehicleToDestination} style={buttonStyle}>
          Move To Destination
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}>
        Waypoints
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
        {waypoints.length === 0 && (
          <div style={{ fontSize: 12, color: "#64748b" }}>
            No waypoints yet.
          </div>
        )}
        {waypoints.map((waypoint) => (
          <button
            key={waypoint.id}
            onClick={() => onMoveVehicleToWaypoint(waypoint)}
            style={{
              ...buttonStyle,
              justifyContent: "space-between",
              display: "flex",
            }}>
            <span>{waypoint.label}</span>
            <span style={{ fontSize: 11, opacity: 0.8 }}>Move Vehicle</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const buttonStyle = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  backgroundColor: "#e2e8f0",
  color: "#1e293b",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
} as const;

function getModeButtonStyle(isActive: boolean) {
  return {
    ...buttonStyle,
    backgroundColor: isActive ? "#0f766e" : buttonStyle.backgroundColor,
    color: isActive ? "#ffffff" : buttonStyle.color,
    boxShadow: isActive ? "0 8px 18px rgba(15, 118, 110, 0.28)" : "none",
  } as const;
}
