"use client";

import { useState, useEffect } from "react";
import GateModal from "./components/GateModal";
import { useRouter } from "next/navigation";
import { createClient } from "./lib/supabase";

// ─── types ────────────────────────────────────────────────────────────────────

// Top-level mode: which flow is the user in?
type Mode = "home" | "choice" | "login" | "register";

// Within each flow, which step are we on?
type LoginScreen  = "email" | "otp";
type RegisterScreen = "details" | "email" | "otp";  // details = name + gender

// ─── shared style helpers ─────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
};

// Primary CTA — ice-blue fill (nav Sign In, auth screens, Check Fit, etc.)
const BTN_PRIMARY: React.CSSProperties = {
  background: "#8FB7FF",
  color: "#0B1A33",
  border: "1.5px solid #8FB7FF",
};

// Navy CTA — deep navy bg, off-white text (landing "Get started")
const BTN_NAVY: React.CSSProperties = {
  background: "#0B1A33",
  color: "#F7F5F1",
  border: "1.5px solid #0B1A33",
};

// Ghost — white bg, navy text + border (landing "I already have an account")
const BTN_GHOST: React.CSSProperties = {
  background: "#FFFFFF",
  color: "#0B1A33",
  border: "1.5px solid #0B1A33",
};

// Requires a proper domain with a TLD of 2+ letters — rejects "123@damisi".
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim());
}

// Converts any Supabase AuthError into a human-readable string.
//
// Two confirmed failure modes for this project:
//
//   status=500, message="{}"
//     The SDK throws AuthRetryableFetchError *before* parsing the response body,
//     so JSON.stringify(fetchResponse) === "{}" is all we get.  The actual
//     Supabase body is {"message":"Error sending magic link email"} — the email
//     provider (SMTP) is not configured in the Supabase dashboard.
//
//   status=422, message="Signups not allowed for otp", error_code="otp_disabled"
//     Email OTP is disabled in Authentication → Providers → Email inside the
//     Supabase dashboard.
//
// For anything else the raw SDK message is returned as-is.
function normaliseAuthError(err: { message?: string; status?: number } | null | undefined): string {
  if (!err) return "Something went wrong — please try again.";
  const status = err.status ?? 0;
  const raw    = typeof err.message === "string" ? err.message.trim() : "";

  // Rate-limit (429 or keyword)
  if (status === 429 || raw.toLowerCase().includes("rate limit") || raw.toLowerCase().includes("rate_limit")) {
    return "Too many attempts — please wait a few minutes and try again.";
  }

  // 5xx / network error — SDK gives "{}" because it never parsed the body.
  // Real cause: SMTP not configured in Supabase dashboard.
  if (raw === "" || raw === "{}") {
    return "Email sending failed. The email provider (SMTP) may not be configured — check Authentication → Settings → SMTP in the Supabase dashboard.";
  }

  // OTP disabled in Supabase dashboard
  if (raw.toLowerCase().includes("otp") && raw.toLowerCase().includes("disabled")) {
    return "Email sign-in is disabled. Enable it in Authentication → Providers → Email in the Supabase dashboard.";
  }

  return raw;
}

const GENDER_OPTIONS: { value: "men" | "women"; label: string }[] = [
  { value: "men",   label: "Men" },
  { value: "women", label: "Women" },
];

// ─── shared sub-components ────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-6 left-6 flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded"
      style={{ color: "var(--text-muted)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      aria-label="Back"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  );
}

// ─── LandingPage sub-component ───────────────────────────────────────────────

type GateTarget = "fitzy" | "catalogue" | "avatar" | null;

const GATE_COPY: Record<
  Exclude<GateTarget, null>,
  { heading: string; body: string }
> = {
  fitzy: {
    heading: "Uh oh — Fitzy needs to know who you are first",
    body: "Fitzy can't give you outfit advice without knowing your measurements and style. Create a free account and let's get you looking sharp.",
  },
  catalogue: {
    heading: "The catalogue is members-only",
    body: "Our full catalogue of fits is reserved for registered users. Takes 30 seconds to join — Fitzy will personally thank you.",
  },
  avatar: {
    heading: "That avatar is waiting for your body data",
    body: "Your 3D avatar only comes alive once you're a member. Register to unlock it and start trying clothes on virtually.",
  },
};

function LandingPage({
  onGoRegister,
  onGoLogin,
  onGoChoice,
}: {
  onGoRegister: () => void;
  onGoLogin: () => void;
  onGoChoice: () => void;
}) {
  const [gate, setGate] = useState<GateTarget>(null);
  const [chatInput, setChatInput] = useState("");

  const gateProps = gate
    ? {
        heading: GATE_COPY[gate].heading,
        body: GATE_COPY[gate].body,
        onClose: () => setGate(null),
        onRegister: () => { setGate(null); onGoRegister(); },
        onLogin: () => { setGate(null); onGoLogin(); },
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F7F5F1", color: "#0B1A33" }}>
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "#F7F5F1", borderBottom: "1px solid #E2DDD6" }}
      >
        <span
          className="text-lg font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)", color: "#0B1A33" }}
        >
          FitCheck
        </span>
        <button
          onClick={onGoChoice}
          className="px-5 py-2 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors"
          style={{ background: "#8FB7FF", color: "#0B1A33", border: "1.5px solid #8FB7FF" }}
        >
          Sign In
        </button>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-10 py-16">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <h1
            className="text-4xl font-bold tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-heading)", color: "#0B1A33" }}
          >
            Does it actually fit?
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "#6B7280" }}>
            Upload an item, get an honest AI verdict on fit, style, and whether
            it's actually worth buying. Built for real bodies, not mannequins.
          </p>
        </div>

        {/* ── Fitzy chat input ──────────────────────────────────────── */}
        <div className="w-full max-w-md flex flex-col gap-2">
          <p className="text-xs font-medium text-left" style={{ color: "#6B7280" }}>
            Ask Fitzy anything about your wardrobe
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setGate("fitzy"); }}
              placeholder="e.g. What should I wear to a smart-casual dinner?"
              className="flex-1 px-4 py-2.5 text-sm rounded-lg border focus:outline-none"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2DDD6",
                color: "#0B1A33",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "#E2DDD6")}
            />
            <button
              onClick={() => setGate("fitzy")}
              className="px-4 py-2.5 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors"
              style={{ background: "#8FB7FF", color: "#0B1A33", border: "1.5px solid #8FB7FF" }}
            >
              Ask
            </button>
          </div>
        </div>

        {/* ── Feature row ───────────────────────────────────────────── */}
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Browse catalogue card */}
          <button
            onClick={() => setGate("catalogue")}
            className="flex flex-col gap-2 text-left p-5 rounded-xl border focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "#FFFFFF", border: "1px solid #E2DDD6" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
          >
            <span className="text-sm font-semibold" style={{ color: "#0B1A33" }}>
              Browse catalogue
            </span>
            <span className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
              Filter by category, gender, and style. Find your next fit.
            </span>
          </button>

          {/* Avatar card */}
          <button
            onClick={() => setGate("avatar")}
            className="flex flex-col gap-2 text-left p-5 rounded-xl border focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "#FFFFFF", border: "1px solid #E2DDD6" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
          >
            <span className="text-sm font-semibold" style={{ color: "#0B1A33" }}>
              Your avatar
            </span>
            <span className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
              A 3D model built around your exact measurements.
            </span>
          </button>

          {/* AI fit check card — also gates */}
          <button
            onClick={() => setGate("fitzy")}
            className="flex flex-col gap-2 text-left p-5 rounded-xl border focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "#FFFFFF", border: "1px solid #E2DDD6" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8FB7FF")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD6")}
          >
            <span className="text-sm font-semibold" style={{ color: "#0B1A33" }}>
              AI fit check
            </span>
            <span className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
              Upload any item and get an honest verdict in seconds.
            </span>
          </button>
        </div>
      </main>

      {/* ── Gate modals ─────────────────────────────────────────────── */}
      {gateProps && <GateModal {...gateProps} />}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [mode,   setMode]   = useState<Mode>("home");
  const [loading, setLoading] = useState(true); // true until session check done
  const [error,   setError]   = useState<string | null>(null);

  // ── Back-navigation origin — tracks which mode spawned login/register ────────
  // "choice" = came via the Sign In → choice picker
  // "home"   = came directly from a GateModal on the landing page
  const [flowOrigin, setFlowOrigin] = useState<"home" | "choice">("choice");

  // ── Login state ─────────────────────────────────────────────────────────────
  const [loginScreen, setLoginScreen] = useState<LoginScreen>("email");
  const [loginEmail,  setLoginEmail]  = useState("");
  const [loginOtp,    setLoginOtp]    = useState("");

  // ── Register state ───────────────────────────────────────────────────────────
  const [regScreen,      setRegScreen]      = useState<RegisterScreen>("details");
  const [regName,        setRegName]        = useState("");
  const [regGender,      setRegGender]      = useState<"men" | "women" | "">("");
  const [regEmail,        setRegEmail]        = useState("");
  const [regEmailConfirm, setRegEmailConfirm] = useState("");
  const [regEmailError,   setRegEmailError]   = useState<string | null>(null);
  const [regOtp,          setRegOtp]          = useState("");
  // If the email already has an account we silently treat Register as Log In
  const [regIsExisting,  setRegIsExisting]  = useState(false);

  // ── Session check on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: existingM } = await supabase
        .from("measurements").select("id").eq("user_id", user.id).maybeSingle();

      router.replace(existingM ? "/home" : "/measure");
      // leave loading=true — navigating away
    }
    checkSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── helpers ───────────────────────────────────────────────────────────────
  function resetLogin() {
    setLoginScreen("email");
    setLoginEmail("");
    setLoginOtp("");
    setError(null);
  }

  function resetRegister() {
    setRegScreen("details");
    setRegName("");
    setRegGender("");
    setRegEmail("");
    setRegEmailConfirm("");
    setRegEmailError(null);
    setRegOtp("");
    setRegIsExisting(false);
    setError(null);
  }

  function goHome() {
    resetLogin();
    resetRegister();
    setMode("home");
  }

  function goBack() {
    // Returns to the screen that launched the current login/register flow.
    resetLogin();
    resetRegister();
    setMode(flowOrigin);
  }

  // ── LOGIN: step 1 — send OTP ──────────────────────────────────────────────
  // We do NOT query profiles here — the user is unauthenticated and RLS would
  // block any select on profiles. Instead we send OTP immediately and check
  // for a profiles row after the session is established.
  async function handleLoginEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    setError(null);
    setLoading(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: loginEmail.trim(),
      options: { shouldCreateUser: false },
    });

    setLoading(false);
    if (otpError) { setError(normaliseAuthError(otpError)); return; }
    setLoginScreen("otp");
  }

  // ── LOGIN: step 2 — verify OTP ────────────────────────────────────────────
  async function handleLoginOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginOtp.trim()) return;
    setError(null);
    setLoading(true);

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: loginEmail.trim(),
      token: loginOtp.trim(),
      type: "email",
    });

    if (verifyError || !verifyData.user) {
      setLoading(false);
      setError(verifyError?.message ?? "Verification failed — please try again.");
      return;
    }

    const user = verifyData.user;

    // Now authenticated — check for a profiles row. RLS passes because
    // auth.uid() == user.id. No profiles row means this email was never
    // registered through our app (e.g. it exists in auth.users but has
    // no profile), so we sign them out and direct them to Register.
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", user.id).maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("No account found for this email — try Register instead.");
      return;
    }

    const { data: existingM } = await supabase
      .from("measurements").select("id").eq("user_id", user.id).maybeSingle();
    router.replace(existingM ? "/home" : "/measure");
    // leave loading=true
  }

  // ── REGISTER: step 1 — collect name + gender, then show email ─────────────
  function handleRegDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!regName.trim() || !regGender) {
      setError(!regGender ? "Please select your gender." : "Please enter your name.");
      return;
    }
    setRegEmailError(null);
    setError(null);
    setRegScreen("email");
  }

  // ── REGISTER: step 2 — send OTP ──────────────────────────────────────────
  // We do NOT query profiles here — unauthenticated RLS would block it.
  // The existing-account check happens after verify when the session exists.
  async function handleRegEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegEmailError(null);
    setError(null);

    if (!isValidEmail(regEmail)) {
      setRegEmailError("Enter a valid email address.");
      return;
    }
    if (regEmail.toLowerCase() !== regEmailConfirm.toLowerCase()) {
      setRegEmailError("Emails don't match.");
      return;
    }

    setLoading(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: regEmail.trim(),
      options: { shouldCreateUser: true },
    });

    setLoading(false);
    if (otpError) { setError(normaliseAuthError(otpError)); return; }
    setRegScreen("otp");
  }

  // ── REGISTER: step 3 — verify OTP ────────────────────────────────────────
  async function handleRegOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!regOtp.trim()) return;
    setError(null);
    setLoading(true);

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: regEmail.trim(),
      token: regOtp.trim(),
      type: "email",
    });

    if (verifyError || !verifyData.user) {
      setLoading(false);
      setError(verifyError?.message ?? "Verification failed — please try again.");
      return;
    }

    const user = verifyData.user;

    // Now authenticated — check for an existing profiles row using the
    // established session. RLS passes because auth.uid() == user.id.
    const { data: existingProfile } = await supabase
      .from("profiles").select("id").eq("id", user.id).maybeSingle();

    const isExisting = !!existingProfile;
    // Keep UI in sync (used by the amber notice on the OTP screen)
    setRegIsExisting(isExisting);

    if (isExisting) {
      // Treat as login — do NOT overwrite display_name or gender.
      // ignoreDuplicates: true means the row is left completely unchanged.
      const { error: upsertErr } = await supabase.from("profiles").upsert(
        { id: user.id, email: user.email },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (upsertErr) console.error("[register] profile upsert (existing):", upsertErr.message);
    } else {
      // New account — write display_name and gender.
      const { error: upsertErr } = await supabase.from("profiles").upsert(
        { id: user.id, email: user.email, display_name: regName.trim(), gender: regGender },
        { onConflict: "id", ignoreDuplicates: false },
      );
      if (upsertErr) {
        // Surface this to the user — a failed profile write is a real error.
        setLoading(false);
        setError("Failed to save your profile — please try again.");
        console.error("[register] profile upsert (new):", upsertErr.message);
        return;
      }
    }

    if (isExisting) {
      const { data: existingM } = await supabase
        .from("measurements").select("id").eq("user_id", user.id).maybeSingle();
      router.replace(existingM ? "/home" : "/measure");
    } else {
      router.push("/measure");
    }
    // leave loading=true
  }

  if (loading) return null;

  // ── HOME — landing page ───────────────────────────────────────────────────
  if (mode === "home") {
    return (
      <LandingPage
        onGoRegister={() => { setFlowOrigin("home"); setMode("register"); setError(null); }}
        onGoLogin={() => { setFlowOrigin("home"); setMode("login"); setError(null); }}
        onGoChoice={() => { setMode("choice"); setError(null); }}
      />
    );
  }

  // ── CHOICE — register or log in picker ───────────────────────────────────
  if (mode === "choice") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 relative">
        <BackButton onClick={goHome} />   {/* choice always came from home */}
        <div className="flex flex-col items-center gap-8 text-center w-full max-w-xs">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight font-heading" style={{ color: "var(--text)" }}>
              Welcome to FitCheck
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Create a new account or sign in to an existing one.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => { setFlowOrigin("choice"); setMode("register"); setError(null); }}
              className="w-full px-8 py-3 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors"
              style={{ background: "#8FB7FF", color: "#0B1A33", border: "1.5px solid #8FB7FF" }}
            >
              Create account
            </button>
            <button
              onClick={() => { setFlowOrigin("choice"); setMode("login"); setError(null); }}
              className="w-full px-8 py-3 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors"
              style={{ background: "#FFFFFF", color: "#0B1A33", border: "1.5px solid #0B1A33" }}
            >
              Log in
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (mode === "login") {
    if (loginScreen === "email") {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center px-6 relative">
          <BackButton onClick={goBack} />
          <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
            <h2 className="text-2xl font-bold tracking-tight font-heading" style={{ color: "var(--text)" }}>Log In</h2>
            <form onSubmit={handleLoginEmailSubmit} className="flex flex-col gap-3 w-full">
              <input
                type="email" value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="your@email.com" required autoFocus
                className="w-full px-4 py-2.5 text-sm rounded-lg border focus:outline-none"
                style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              {error && <p className="text-xs text-left" style={{ color: "var(--danger)" }}>{error}</p>}
              {error?.includes("try Register") && (
                <button type="button" onClick={() => { resetLogin(); resetRegister(); setMode("register"); }}
                  className="text-xs text-left underline" style={{ color: "var(--accent)" }}>
                  Go to Register →
                </button>
              )}
              <button type="submit" disabled={loading || !loginEmail.trim()}
                className="px-8 py-3 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
                style={BTN_PRIMARY}
              >
                {loading ? "Checking…" : "Continue"}
              </button>
            </form>
          </div>
        </main>
      );
    }

    // login OTP screen
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 relative">
        <BackButton onClick={() => { setLoginScreen("email"); setLoginOtp(""); setError(null); }} />
        <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight font-heading" style={{ color: "var(--text)" }}>
              Enter the code we sent to sign you in
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Sent to <span className="font-medium" style={{ color: "var(--text)" }}>{loginEmail}</span>
            </p>
          </div>
          <form onSubmit={handleLoginOtpSubmit} className="flex flex-col gap-3 w-full">
            <input
              type="text" inputMode="numeric" value={loginOtp}
              onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code" maxLength={6} autoFocus
              className="w-full px-4 py-2.5 text-sm rounded-lg border text-center tracking-widest font-mono focus:outline-none"
              style={INPUT_STYLE}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            {error && <p className="text-xs text-left" style={{ color: "var(--danger)" }}>{error}</p>}
            <button type="submit" disabled={loading || loginOtp.length < 6}
              className="px-8 py-3 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
              style={BTN_PRIMARY}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <button onClick={() => handleLoginEmailSubmit({ preventDefault: () => {} } as React.FormEvent)}
            disabled={loading} className="text-xs disabled:opacity-40" style={{ color: "var(--text-muted)" }}>
            Resend code
          </button>
        </div>
      </main>
    );
  }

  // ── REGISTER ─────────────────────────────────────────────────────────────
  if (regScreen === "details") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 relative">
        <BackButton onClick={goBack} />
        <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
          <h2 className="text-2xl font-bold tracking-tight font-heading" style={{ color: "var(--text)" }}>Create account</h2>
          <form onSubmit={handleRegDetailsSubmit} className="flex flex-col gap-3 w-full text-left">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Display name</label>
              <input
                type="text" value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Your name" required autoFocus
                className="w-full px-4 py-2.5 text-sm rounded-lg border focus:outline-none"
                style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Shop for</label>
              <div className="flex gap-2">
                {GENDER_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value} type="button"
                    onClick={() => setRegGender(value)}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-lg border transition-colors focus:outline-none focus-visible:ring-2"
                    style={regGender === value
                      ? { background: "var(--accent)", color: "var(--accent-text)", borderColor: "var(--accent)" }
                      : { background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
            <button type="submit" disabled={!regName.trim() || !regGender}
              className="mt-1 px-8 py-3 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
              style={BTN_PRIMARY}
            >
              Continue
            </button>
          </form>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <button onClick={() => { resetRegister(); setMode("login"); /* flowOrigin stays the same — user came from same place */ }}
              className="underline" style={{ color: "var(--accent)" }}>
              Log In
            </button>
          </p>
        </div>
      </main>
    );
  }

  if (regScreen === "email") {
    const emailTouched   = regEmail.length > 0;
    const emailInvalid   = emailTouched && !isValidEmail(regEmail);
    const confirmTouched = regEmailConfirm.length > 0;
    const mismatch       = confirmTouched && regEmail.toLowerCase() !== regEmailConfirm.toLowerCase();
    const canSubmit      = !loading && isValidEmail(regEmail) && !mismatch && regEmailConfirm.length > 0;

    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 relative">
        <BackButton onClick={() => { setRegScreen("details"); setRegEmailError(null); setError(null); }} />
        <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
          <h2 className="text-2xl font-bold tracking-tight font-heading" style={{ color: "var(--text)" }}>Your email</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) return;
              handleRegEmailSubmit(e);
            }}
            className="flex flex-col gap-3 w-full"
          >
            <div className="flex flex-col gap-1">
              <input
                type="email" value={regEmail}
                onChange={(e) => { setRegEmail(e.target.value); setRegEmailError(null); setError(null); }}
                onBlur={() => {
                  if (regEmail.length > 0 && !isValidEmail(regEmail)) {
                    setRegEmailError("Enter a valid email address (e.g. you@example.com).");
                  }
                }}
                placeholder="your@email.com" required autoFocus
                className="w-full px-4 py-2.5 text-sm rounded-lg border focus:outline-none"
                style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              />
              {emailInvalid && !regEmailError && (
                <p className="text-xs text-left" style={{ color: "var(--danger)" }}>
                  Enter a valid email address (e.g. you@example.com).
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <input
                type="email" value={regEmailConfirm}
                onChange={(e) => { setRegEmailConfirm(e.target.value); setRegEmailError(null); setError(null); }}
                placeholder="Confirm email address"
                className="w-full px-4 py-2.5 text-sm rounded-lg border focus:outline-none"
                style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              {mismatch && (
                <p className="text-xs text-left" style={{ color: "var(--danger)" }}>
                  Emails don&apos;t match.
                </p>
              )}
            </div>

            {!!regEmailError && typeof regEmailError === "string" && (
              <p className="text-xs text-left" style={{ color: "var(--danger)" }}>{regEmailError}</p>
            )}
            {!!error && typeof error === "string" && (
              <p className="text-xs text-left" style={{ color: "var(--danger)" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="px-8 py-3 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
              style={BTN_PRIMARY}
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // register OTP screen
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 relative">
      <BackButton onClick={() => { setRegScreen("email"); setRegOtp(""); setError(null); }} />
      <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight font-heading" style={{ color: "var(--text)" }}>
            Enter the code we sent to confirm your account
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Sent to <span className="font-medium" style={{ color: "var(--text)" }}>{regEmail}</span>
          </p>
          {regIsExisting && (
            <p className="text-xs mt-1 px-3 py-1.5 rounded-lg" style={{ background: "#FEF3C7", color: "#92400E" }}>
              This email already has an account — signing you in instead.
            </p>
          )}
        </div>
        <form onSubmit={handleRegOtpSubmit} className="flex flex-col gap-3 w-full">
          <input
            type="text" inputMode="numeric" value={regOtp}
            onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code" maxLength={6} autoFocus
            className="w-full px-4 py-2.5 text-sm rounded-lg border text-center tracking-widest font-mono focus:outline-none"
            style={INPUT_STYLE}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          {error && <p className="text-xs text-left" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" disabled={loading || regOtp.length < 6}
            className="px-8 py-3 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
            style={BTN_PRIMARY}
          >
            {loading ? "Confirming…" : "Confirm account"}
          </button>
        </form>
        <button onClick={() => handleRegEmailSubmit({ preventDefault: () => {} } as React.FormEvent)}
          disabled={loading} className="text-xs disabled:opacity-40" style={{ color: "var(--text-muted)" }}>
          Resend code
        </button>
      </div>
    </main>
  );
}
