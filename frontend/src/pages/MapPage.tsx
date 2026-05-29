import { MapView } from "../components/MapView";

interface MapPageProps {
  onNavigateToRoute: () => void;
}

export function MapPage({ onNavigateToRoute }: MapPageProps) {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <MapView />
      <button
        onClick={onNavigateToRoute}
        style={{
          position: "absolute",
          bottom: 154,
          right: 32,
          zIndex: 10,
          padding: "8px 16px",
          borderRadius: 8,
          border: "none",
          backgroundColor: "#6366f1",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: 14,
          boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
        }}>
        Try Routing →
      </button>
    </div>
  );
}
