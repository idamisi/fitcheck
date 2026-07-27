"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import Avatar from "../../components/Avatar";
import AccountDropdown from "../../components/AccountDropdown";
import type { FitzyChatMessage } from "../../components/FitzyChat";
import type { Measurements } from "../../components/MeasurementForm";
import type { FitzyOutput } from "../../api/fitzy/route";
import catalog from "../../data/catalog";

const EMPTY_M: Measurements = {
  height: 0, shoulderWidth: 0, chest: 0, waist: 0, hip: 0, inseam: 0,
};

const EXAMPLE_CHIPS = [
  "Dinner date outfit",
  "Pair a jacket",
  "Browse streetwear",
];

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurements>(EMPTY_M);

  // ── Fitzy state ────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<FitzyChatMessage[]>([]);
  const [fitzyLoading, setFitzyLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        sessionStorage.setItem(
          "fitzy_context",
          JSON.stringify({
            reply: data.reply,
            itemIds: data.itemIds,
            query: text,
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

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft.trim() || fitzyLoading) return;
    handleSend(draft.trim());
    setDraft("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleChip(prompt: string) {
    setDraft(prompt);
    // Submit immediately
    handleSend(prompt);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  if (!ready) return null;

  const greeting = displayName ? `Hey, ${displayName}.` : "Hey.";

  return (
    <div style={{ background: "#F7F5F1", color: "#0B1A33", minHeight: "100vh" }}>
      <style>{`
        .home-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 768px) {
          .home-grid {
            grid-template-columns: 1fr;
          }
        }
        /* Make the Avatar SVG scale with its container */
        .avatar-fluid svg {
          width: 100% !important;
          height: auto !important;
        }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "#F7F5F1",
          borderBottom: "1px solid #E2DDD6",
          padding: "1rem clamp(1rem, 4vw, 3rem)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => router.push("/home")}
          style={{
            fontFamily: "var(--font-heading)", color: "#0B1A33",
            background: "none", border: "none", padding: 0,
            fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em",
            cursor: "pointer",
          }}
        >
          FitCheck
        </button>
        <AccountDropdown />
      </nav>

      {/* ── Page body — capped & centred ─────────────────────────────────────── */}
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 3rem)",
        }}
      >

        {/* ── Greeting ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)", color: "#0B1A33",
              fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
              fontWeight: 700, letterSpacing: "-0.02em",
              lineHeight: 1.2, margin: 0,
            }}
          >
            {greeting}
          </h1>
          <p style={{ color: "#6B7280", fontSize: "0.9375rem", marginTop: "0.375rem" }}>
            Tell Fitzy what you&apos;re looking for today.
          </p>
        </div>

        {/* ── Two-column grid ──────────────────────────────────────────────── */}
        <div className="home-grid">

          {/* ── Left: Fitzy search card ──────────────────────────────────── */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2DDD6",
              borderRadius: "16px",
              padding: "clamp(1.25rem, 3vw, 2rem)",
              display: "flex", flexDirection: "column", gap: "1.25rem",
              minWidth: 0,
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--font-heading)", color: "#0B1A33",
                  fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem",
                }}
              >
                Ask Fitzy
              </p>

              {/* Input + Send */}
              <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="e.g. Something smart-casual for a dinner date…"
                  disabled={fitzyLoading}
                  style={{
                    flex: 1, minWidth: 0,
                    padding: "0.625rem 0.875rem",
                    fontSize: "0.875rem",
                    background: "#F7F5F1",
                    border: "1px solid #E2DDD6",
                    borderRadius: "8px",
                    color: "#0B1A33",
                    outline: "none",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || fitzyLoading}
                  style={{
                    flexShrink: 0,
                    padding: "0.625rem 1rem",
                    fontSize: "0.875rem", fontWeight: 600,
                    background: "#8FB7FF", color: "#0B1A33",
                    border: "1.5px solid #8FB7FF",
                    borderRadius: "8px",
                    cursor: "pointer",
                    opacity: !draft.trim() || fitzyLoading ? 0.4 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  {fitzyLoading ? "…" : "Send"}
                </button>
              </form>
            </div>

            {/* Example prompt chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {EXAMPLE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChip(chip)}
                  disabled={fitzyLoading}
                  style={{
                    padding: "0.375rem 0.875rem",
                    fontSize: "0.8125rem", fontWeight: 500,
                    background: "#F7F5F1", color: "#0B1A33",
                    border: "1px solid #E2DDD6",
                    borderRadius: "999px",
                    cursor: fitzyLoading ? "not-allowed" : "pointer",
                    opacity: fitzyLoading ? 0.5 : 1,
                    whiteSpace: "nowrap",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!fitzyLoading) e.currentTarget.style.borderColor = "#8FB7FF"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Caption */}
            <p style={{ fontSize: "0.75rem", color: "#6B7280", margin: 0 }}>
              Fitzy checks fit against your measurements automatically.
            </p>
          </div>

          {/* ── Right: avatar + quick-links card ─────────────────────────── */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2DDD6",
              borderRadius: "16px",
              padding: "clamp(1.25rem, 3vw, 2rem)",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: "1.25rem",
              minWidth: 0,
            }}
          >
            {/* Fluid avatar */}
            <div
              className="avatar-fluid"
              onClick={() => router.push("/avatar")}
              title="View your avatar"
              style={{ width: "100%", maxWidth: "220px", cursor: "pointer" }}
            >
              <Avatar measurements={measurements} />
            </div>

            {/* Quick-link buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
              <button
                onClick={() => router.push("/saved")}
                style={quickBtnStyle}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
              >
                Saved items
              </button>
              <button
                onClick={() => router.push("/measure")}
                style={quickBtnStyle}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
              >
                Your measurements
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Shared style objects ──────────────────────────────────────────────────────

const quickBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 1rem",
  fontSize: "0.875rem", fontWeight: 500,
  background: "#FFFFFF", color: "#0B1A33",
  border: "1px solid #E2DDD6",
  borderRadius: "8px",
  cursor: "pointer",
  textAlign: "center",
  transition: "border-color 0.15s",
};
