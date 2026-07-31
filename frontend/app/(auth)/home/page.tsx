"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import Avatar from "../../components/Avatar";
import AccountDropdown from "../../components/AccountDropdown";
import FitCheckLandingShell from "../../components/FitCheckLandingShell";
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

  // ── gender filter (seeded from profile) — same pattern as /catalog and
  // /pick-match, used to keep Fitzy's candidates scoped to the user's gender
  const [gender, setGender] = useState<"all" | "men" | "women">("all");

  // ── Fitzy state ────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<FitzyChatMessage[]>([]);
  const [fitzyLoading, setFitzyLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the mini-thread to the newest message
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, fitzyLoading]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, gender")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.gender === "men" || profile?.gender === "women") {
        setGender(profile.gender);
      }

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

  // ── Gender-filtered catalog — used only for Fitzy's candidates ────────────
  const filteredByGender = useMemo(
    () => (gender === "all" ? catalog : catalog.filter((i) => i.gender === gender)),
    [gender],
  );

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
          catalog: filteredByGender,
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
        // Land the reply in visible history first so the conversation isn't
        // silently abandoned — then hand off to /catalog as before.
        const withReply: FitzyChatMessage[] = [
          ...next,
          { role: "assistant", content: data.reply, itemIds: data.itemIds },
        ];
        setMessages(withReply);
        sessionStorage.setItem(
          "fitzy_context",
          JSON.stringify({
            reply: data.reply,
            itemIds: data.itemIds,
            query: text,
            messages: withReply,
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
    <FitCheckLandingShell
      navAction={<AccountDropdown />}
      subheading={`Hey, ${displayName ?? "there"} — let's find your next fit.`}
      inputValue={draft}
      onInputChange={setDraft}
      onAsk={(text) => {
        void handleSend(text);
        setDraft("");
      }}
      onPrompt={handleChip}
      onWardrobe={() => router.push("/wardrobe")}
      onPickMatch={() => router.push("/pick-match")}
      onSaved={() => router.push("/saved")}
      loading={fitzyLoading}
      messages={messages}
    />
  );

  /* Previous dashboard presentation is intentionally no longer rendered. */

  return (
    <div className="app-refresh app-home" style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
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
        /* Typing indicator dots in the Ask Fitzy mini-thread */
        .home-fitzy-dot {
          opacity: 0.5;
          animation: home-fitzy-dot 1.2s ease-in-out infinite;
        }
        @keyframes home-fitzy-dot {
          0%, 80%, 100% { transform: scale(1); opacity: 0.5; }
          40%            { transform: scale(1.4); opacity: 1; }
        }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "1rem clamp(1rem, 4vw, 3rem)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => router.push("/home")}
          style={{
            fontFamily: "var(--font-heading)", color: "var(--text)",
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
        <div className="home-hero" style={{ marginBottom: "1.75rem" }}>
          <div className="home-hero-shapes" aria-hidden="true">
            <svg className="home-shape home-shape-shirt" viewBox="0 0 120 110">
              <path d="M30 8 L10 28 L28 36 L24 100 L96 100 L92 36 L110 28 L90 8 Q80 0 72 6 Q65 18 60 18 Q55 18 48 6 Q40 0 30 8Z" />
            </svg>
            <svg className="home-shape home-shape-trousers" viewBox="0 0 100 130">
              <path d="M14 8 Q50 3 86 8 L82 58 L66 126 L49 126 L51 70 L46 70 L40 126 L23 126 L18 58 Z" />
              <path d="M18 18 L82 18 M31 22 Q35 34 45 37 M69 22 Q65 34 55 37 M50 8 L50 70" fill="none" />
            </svg>
            <svg className="home-shape home-shape-dress" viewBox="0 0 110 140">
              <path d="M36 6 Q28 2 20 14 L8 28 L26 36 L28 56 L82 56 L84 36 L102 28 L90 14 Q82 2 74 6 Q66 18 55 18 Q44 18 36 6Z" />
              <path d="M28 56 L14 136 L96 136 L82 56 Z" />
            </svg>
            <svg className="home-shape home-shape-bag" viewBox="0 0 100 110">
              <rect x="8" y="32" width="84" height="72" rx="6" />
              <path d="M28 32 Q28 8 50 8 Q72 8 72 32" fill="none" />
              <rect x="22" y="52" width="56" height="32" rx="4" fill="none" />
              <circle cx="50" cy="52" r="4" />
            </svg>
          </div>
          <div className="home-hero-copy">
          <h1
            className="app-page-title home-hero-title"
            style={{
              fontFamily: "var(--font-heading)", color: "var(--text)",
              fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
              fontWeight: 700, letterSpacing: "-0.02em",
              lineHeight: 1.2, margin: 0,
            }}
          >
            {greeting}
          </h1>
          <p className="home-hero-subtitle" style={{ color: "var(--text-muted)", fontSize: "0.9375rem", marginTop: "0.375rem" }}>
            Tell Fitzy what you&apos;re looking for today.
          </p>
          </div>
        </div>

        {/* ── Two-column grid ──────────────────────────────────────────────── */}
        <div className="home-grid">

          {/* ── Left: Fitzy search card ──────────────────────────────────── */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "clamp(1.25rem, 3vw, 2rem)",
              display: "flex", flexDirection: "column", gap: "1.25rem",
              minWidth: 0,
            }}
          >
            <div>
              <p
                className="app-section-title"
                style={{
                  fontFamily: "var(--font-heading)", color: "var(--text)",
                  fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem",
                }}
              >
                Ask Fitzy
              </p>

              {/* Mini conversation thread — local to this card, not shared
                  with the floating Fitzy widget elsewhere in the app. */}
              {messages.length > 0 && (
                <div
                  style={{
                    maxHeight: "240px",
                    overflowY: "auto",
                    display: "flex", flexDirection: "column", gap: "0.5rem",
                    padding: "0.25rem 0.125rem 0.75rem",
                  }}
                >
                  {messages.map((msg, i) => {
                    const isUser = msg.role === "user";
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                        <div
                          style={{
                            maxWidth: "85%",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.8125rem",
                            lineHeight: 1.5,
                            borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                            background: isUser ? "var(--text)" : "var(--bg)",
                            color: isUser ? "var(--bg)" : "var(--text)",
                            border: isUser ? "none" : "1px solid var(--border)",
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}

                  {fitzyLoading && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div
                        style={{
                          padding: "0.625rem 0.75rem",
                          borderRadius: "14px 14px 14px 4px",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          display: "flex", gap: "0.25rem",
                        }}
                      >
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="home-fitzy-dot"
                            style={{
                              width: "6px", height: "6px", borderRadius: "50%",
                              background: "var(--text-muted)",
                              animationDelay: `${i * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={threadEndRef} />
                </div>
              )}

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
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--text)",
                    outline: "none",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || fitzyLoading}
                  style={{
                    flexShrink: 0,
                    padding: "0.625rem 1rem",
                    fontSize: "0.875rem", fontWeight: 600,
                    background: "var(--accent)", color: "var(--accent-text)",
                    border: "1.5px solid var(--accent)",
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
                    background: "var(--bg)", color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: "999px",
                    cursor: fitzyLoading ? "not-allowed" : "pointer",
                    opacity: fitzyLoading ? 0.5 : 1,
                    whiteSpace: "nowrap",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!fitzyLoading) e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Caption */}
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
              Fitzy checks fit against your measurements automatically.
            </p>
          </div>

          {/* ── Right: avatar + quick-links card ─────────────────────────── */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
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
                onClick={() => router.push("/pick-match")}
                className="app-accent-blue"
                style={{ ...quickBtnStyle, background: "var(--accent)", borderColor: "var(--accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Pick &amp; Match
              </button>
              <button
                onClick={() => router.push("/saved")}
                className="app-accent-orange"
                style={quickBtnStyle}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                Saved items
              </button>
              <button
                onClick={() => router.push("/measure")}
                className="app-accent-green"
                style={quickBtnStyle}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
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
  background: "var(--surface)", color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  cursor: "pointer",
  textAlign: "center",
  transition: "border-color 0.15s",
};
