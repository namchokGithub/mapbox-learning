import { RouteView } from "../components/RouteView";

interface RoutePageProps {
  onBack: () => void;
}

export function RoutePage({ onBack }: RoutePageProps) {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <RouteView onBack={onBack} />
    </div>
  );
}
