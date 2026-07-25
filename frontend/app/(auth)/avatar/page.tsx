"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "../../components/Avatar";
import { createClient } from "../../lib/supabase";
import type { Measurements } from "../../components/MeasurementForm";
import AccountDropdown from "../../components/AccountDropdown";

const EMPTY: Measurements = {
  height: 0, shoulderWidth: 0, chest: 0, waist: 0, hip: 0, inseam: 0,
};

export default function AvatarPage() {
  const router = useRouter();
  const supabase = createClient();
  const [measurements, setMeasurements] = useState<Measurements>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      try {
        const raw = sessionStorage.getItem("fitcheck_measurements");
        if (raw) { setMeasurements(JSON.parse(raw)); setReady(true); return; }
      } catch { /* ignore */ }

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
        try { sessionStorage.setItem("fitcheck_measurements", JSON.stringify(m)); } catch { /* not critical */ }
        setMeasurements(m);
      }
      setReady(true);
    }
    init();
  }, [router, supabase]);

  if (!ready) return null;

  return (
    <main className="flex flex-col items-center min-h-screen p-8 relative" style={{ background: "var(--bg)" }}>

      {/* Account dropdown — fixed top-right */}
      <div className="fixed top-0 right-0 z-30 px-5 py-3" style={{ pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}><AccountDropdown /></div>
      </div>

      <button
        onClick={() => router.push("/home")}
        aria-label="Back"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded-lg"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      <div className="flex flex-col items-center justify-center flex-1 gap-3 mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider font-heading" style={{ color: "var(--text-muted)" }}>
          Your Avatar
        </h2>
        <Avatar measurements={measurements} />
        <button
          onClick={() => router.replace("/home")}
          className="px-8 py-3 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--accent)", color: "var(--accent-text)", border: "1.5px solid var(--accent)" }}
        >
          Let's go
        </button>
      </div>
    </main>
  );
}
