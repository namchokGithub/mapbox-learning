import { useEffect, useRef, useState } from "react";
import type {
  LineStringGeometry,
  LngLatTuple,
  VehicleSimulationState,
} from "../types/navigation";

interface PreparedRoute {
  points: LngLatTuple[];
  cumulativeDistances: number[];
  segmentLengths: number[];
  totalDistance: number;
  animationDurationMs: number;
}

const INITIAL_STATE: VehicleSimulationState = {
  status: "idle",
  speed: 1,
  progressPercent: 0,
  currentCoordinate: null,
  bearing: 0,
};

function distanceBetween(a: LngLatTuple, b: LngLatTuple) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function interpolateCoordinate(
  preparedRoute: PreparedRoute,
  progress: number,
): { coordinate: LngLatTuple; bearing: number } {
  const targetDistance = preparedRoute.totalDistance * progress;
  let segmentIndex = 0;

  while (
    segmentIndex < preparedRoute.segmentLengths.length - 1 &&
    preparedRoute.cumulativeDistances[segmentIndex + 1] < targetDistance
  ) {
    segmentIndex += 1;
  }

  const segmentStart = preparedRoute.points[segmentIndex];
  const segmentEnd =
    preparedRoute.points[segmentIndex + 1] ?? preparedRoute.points[segmentIndex];
  const segmentDistance = preparedRoute.segmentLengths[segmentIndex] || 1;
  const distanceIntoSegment =
    targetDistance - preparedRoute.cumulativeDistances[segmentIndex];
  const segmentProgress = clamp(distanceIntoSegment / segmentDistance, 0, 1);

  const lng = segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * segmentProgress;
  const lat = segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * segmentProgress;
  const bearing =
    (Math.atan2(segmentEnd[1] - segmentStart[1], segmentEnd[0] - segmentStart[0]) *
      180) /
    Math.PI;

  return {
    coordinate: [lng, lat],
    bearing,
  };
}

function findNearestProgress(preparedRoute: PreparedRoute, point: LngLatTuple) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  preparedRoute.points.forEach((candidate, index) => {
    const distance = distanceBetween(candidate, point);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return preparedRoute.cumulativeDistances[bestIndex] / preparedRoute.totalDistance;
}

export function useVehicleSimulation(
  geometry: LineStringGeometry | null,
  durationSeconds: number | null,
) {
  const preparedRouteRef = useRef<PreparedRoute | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const speedRef = useRef<1 | 2 | 4>(1);
  const [simulation, setSimulation] =
    useState<VehicleSimulationState>(INITIAL_STATE);

  const stopAnimation = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastFrameTimeRef.current = null;
  };

  const syncProgress = (progress: number, status: VehicleSimulationState["status"]) => {
    const preparedRoute = preparedRouteRef.current;
    if (!preparedRoute) {
      setSimulation((prev) => ({
        ...prev,
        status,
        progressPercent: 0,
        currentCoordinate: null,
      }));
      return;
    }

    const clampedProgress = clamp(progress, 0, 1);
    progressRef.current = clampedProgress;
    const next = interpolateCoordinate(preparedRoute, clampedProgress);

    setSimulation((prev) => ({
      ...prev,
      status,
      progressPercent: clampedProgress * 100,
      currentCoordinate: next.coordinate,
      bearing: next.bearing,
    }));
  };

  useEffect(() => {
    stopAnimation();

    if (!geometry || geometry.coordinates.length < 2 || !durationSeconds) {
      preparedRouteRef.current = null;
      progressRef.current = 0;
      queueMicrotask(() => {
        setSimulation((prev) => ({
          ...INITIAL_STATE,
          speed: prev.speed,
        }));
      });
      return;
    }

    const points = geometry.coordinates.map(
      (coordinate) => [coordinate[0], coordinate[1]] as LngLatTuple,
    );
    const segmentLengths: number[] = [];
    const cumulativeDistances = [0];

    for (let index = 1; index < points.length; index += 1) {
      const segmentLength = distanceBetween(points[index - 1], points[index]);
      segmentLengths.push(segmentLength);
      cumulativeDistances.push(cumulativeDistances[index - 1] + segmentLength);
    }

    const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
    preparedRouteRef.current = {
      points,
      cumulativeDistances,
      segmentLengths,
      totalDistance,
      animationDurationMs: Math.min(
        Math.max(durationSeconds * 120, 4000),
        12000,
      ),
    };

    const preparedRoute = preparedRouteRef.current;
    if (!preparedRoute) return;

    progressRef.current = 0;
    const initialBearing = interpolateCoordinate(preparedRoute, 0).bearing;

    queueMicrotask(() => {
      setSimulation((prev) => ({
        ...prev,
        status: "ready",
        progressPercent: 0,
        currentCoordinate: points[0],
        bearing: initialBearing,
      }));
    });
  }, [geometry, durationSeconds]);

  useEffect(() => {
    speedRef.current = simulation.speed;
  }, [simulation.speed]);

  useEffect(() => () => stopAnimation(), []);

  const tick = (timestamp: number) => {
    const preparedRoute = preparedRouteRef.current;
    if (!preparedRoute) {
      stopAnimation();
      return;
    }

    if (lastFrameTimeRef.current === null) {
      lastFrameTimeRef.current = timestamp;
    }

    const delta = timestamp - lastFrameTimeRef.current;
    lastFrameTimeRef.current = timestamp;
    const nextProgress =
      progressRef.current +
      (delta * speedRef.current) / preparedRoute.animationDurationMs;

    if (nextProgress >= 1) {
      syncProgress(1, "completed");
      stopAnimation();
      return;
    }

    syncProgress(nextProgress, "playing");
    animationFrameRef.current = window.requestAnimationFrame(tick);
  };

  const start = () => {
    if (!preparedRouteRef.current) return;
    if (animationFrameRef.current !== null) return;

    if (progressRef.current >= 1) {
      progressRef.current = 0;
      syncProgress(0, "ready");
    }

    setSimulation((prev) => ({ ...prev, status: "playing" }));
    animationFrameRef.current = window.requestAnimationFrame(tick);
  };

  const pause = () => {
    stopAnimation();
    setSimulation((prev) => ({ ...prev, status: "paused" }));
  };

  const reset = () => {
    stopAnimation();
    if (!preparedRouteRef.current) {
      setSimulation((prev) => ({ ...prev, status: "idle" }));
      return;
    }

    syncProgress(0, "ready");
  };

  const replay = () => {
    reset();
    start();
  };

  const setSpeed = (speed: 1 | 2 | 4) => {
    setSimulation((prev) => ({ ...prev, speed }));
  };

  const teleportTo = (coordinate: LngLatTuple, snapToRoute = false) => {
    stopAnimation();
    const preparedRoute = preparedRouteRef.current;

    if (!preparedRoute) {
      setSimulation((prev) => ({
        ...prev,
        currentCoordinate: coordinate,
        status: "paused",
      }));
      return;
    }

    if (!snapToRoute) {
      setSimulation((prev) => ({
        ...prev,
        currentCoordinate: coordinate,
        status: "paused",
      }));
      return;
    }

    const nearestProgress = findNearestProgress(preparedRoute, coordinate);
    syncProgress(nearestProgress, "paused");
  };

  return {
    simulation,
    start,
    pause,
    reset,
    replay,
    setSpeed,
    teleportTo,
  };
}
