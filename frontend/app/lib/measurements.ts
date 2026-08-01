import type { Measurements } from "../components/MeasurementForm";

export function getStoredMeasurements(): Measurements | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("fitcheck_measurements");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
