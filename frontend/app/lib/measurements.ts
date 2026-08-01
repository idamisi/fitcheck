import type { SupabaseClient } from "@supabase/supabase-js";
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

/**
 * Reads the fast, tab-local cache first, then restores it from the user's
 * persisted measurement row when this is a new tab or browser session.
 */
export async function getCurrentUserMeasurements(
  supabase: SupabaseClient,
): Promise<Measurements | null> {
  const cached = getStoredMeasurements();
  if (cached) return cached;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row, error } = await supabase
    .from("measurements")
    .select("height, shoulder_width, chest, waist, hip, inseam")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !row) return null;

  const measurements: Measurements = {
    height: row.height,
    shoulderWidth: row.shoulder_width,
    chest: row.chest,
    waist: row.waist,
    hip: row.hip,
    inseam: row.inseam,
  };

  try {
    sessionStorage.setItem("fitcheck_measurements", JSON.stringify(measurements));
  } catch {
    // The Supabase value is still usable if browser storage is unavailable.
  }

  return measurements;
}
