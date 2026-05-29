import type {
  LngLatTuple,
  RouteInfo,
  VehicleSimulationState,
} from "../../types/navigation";

interface VehicleSimulationPanelProps {
  routeInfo: RouteInfo;
  currentCoordinate: LngLatTuple | null;
  simulation: VehicleSimulationState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onReplay: () => void;
  onSpeedChange: (speed: 1 | 2 | 4) => void;
}

const SPEED_OPTIONS: Array<1 | 2 | 4> = [1, 2, 4];

export function VehicleSimulationPanel({
  routeInfo,
  currentCoordinate,
  simulation,
  onStart,
  onPause,
  onReset,
  onReplay,
  onSpeedChange,
}: VehicleSimulationPanelProps) {
  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        bottom: 16,
        zIndex: 10,
        width: "min(320px, calc(100% - 32px))",
        padding: 14,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.94)",
        boxShadow: "0 10px 30px rgba(15,23,42,0.16)",
        color: "#0f172a",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Vehicle Simulation</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onStart} style={buttonStyle("#0f766e")}>
          Start
        </button>
        <button onClick={onPause} style={buttonStyle("#475569")}>
          Pause
        </button>
        <button onClick={onReset} style={buttonStyle("#1d4ed8")}>
          Reset
        </button>
        <button onClick={onReplay} style={buttonStyle("#9333ea")}>
          Replay
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}>
        Speed
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => onSpeedChange(speed)}
            style={{
              ...buttonStyle(simulation.speed === speed ? "#0f172a" : "#cbd5e1"),
              color: simulation.speed === speed ? "#ffffff" : "#1e293b",
            }}
          >
            {speed}x
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
        <div>Status: {simulation.status}</div>
        <div>
          Distance:{" "}
          {routeInfo.distanceKm !== null ? `${routeInfo.distanceKm.toFixed(2)} km` : "-"}
        </div>
        <div>
          ETA:{" "}
          {routeInfo.durationMinutes !== null
            ? `${routeInfo.durationMinutes.toFixed(1)} min`
            : "-"}
        </div>
        <div>
          Current Coordinate:{" "}
          {currentCoordinate
            ? `${currentCoordinate[1].toFixed(5)}, ${currentCoordinate[0].toFixed(5)}`
            : "-"}
        </div>
        <div>Route Progress: {simulation.progressPercent.toFixed(1)}%</div>
      </div>

      {routeInfo.loading && (
        <div style={{ marginTop: 8, color: "#6366f1", fontWeight: 600 }}>
          Loading route...
        </div>
      )}
      {routeInfo.error && (
        <div style={{ marginTop: 8, color: "#dc2626" }}>{routeInfo.error}</div>
      )}
    </div>
  );
}

function buttonStyle(backgroundColor: string) {
  return {
    border: "none",
    borderRadius: 10,
    padding: "8px 12px",
    backgroundColor,
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  } as const;
}
