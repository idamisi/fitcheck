"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "../components/Avatar";
import { createClient } from "../lib/supabase";
import type { Measurements } from "../components/MeasurementForm";

const EMPTY: Measurements = {
  height: 0,
  shoulderWidth: 0,
  chest: 0,
  waist: 0,
  hip: 0,
  inseam: 0,
};

export default function AvatarPage() {
  const router = useRouter();
  const supabase = createClient();
  const [measurements, setMeasurements] = useState<Measurements>(EMPTY);
  const [ready, setReady] = useState(false);

  // ── Auth gate + load measurements ────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      // Prefer sessionStorage (already set by /measure) for instant render.
      // Fall back to Supabase if e.g. the user navigated here directly.
      try {
        const raw = sessionStorage.getItem("fitcheck_measurements");
        if (raw) {
          setMeasurements(JSON.parse(raw));
          setReady(true);
          return;
        }
      } catch {
        // ignore
      }

      const { data: row } = await supabase
        .from("measurements")
        .select("height, shoulder_width, chest, waist, hip, inseam")
        .eq("user_id", user.id)
        .maybeSingle();

      if (row) {
        const m: Measurements = {
          height: row.height ?? 0,
          shoulderWidth: row.shoulder_width ?? 0,
          chest: row.chest ?? 0,
          waist: row.waist ?? 0,
          hip: row.hip ?? 0,
          inseam: row.inseam ?? 0,
        };
        try {
          sessionStorage.setItem("fitcheck_measurements", JSON.stringify(m));
        } catch {
          // not critical
        }
        setMeasurements(m);
      }

      setReady(true);
    }

    init();
  }, [router, supabase]);

  if (!ready) return null;

  return (
    <main className="flex flex-col items-center min-h-screen p-8 relative" style={{ background: "#FAFAF8" }}>
      <button
        onClick={() => router.back()}
        aria-label="Back"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded"
        style={{ color: "#2B3A55" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#2B3A55")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      <div className="flex flex-col items-center justify-center flex-1 gap-3 mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#2B3A55" }}>
          Your Avatar
        </h2>
        <Avatar measurements={measurements} />
        <button
          onClick={() => router.push("/catalog")}
          className="px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ background: "#FFFFFF", color: "#2B3A55", border: "1.5px solid #2B3A55" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
        >
          See What Fits
        </button>
      </div>
    </main>
  );
}
