import { useState } from "react";
import { MapPage } from "./pages/MapPage";
import { RoutePage } from "./pages/RoutePage";

type Page = "map" | "route";

function App() {
  const [page, setPage] = useState<Page>("map");

  if (page === "route") {
    return <RoutePage onBack={() => setPage("map")} />;
  }
  return <MapPage onNavigateToRoute={() => setPage("route")} />;
}

export default App;
