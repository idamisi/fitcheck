"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./lib/supabase";

// ─── types ────────────────────────────────────────────────────────────────────

type Screen = "email" | "otp";

// ─── shared style helpers ─────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  borderColor: "#D1D5DB",
  background: "#fff",
  color: "#1A1A1A",
};

const BTN_PRIMARY: React.CSSProperties = {
  background: "#FFFFFF",
  color: "#2B3A55",
  border: "1.5px solid #2B3A55",
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [screen, setScreen] = useState<Screen>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(true);  // true until session check done
  const [error, setError] = useState<string | null>(null);

  // ── Session check on mount ────────────────────────────────────────────────
  // A signed-in user who navigates to / (e.g. by pressing Back past /measure)
  // should never see the sign-in screen again. Route them forward based on
  // whether they already have measurements saved.
  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Already authenticated — decide where to send them
      const { data: existingM } = await supabase
        .from("measurements")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingM) {
        router.replace("/catalog");
      } else {
        router.replace("/measure");
      }
      // No setLoading(false) here — we're navigating away so the component
      // will unmount. Leaving loading=true keeps the page blank during redirect.
    }

    checkSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 1: send OTP ───────────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    setScreen("otp");
  }

  // ── Step 2: verify OTP → new vs returning branch ───────────────────────────
  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return;
    setError(null);
    setLoading(true);

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });

    if (verifyError || !verifyData.user) {
      setLoading(false);
      setError(verifyError?.message ?? "Verification failed — please try again.");
      return;
    }

    const user = verifyData.user;

    // Ensure profiles row exists (safe to upsert every sign-in)
    await supabase.from("profiles").upsert(
      { id: user.id, email: user.email },
      { onConflict: "id", ignoreDuplicates: true },
    );

    // Check for existing measurements to determine new vs returning
    const { data: existingM } = await supabase
      .from("measurements")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Use push (not replace) so this auth flow is a real history entry.
    // The user can't go Back to the sign-in screen from /measure or /catalog
    // because we already checked for a session at the top — they'd be
    // redirected forward immediately. But push keeps the stack coherent.
    if (existingM) {
      router.push("/catalog");
    } else {
      router.push("/measure");
    }
    // leave loading=true — component will unmount on navigation
  }

  // While session check is running, show nothing (avoids flash of sign-in UI)
  if (loading) return null;

  // ── Screen: email entry ────────────────────────────────────────────────────
  if (screen === "email") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#FAFAF8" }}>
        <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              FitCheck
            </h1>
            <p className="text-lg tracking-wide" style={{ color: "#2B3A55" }}>
              Check it fits.
            </p>
          </div>

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3 w-full">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
              className="w-full px-4 py-2.5 text-sm rounded border focus:outline-none"
              style={INPUT_STYLE}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#2B3A55")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
            />
            {error && (
              <p className="text-xs text-left" style={{ color: "#B91C1C" }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
              style={BTN_PRIMARY}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#EEF1F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            >
              {loading ? "Sending…" : "Continue"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Screen: OTP code entry ─────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: "#FAFAF8" }}>
      <button
        onClick={() => { setScreen("email"); setOtp(""); setError(null); }}
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

      <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
            Check your email
          </h2>
          <p className="text-sm" style={{ color: "#2B3A55" }}>
            We sent a code to <span className="font-medium">{email}</span>
          </p>
        </div>

        <form onSubmit={handleOtpSubmit} className="flex flex-col gap-3 w-full">
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            maxLength={6}
            autoFocus
            className="w-full px-4 py-2.5 text-sm rounded border text-center tracking-widest font-mono focus:outline-none"
            style={INPUT_STYLE}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#2B3A55")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
          />
          {error && (
            <p className="text-xs text-left" style={{ color: "#B91C1C" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
            style={BTN_PRIMARY}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#EEF1F6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        <button
          onClick={handleEmailSubmit as unknown as React.MouseEventHandler}
          disabled={loading}
          className="text-xs disabled:opacity-40"
          style={{ color: "#9CA3AF" }}
        >
          Resend code
        </button>
      </div>
    </main>
  );
}
