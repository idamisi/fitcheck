"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import Avatar from "../../components/Avatar";
import AccountDropdown from "../../components/AccountDropdown";
import type { Measurements } from "../../components/MeasurementForm";

const EMPTY_M: Measurements = {
  height: 0, shoulderWidth: 0, chest: 0, waist: 0, hip: 0, inseam: 0,
};

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurements>(EMPTY_M);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      // Load profile (display_name)
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.display_name) setDisplayName(profile.display_name);

      // Load measurements — try sessionStorage first for speed
      try {
        const raw = sessionStorage.getItem("fitcheck_measurements");
        if (raw) {
          setMeasurements(JSON.parse(raw));
          setReady(true);
          return;
        }
      } catch { /* ignore */ }

      const { data: row } = await supabase
        .from("measurements")
        .select("height, shoulder_width, chest, waist, hip, inseam")
        .eq("user_id", user.id)
        .maybeSingle();

      if (row) {
        const m: Measurements = {
          height:        row.height        ?? 0,
          shoulderWidth: row.shoulder_width ?? 0,
          chest:         row.chest          ?? 0,
          waist:         row.waist          ?? 0,
          hip:           row.hip            ?? 0,
          inseam:        row.inseam         ?? 0,
        };
        try { sessionStorage.setItem("fitcheck_measurements", JSON.stringify(m)); } catch { /* not critical */ }
        setMeasurements(m);
      }

      setReady(true);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChatSubmit() {
    if (!chatInput.trim()) return;
    // Pass the query through to the catalog's search
    router.push(`/catalog?q=${encodeURIComponent(chatInput.trim())}`);
  }

  if (!ready) return null;

  const greeting = displayName ? `Hey, ${displayName}.` : "Hey.";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F7F5F1", color: "#0B1A33" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "#F7F5F1", borderBottom: "1px solid #E2DDD6" }}
      >
        <button
          onClick={() => router.push("/home")}
          className="text-lg font-bold tracking-tight focus:outline-none focus-visible:ring-2 rounded"
          style={{ fontFamily: "var(--font-heading)", color: "#0B1A33", background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          FitCheck
        </button>

        <AccountDropdown />
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-10 py-16">

        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <h1
            className="text-4xl font-bold tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-heading)", color: "#0B1A33" }}
          >
            {greeting}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "#6B7280" }}>
            Your avatar is ready. Ask Fitzy what you should wear.
          </p>
        </div>

        {/* ── Avatar ──────────────────────────────────────────────────────── */}
        <div
          className="cursor-pointer"
          onClick={() => router.push("/avatar")}
          title="View your avatar"
        >
          <Avatar measurements={measurements} />
        </div>

        {/* ── Fitzy chat input ─────────────────────────────────────────────── */}
        <div className="w-full max-w-md flex flex-col gap-2">
          <p className="text-xs font-medium text-left" style={{ color: "#6B7280" }}>
            Ask Fitzy anything about your wardrobe
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleChatSubmit(); }}
              placeholder="e.g. What should I wear to a smart-casual dinner?"
              className="flex-1 px-4 py-2.5 text-sm rounded-lg border focus:outline-none"
              style={{ background: "#FFFFFF", border: "1px solid #E2DDD6", color: "#0B1A33" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "#E2DDD6")}
            />
            <button
              onClick={handleChatSubmit}
              className="px-4 py-2.5 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors"
              style={{ background: "#8FB7FF", color: "#0B1A33", border: "1.5px solid #8FB7FF" }}
            >
              Ask
            </button>
          </div>
        </div>

        {/* ── Feature cards ────────────────────────────────────────────────── */}
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Your avatar card */}
          <button
            onClick={() => router.push("/avatar")}
            className="flex flex-col gap-2 text-left p-5 rounded-xl border focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "#FFFFFF", border: "1px solid #E2DDD6" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
          >
            <span className="text-sm font-semibold" style={{ color: "#0B1A33" }}>Your avatar</span>
            <span className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
              A 3D model built around your exact measurements.
            </span>
          </button>

          {/* Saved items card */}
          <button
            onClick={() => router.push("/saved")}
            className="flex flex-col gap-2 text-left p-5 rounded-xl border focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "#FFFFFF", border: "1px solid #E2DDD6" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
          >
            <span className="text-sm font-semibold" style={{ color: "#0B1A33" }}>Saved items</span>
            <span className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
              Everything you&apos;ve hearted. Come back to it when you&apos;re ready.
            </span>
          </button>

        </div>
      </main>
    </div>
  );
}
