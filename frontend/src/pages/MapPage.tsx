import { useEffect } from "react";
import { Map } from "../components/Map";

export function MapPage() {
  useEffect(() => {
    fetch("http://localhost:8080/api/health").catch((error) => {
      console.error("health check failed", error);
    });
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Map />
    </div>
  );
}
