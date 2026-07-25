"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase";
import MeasurementForm, { Measurements } from "../../../components/MeasurementForm";
import AccountDropdown from "../../../components/AccountDropdown";

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
  const [editKey, setEditKey] = useState(0);
  const [editing, setEditing] = useState(false);

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
        setMeasurements({
          height:        row.height         ?? 0,
          shoulderWidth: row.shoulder_width ?? 0,
          chest:         row.chest          ?? 0,
          waist:         row.waist          ?? 0,
          hip:           row.hip            ?? 0,
          inseam:        row.inseam         ?? 0,
        });
      }
      setReady(true);
    }
    init();
  }, [router, supabase]);

  async function handleEditSubmit(m: Measurements) {
    setEditing(false);
    try { sessionStorage.setItem("fitcheck_measurements", JSON.stringify(m)); } catch { /* not critical */ }

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
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* Account dropdown — fixed top-right */}
      <div className="fixed top-0 right-0 z-30 px-5 py-3" style={{ pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}><AccountDropdown /></div>
      </div>

      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded-lg"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <span className="text-sm font-semibold font-heading" style={{ color: "var(--text)" }}>Measurements</span>
        <div style={{ width: 40 }} />
      </header>

      <div className="flex-1 px-6 py-6 flex flex-col gap-6 max-w-sm mx-auto w-full">
        {hasMeasurements ? (
          <>
            <div className="flex flex-col divide-y rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {FIELD_LABELS.map(({ key, label, unit }) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: "var(--surface)" }}
                >
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {measurements[key] > 0 ? `${measurements[key]} ${unit}` : "—"}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => { setEditKey((k) => k + 1); setEditing(true); }}
              className="w-full py-3 text-sm font-semibold rounded-lg border transition-colors focus:outline-none focus-visible:ring-2"
              style={{ background: "var(--accent)", color: "var(--accent-text)", border: "1.5px solid var(--accent)" }}
            >
              Edit Measurements
            </button>
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No measurements saved yet.
            </p>
            <button
              onClick={() => { setEditKey((k) => k + 1); setEditing(true); }}
              className="w-full py-3 text-sm font-semibold rounded-lg border transition-colors focus:outline-none focus-visible:ring-2"
              style={{ background: "var(--accent)", color: "var(--accent-text)", border: "1.5px solid var(--accent)" }}
            >
              Add Measurements
            </button>
          </>
        )}
      </div>

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
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: "rgba(11,26,51,0.55)" }}
          onClick={() => setEditing(false)}
        >
          <div
            className="relative w-full max-w-sm mx-4 rounded-2xl p-8 flex flex-col gap-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Close"
              className="absolute top-4 right-4 focus:outline-none"
              style={{ color: "var(--text-muted)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <p className="text-base font-medium font-heading" style={{ color: "var(--text)" }}>
              How would you like to enter your measurements?
            </p>
            <MeasurementForm key={editKey} defaultOpen={false} onSubmit={handleEditSubmit} />
          </div>
        </div>
      )}
    </main>
  );
}
