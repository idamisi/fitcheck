"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MeasurementForm, { Measurements } from "../../components/MeasurementForm";
import { createClient } from "../../lib/supabase";

export default function MeasurePage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/"); } else { setReady(true); }
    });
  }, [router, supabase]);

  async function handleSubmit(m: Measurements) {
    try { sessionStorage.setItem("fitcheck_measurements", JSON.stringify(m)); } catch { /* not critical */ }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("measurements").upsert(
        {
          user_id: user.id,
          height: m.height,
          shoulder_width: m.shoulderWidth,
          chest: m.chest,
          waist: m.waist,
          hip: m.hip,
          inseam: m.inseam,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }
    // replace — not push — so /measure is removed from the back-stack.
    // The measurement setup is a one-time flow; the back button from /avatar
    // should never return here.
    router.replace("/avatar");
  }

  if (!ready) return null;

  return (
    <main className="flex flex-col items-center min-h-screen p-8 relative" style={{ background: "var(--bg)" }}>
      <button
        onClick={() => router.back()}
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

      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-sm gap-4">
        <p className="text-base font-medium font-heading" style={{ color: "var(--text)" }}>
          How would you like to enter your measurements?
        </p>
        <MeasurementForm onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
