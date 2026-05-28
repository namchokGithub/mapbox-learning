import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Public token (pk.*) — safe to use in frontend
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

const MEASUREMENT_SOURCE_ID = "measurement-line-source";
const MEASUREMENT_LAYER_ID = "measurement-line-layer";
const DEFAULT_CENTER: [number, number] = [100.5018, 13.7563];
const EMPTY_LINE_DATA = {
  type: "FeatureCollection" as const,
  features: [],
};

interface MeasurementInfo {
  pointA: [number, number] | null;
  pointB: [number, number] | null;
  distanceKm: string | null;
}

const INITIAL_MEASUREMENT: MeasurementInfo = {
  pointA: null,
  pointB: null,
  distanceKm: null,
};

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
}

export function MapView({ center = DEFAULT_CENTER, zoom = 10 }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const pointAMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pointBMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pointARef = useRef<mapboxgl.LngLat | null>(null);
  const pointBRef = useRef<mapboxgl.LngLat | null>(null);
  const measurementRef = useRef<MeasurementInfo>(INITIAL_MEASUREMENT);
  const [measurement, setMeasurement] =
    useState<MeasurementInfo>(INITIAL_MEASUREMENT);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCenterRef.current,
      zoom: initialZoomRef.current,
    });

    map.addControl(new mapboxgl.NavigationControl());
    mapRef.current = map;

    const updateMeasurement = (nextMeasurement: MeasurementInfo) => {
      measurementRef.current = nextMeasurement;
      setMeasurement(nextMeasurement);
    };

    const cloneLngLat = (lngLat: mapboxgl.LngLat) =>
      new mapboxgl.LngLat(lngLat.lng, lngLat.lat);

    const clearMeasurementLine = () => {
      const source = map.getSource(
        MEASUREMENT_SOURCE_ID,
      ) as mapboxgl.GeoJSONSource | null;

      source?.setData(EMPTY_LINE_DATA);
    };

    const drawMeasurementLine = (
      pointA: mapboxgl.LngLat,
      pointB: mapboxgl.LngLat,
    ) => {
      const source = map.getSource(
        MEASUREMENT_SOURCE_ID,
      ) as mapboxgl.GeoJSONSource | null;

      source?.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [pointA.lng, pointA.lat],
            [pointB.lng, pointB.lat],
          ],
        },
        properties: {},
      });
    };

    // Marker lifecycle: always remove existing marker ref before replacing/resetting it.
    const clearMarkers = () => {
      pointAMarkerRef.current?.remove();
      pointBMarkerRef.current?.remove();
      pointAMarkerRef.current = null;
      pointBMarkerRef.current = null;
      pointARef.current = null;
      pointBRef.current = null;
      clearMeasurementLine();
    };

    const resetMeasurement = () => {
      clearMarkers();
      updateMeasurement(INITIAL_MEASUREMENT);
    };

    const setPointA = (point: mapboxgl.LngLat) => {
      pointAMarkerRef.current?.remove();
      pointARef.current = point;
      pointAMarkerRef.current = new mapboxgl.Marker({ color: "#f11212" })
        .setLngLat(point)
        .addTo(map);

      updateMeasurement({
        pointA: [point.lng, point.lat],
        pointB: null,
        distanceKm: null,
      });
    };

    const setPointB = (point: mapboxgl.LngLat) => {
      if (!pointARef.current) return;

      pointBMarkerRef.current?.remove();
      pointBRef.current = point;
      pointBMarkerRef.current = new mapboxgl.Marker({
        color: "rgb(251, 255, 14)",
      })
        .setLngLat(point)
        .addTo(map);

      // Distance flow: `distanceTo()` returns meters. Convert to KM, keep 2 decimals for UI.
      const distanceMeters = pointARef.current.distanceTo(point);
      const distanceKm = (distanceMeters / 1000).toFixed(2);

      drawMeasurementLine(pointARef.current, point);
      updateMeasurement({
        pointA: [pointARef.current.lng, pointARef.current.lat],
        pointB: [point.lng, point.lat],
        distanceKm,
      });
    };

    const handleMapLoad = () => {
      map.addSource(MEASUREMENT_SOURCE_ID, {
        type: "geojson",
        data: EMPTY_LINE_DATA,
      });

      map.addLayer({
        id: MEASUREMENT_LAYER_ID,
        type: "line",
        source: MEASUREMENT_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#1d4ed8",
          "line-width": 3,
          "line-opacity": 0.85,
        },
      });
    };

    map.on("load", handleMapLoad);

    // Map click flow:
    // 1st click -> set point A
    // 2nd click -> set point B and calculate straight-line distance
    // 3rd click -> clear old measurement and start again from new point A
    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      const clickedPoint = cloneLngLat(event.lngLat);

      if (pointARef.current && pointBRef.current) {
        resetMeasurement();
        setPointA(clickedPoint);
        return;
      }

      if (!pointARef.current) {
        setPointA(clickedPoint);
        return;
      }

      setPointB(clickedPoint);
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
      map.off("load", handleMapLoad);
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.setCenter(center);
    mapRef.current.setZoom(zoom);
  }, [center, zoom]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          zIndex: 1,
          width: "min(320px, calc(100% - 32px))",
          padding: "12px 14px",
          borderRadius: 12,
          backgroundColor: "rgba(255, 255, 255, 0.94)",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
          color: "#0f172a",
          fontSize: 14,
          lineHeight: 1.5,
          boxSizing: "border-box",
          marginLeft: "auto",
        }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Distance Measure</div>
        <div>
          Point A:{" "}
          {measurement.pointA
            ? `${measurement.pointA[1].toFixed(5)}, ${measurement.pointA[0].toFixed(5)}`
            : "Not set"}
        </div>
        <div>
          Point B:{" "}
          {measurement.pointB
            ? `${measurement.pointB[1].toFixed(5)}, ${measurement.pointB[0].toFixed(5)}`
            : "Not set"}
        </div>
        <div style={{ marginTop: 8, fontWeight: 600 }}>
          Distance:{" "}
          {measurement.distanceKm ? `${measurement.distanceKm} km` : "-"}
        </div>
      </div>
    </div>
  );
}
