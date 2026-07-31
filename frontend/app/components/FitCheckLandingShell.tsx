"use client";

import type { ReactNode } from "react";

const QUICK_PROMPTS = ["Dinner date outfit", "Pair a jacket", "Browse streetwear"];

export default function FitCheckLandingShell({
  navAction,
  subheading,
  inputValue,
  onInputChange,
  onAsk,
  onPrompt,
  onWardrobe,
  onPickMatch,
  onSaved,
  loading = false,
  messages = [],
}: {
  navAction: ReactNode;
  subheading: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onAsk: (text: string) => void;
  onPrompt: (prompt: string) => void;
  onWardrobe: () => void;
  onPickMatch: () => void;
  onSaved: () => void;
  loading?: boolean;
  messages?: { role: "user" | "assistant"; content: string }[];
}) {
  return (
    <div className="landing-redesign min-h-screen flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <nav className="landing-nav sticky top-0 z-40 flex items-center justify-between px-6 py-4" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <span className="landing-logo text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)", color: "var(--text)" }}>
          FitCheck
        </span>
        {navAction}
      </nav>

      <main className="landing-hero relative flex-1 flex flex-col items-center px-6 pt-14 pb-10 gap-6 overflow-hidden">
        <div className="landing-silhouettes absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 120 110" width="180" height="165" style={{ position: "absolute", top: "4%", left: "3%", transform: "rotate(-8deg)", opacity: 0.32 }}>
            <path d="M30 8 L10 28 L28 36 L24 100 L96 100 L92 36 L110 28 L90 8 Q80 0 72 6 Q65 18 60 18 Q55 18 48 6 Q40 0 30 8Z" fill="#6FA0F5" stroke="#3b71c8" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
          <svg viewBox="0 0 100 130" width="138" height="179" style={{ position: "absolute", bottom: "6%", left: "7%", transform: "rotate(4deg)", opacity: 0.28 }}>
            <path d="M14 8 Q50 3 86 8 L82 58 L66 126 L49 126 L51 70 L46 70 L40 126 L23 126 L18 58 Z" fill="#31B77A" stroke="#14734F" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M18 18 L82 18" fill="none" stroke="#14734F" strokeWidth="2" />
            <path d="M31 22 Q35 34 45 37 M69 22 Q65 34 55 37" fill="none" stroke="#14734F" strokeWidth="1.6" />
            <line x1="50" y1="8" x2="50" y2="70" stroke="#14734F" strokeWidth="1.8" />
          </svg>
          <svg viewBox="0 0 110 140" width="150" height="190" style={{ position: "absolute", top: "2%", right: "5%", transform: "rotate(7deg)", opacity: 0.3 }}>
            <path d="M36 6 Q28 2 20 14 L8 28 L26 36 L28 56 L82 56 L84 36 L102 28 L90 14 Q82 2 74 6 Q66 18 55 18 Q44 18 36 6Z" fill="#E8734A" stroke="#b84e26" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M28 56 L14 136 L96 136 L82 56 Z" fill="#E8734A" stroke="#b84e26" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
          <svg viewBox="0 0 100 110" width="130" height="143" style={{ position: "absolute", bottom: "12%", right: "6%", transform: "rotate(-5deg)", opacity: 0.35 }}>
            <rect x="8" y="32" width="84" height="72" rx="6" fill="#6FA0F5" stroke="#3b71c8" strokeWidth="2.5" />
            <path d="M28 32 Q28 8 50 8 Q72 8 72 32" fill="none" stroke="#3b71c8" strokeWidth="5" strokeLinecap="round" />
            <rect x="22" y="52" width="56" height="32" rx="4" fill="none" stroke="#3b71c8" strokeWidth="2" />
            <circle cx="50" cy="52" r="4" fill="#3b71c8" />
          </svg>
        </div>

        <div className="landing-copy flex flex-col items-center gap-3 text-center max-w-lg relative z-10">
          <h1 className="font-bold tracking-tight leading-none" style={{ fontFamily: "var(--font-heading)", color: "var(--text)", fontSize: "clamp(42px, 8vw, 56px)" }}>FitCheck</h1>
          <p className="landing-shell-subheading text-base leading-relaxed max-w-lg">{subheading}</p>
          <p className="text-base leading-relaxed max-w-sm" style={{ color: "var(--text-muted)" }}>
            Ask Fitzy, and get real catalog picks matched to your actual measurements.
          </p>
        </div>

        <div className="fitzy-command w-full max-w-md flex flex-col gap-3 relative z-10 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 4px 24px rgba(11,26,51,0.07), 0 1px 4px rgba(11,26,51,0.05)" }}>
          {messages.length > 0 && (
            <div className="landing-fitzy-thread" aria-live="polite">
              {messages.map((message, index) => (
                <div key={index} className={`landing-fitzy-message ${message.role === "user" ? "is-user" : "is-assistant"}`}>
                  {message.content}
                </div>
              ))}
              {loading && <div className="landing-fitzy-message is-assistant">Fitzy is thinking…</div>}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); const text = inputValue.trim(); if (text && !loading) onAsk(text); }} className="flex gap-2">
            <input type="text" value={inputValue} onChange={(e) => onInputChange(e.target.value)} placeholder="e.g. What should I wear to a smart-casual dinner?" disabled={loading} className="flex-1 px-4 py-2.5 text-sm rounded-xl border focus:outline-none" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <button type="submit" disabled={loading || !inputValue.trim()} className="fitzy-ask px-4 py-2.5 text-sm font-semibold rounded-xl focus:outline-none focus-visible:ring-2 transition-colors flex-shrink-0" style={{ background: "var(--accent)", color: "var(--text)", border: "1.5px solid var(--accent)", opacity: loading ? .6 : 1 }}>{loading ? "…" : "Ask"}</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => <button key={prompt} onClick={() => onPrompt(prompt)} disabled={loading} className="px-3 py-1 text-xs font-medium rounded-full border transition-colors focus:outline-none focus-visible:ring-2" style={{ background: "var(--surface)", color: "var(--text-muted)", borderColor: "var(--border)" }}>{prompt}</button>)}
          </div>
        </div>

        <div className="landing-features w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
          <FeatureCard title="Build Your Wardrobe" body="Upload photos of clothes you already own, and let Fitzy style them alongside the catalog." onClick={onWardrobe} />
          <FeatureCard title="Pick & Match" body="Build a full outfit, swipe through every category, and see it as a set." onClick={onPickMatch} />
          <FeatureCard title="Saved Fits" body="Look back at outfits and items you've saved." onClick={onSaved} />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return <button onClick={onClick} className="landing-feature flex flex-col gap-2 text-left p-5 rounded-xl border focus:outline-none focus-visible:ring-2 transition-colors" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}><span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</span><span className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{body}</span></button>;
}
