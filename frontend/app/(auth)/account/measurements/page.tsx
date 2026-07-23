"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase";
import MeasurementForm, { Measurements } from "../../../components/MeasurementForm";

const FIELD_LABELS: { key: keyof Measurements; label: string; unit: string }[] = [
  { key: "height",        label: "Height",        unit: "cm" },
  { key: "shoulderWidth", label: "Shoulder Width", unit: "cm" },
  { key: "chest",         label: "Chest",          unit: "cm" },
  { key: "waist",         label: "Waist",          unit: "cm" },
  { key: "hip",           label: "Hip",            unit: "cm" },
  { key: "inseam",        label: "Inseam",         unit: "cm" },
];

const EMPTY: Measurements = {
  height: 0, shoulderWidth: 0, chest: 0, waist: 0, hip: 0, inseam: 0,
};

export default function AccountMeasurementsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [measurements, setMeasurements] = useState<Measurements>(EMPTY);
  const [ready, setReady] = useState(false);
  // When editing: mount MeasurementForm with defaultOpen=true; increment key to
  // remount with fresh values if the user edits multiple times.
  const [editKey, setEditKey] = useState(0);
  const [editing, setEditing] = useState(false);

  // ── Auth gate + load measurements ────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data: row } = await supabase
        .from("measurements")
        .select("height, shoulder_width, chest, waist, hip, inseam")
        .eq("user_id", user.id)
        .maybeSingle();

      if (row) {
        const m: Measurements = {
          height:        row.height         ?? 0,
          shoulderWidth: row.shoulder_width ?? 0,
          chest:         row.chest          ?? 0,
          waist:         row.waist          ?? 0,
          hip:           row.hip            ?? 0,
          inseam:        row.inseam         ?? 0,
        };
        setMeasurements(m);
      }
      setReady(true);
    }
    init();
  }, [router, supabase]);

  // ── Called when MeasurementForm confirms new values ───────────────────────
  async function handleEditSubmit(m: Measurements) {
    setEditing(false);

    // Update sessionStorage so catalog/avatar pick up new values immediately
    try { sessionStorage.setItem("fitcheck_measurements", JSON.stringify(m)); } catch { /* not critical */ }

    // Upsert to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("measurements").upsert(
        {
          user_id:        user.id,
          height:         m.height,
          shoulder_width: m.shoulderWidth,
          chest:          m.chest,
          waist:          m.waist,
          hip:            m.hip,
          inseam:         m.inseam,
          updated_at:     new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }

    setMeasurements(m);
  }

  if (!ready) return null;

  const hasMeasurements = measurements.height > 0;

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "#FAFAF8" }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "#FAFAF8", borderColor: "#E5E7EB" }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded"
          style={{ color: "#2B3A55" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#2B3A55")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Measurements</span>
        <div style={{ width: 40 }} /> {/* balance */}
      </header>

      <div className="flex-1 px-6 py-6 flex flex-col gap-6 max-w-sm mx-auto w-full">

        {hasMeasurements ? (
          <>
            {/* ── Values table ── */}
            <div className="flex flex-col divide-y rounded-lg border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
              {FIELD_LABELS.map(({ key, label, unit }) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: "#fff" }}
                >
                  <span className="text-sm" style={{ color: "#374151" }}>{label}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "#1A1A1A" }}>
                    {measurements[key] > 0 ? `${measurements[key]} ${unit}` : "—"}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Edit button ── */}
            <button
              onClick={() => { setEditKey((k) => k + 1); setEditing(true); }}
              className="w-full py-2.5 text-sm font-semibold rounded border transition-colors focus:outline-none focus-visible:ring-2"
              style={{ background: "#FFFFFF", color: "#2B3A55", border: "1.5px solid #2B3A55" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            >
              Edit Measurements
            </button>
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: "#9CA3AF" }}>
              No measurements saved yet.
            </p>
            <button
              onClick={() => { setEditKey((k) => k + 1); setEditing(true); }}
              className="w-full py-2.5 text-sm font-semibold rounded border transition-colors focus:outline-none focus-visible:ring-2"
              style={{ background: "#FFFFFF", color: "#2B3A55", border: "1.5px solid #2B3A55" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            >
              Add Measurements
            </button>
          </>
        )}
      </div>

      {/* MeasurementForm — remounted via key each time Edit/Add is clicked.
          Edit path (hasMeasurements=true): defaultOpen=true jumps straight into
          the manual modal pre-filled — the form owns the overlay.
          Add path (hasMeasurements=false): defaultOpen=false means the choice
          buttons render as inline content. We wrap them in a fixed centered
          overlay here so they appear centered on screen, matching /measure. */}
      {editing && hasMeasurements && (
        <MeasurementForm
          key={editKey}
          defaultOpen
          defaultValues={measurements}
          onSubmit={handleEditSubmit}
        />
      )}

      {editing && !hasMeasurements && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
          onClick={() => setEditing(false)}
        >
          <div
            className="relative w-full max-w-sm mx-4 rounded-2xl bg-white shadow-xl p-8 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Close"
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <p className="text-base font-medium" style={{ color: "#1A1A1A" }}>
              How would you like to enter your measurements?
            </p>
            <MeasurementForm
              key={editKey}
              defaultOpen={false}
              onSubmit={handleEditSubmit}
            />
          </div>
        </div>
      )}
    </main>
  );
}
