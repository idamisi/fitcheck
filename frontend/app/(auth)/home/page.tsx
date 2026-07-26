"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import Avatar from "../../components/Avatar";
import AccountDropdown from "../../components/AccountDropdown";
import FitzyChat from "../../components/FitzyChat";
import type { FitzyChatMessage } from "../../components/FitzyChat";
import type { Measurements } from "../../components/MeasurementForm";
import type { FitzyOutput } from "../../api/fitzy/route";
import catalog from "../../data/catalog";

const EMPTY_M: Measurements = {
  height: 0, shoulderWidth: 0, chest: 0, waist: 0, hip: 0, inseam: 0,
};

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurements>(EMPTY_M);

  // ── Fitzy chat state ───────────────────────────────────────────────────────
  const [messages, setMessages] = useState<FitzyChatMessage[]>([]);
  const [fitzyLoading, setFitzyLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.display_name) setDisplayName(profile.display_name);

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
          height:        row.height         ?? 0,
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

  // ── Fitzy send handler ─────────────────────────────────────────────────────
  async function handleSend(text: string) {
    const userMsg: FitzyChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setFitzyLoading(true);

    try {
      const res = await fetch("/api/fitzy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          catalog,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: err.error ?? "Fitzy's having trouble right now — try again." },
        ]);
        return;
      }

      const data: FitzyOutput = await res.json();

      if (data.type === "search") {
        // If search, navigate to catalog with the Fitzy reply as context
        // Store the first search reply and item IDs for the catalog page to pick up
        sessionStorage.setItem(
          "fitzy_context",
          JSON.stringify({
            reply: data.reply,
            itemIds: data.itemIds,
            query: text,
            // Store messages so catalog can continue the thread
            messages: [...next, { role: "assistant", content: data.reply, itemIds: data.itemIds }],
          }),
        );
        router.push("/catalog");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Fitzy's having trouble right now — try again." },
      ]);
    } finally {
      setFitzyLoading(false);
    }
  }

  if (!ready) return null;

  const greeting = displayName ? `Hey, ${displayName}.` : "Hey.";

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#F7F5F1", color: "#0B1A33" }}>

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

      {/* ── Two-column layout ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0">

        {/* ── Left: hero + avatar ─────────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-center px-6 py-10 gap-6 lg:w-80 lg:flex-shrink-0 lg:border-r overflow-y-auto" style={{ borderColor: "#E2DDD6" }}>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1
              className="text-3xl font-bold tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-heading)", color: "#0B1A33" }}
            >
              {greeting}
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
              Tell Fitzy what you need.
            </p>
          </div>

          {/* Avatar — click to view full avatar page */}
          <div
            className="cursor-pointer"
            onClick={() => router.push("/avatar")}
            title="View your avatar"
          >
            <Avatar measurements={measurements} />
          </div>

          {/* Quick-links */}
          <div className="flex flex-col gap-2 w-full max-w-[220px]">
            <button
              onClick={() => router.push("/saved")}
              className="text-xs font-medium py-2 rounded-lg border transition-colors focus:outline-none"
              style={{ background: "#FFFFFF", color: "#0B1A33", border: "1px solid #E2DDD6" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
            >
              Saved items
            </button>
            <button
              onClick={() => router.push("/avatar")}
              className="text-xs font-medium py-2 rounded-lg border transition-colors focus:outline-none"
              style={{ background: "#FFFFFF", color: "#0B1A33", border: "1px solid #E2DDD6" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
            >
              Your avatar
            </button>
          </div>
        </div>

        {/* ── Right: Fitzy chat ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat header */}
          <div
            className="flex-shrink-0 px-5 py-3 border-b"
            style={{ borderColor: "#E2DDD6" }}
          >
            <p className="text-sm font-semibold" style={{ color: "#0B1A33", fontFamily: "var(--font-heading)" }}>
              Fitzy
            </p>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              Ask me anything — I&apos;ll find what fits.
            </p>
          </div>

          {/* Chat thread — fills remaining height, input stays at bottom of panel */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <FitzyChat
              messages={messages}
              onSend={handleSend}
              loading={fitzyLoading}
              mode="full"
              placeholder="e.g. Something smart-casual for a dinner date…"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
