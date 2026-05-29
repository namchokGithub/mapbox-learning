import type { ActionMode } from "../../types/navigation";

interface ActionModePanelProps {
  mode: ActionMode;
  onModeChange: (mode: ActionMode) => void;
}

const MODES: Array<{ value: ActionMode; label: string }> = [
  { value: "select", label: "Select" },
  { value: "set-origin", label: "Set Origin" },
  { value: "set-destination", label: "Set Destination" },
  { value: "add-waypoint", label: "Add Waypoint" },
  { value: "remove-marker", label: "Remove Marker" },
  { value: "vehicle-simulation", label: "Vehicle Simulation" },
];

export function ActionModePanel({
  mode,
  onModeChange,
}: ActionModePanelProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        width: "min(360px, calc(100% - 32px))",
        padding: 14,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.94)",
        boxShadow: "0 10px 30px rgba(15,23,42,0.16)",
        color: "#0f172a",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10 }}>
        Navigation Playground
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {MODES.map((item) => (
          <button
            key={item.value}
            onClick={() => onModeChange(item.value)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: mode === item.value ? "#ffffff" : "#334155",
              backgroundColor: mode === item.value ? "#0f766e" : "#e2e8f0",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
        Choose mode first, then click map.
      </div>
    </div>
  );
}
