"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./lib/supabase";

// ─── types ────────────────────────────────────────────────────────────────────

// Top-level mode: which flow is the user in?
type Mode = "home" | "login" | "register";

// Within each flow, which step are we on?
type LoginScreen  = "email" | "otp";
type RegisterScreen = "details" | "email" | "otp";  // details = name + gender

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

// Standard email format check — covers the vast majority of valid addresses.
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
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
      style={{ color: "#2B3A55" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#2B3A55")}
      aria-label="Back"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [mode,   setMode]   = useState<Mode>("home");
  const [loading, setLoading] = useState(true); // true until session check done
  const [error,   setError]   = useState<string | null>(null);

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

      router.replace(existingM ? "/catalog" : "/measure");
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
    if (otpError) { setError(otpError.message); return; }
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
    router.push(existingM ? "/catalog" : "/measure");
    // leave loading=true
  }

  // ── REGISTER: step 1 — collect name + gender, then show email ─────────────
  function handleRegDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!regName.trim() || !regGender) {
      setError(!regGender ? "Please select your gender." : "Please enter your name.");
      return;
    }
    setError(null);
    setRegScreen("email");
  }

  // ── REGISTER: step 2 — send OTP ──────────────────────────────────────────
  // We do NOT query profiles here — unauthenticated RLS would block it.
  // The existing-account check happens after verify when the session exists.
  async function handleRegEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegEmailError(null);

    if (!isValidEmail(regEmail)) {
      setRegEmailError("Enter a valid email address.");
      return;
    }
    if (regEmail.toLowerCase() !== regEmailConfirm.toLowerCase()) {
      setRegEmailError("Emails don't match.");
      return;
    }

    setError(null);
    setLoading(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: regEmail.trim(),
      options: { shouldCreateUser: true },
    });

    setLoading(false);
    if (otpError) { setError(otpError.message); return; }
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
      router.push(existingM ? "/catalog" : "/measure");
    } else {
      router.push("/measure");
    }
    // leave loading=true
  }

  if (loading) return null;

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (mode === "home") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#FAFAF8" }}>
        <div className="flex flex-col items-center gap-8 text-center w-full max-w-xs">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              FitCheck
            </h1>
            <p className="text-lg tracking-wide" style={{ color: "#2B3A55" }}>
              Check it fits.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => { setMode("register"); setError(null); }}
              className="w-full px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2"
              style={BTN_PRIMARY}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            >
              Register
            </button>
            <button
              onClick={() => { setMode("login"); setError(null); }}
              className="w-full px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2"
              style={{ ...BTN_PRIMARY, background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Log In
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
        <main className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: "#FAFAF8" }}>
          <BackButton onClick={goHome} />
          <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>Log In</h2>
            <form onSubmit={handleLoginEmailSubmit} className="flex flex-col gap-3 w-full">
              <input
                type="email" value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="your@email.com" required autoFocus
                className="w-full px-4 py-2.5 text-sm rounded border focus:outline-none"
                style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#2B3A55")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "#D1D5DB")}
              />
              {error && <p className="text-xs text-left" style={{ color: "#B91C1C" }}>{error}</p>}
              {error?.includes("try Register") && (
                <button type="button" onClick={() => { resetLogin(); resetRegister(); setMode("register"); }}
                  className="text-xs text-left underline" style={{ color: "#2B3A55" }}>
                  Go to Register →
                </button>
              )}
              <button type="submit" disabled={loading || !loginEmail.trim()}
                className="px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
                style={BTN_PRIMARY}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#EEF1F6")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
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
      <main className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: "#FAFAF8" }}>
        <BackButton onClick={() => { setLoginScreen("email"); setLoginOtp(""); setError(null); }} />
        <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>Check your email</h2>
            <p className="text-sm" style={{ color: "#2B3A55" }}>
              We sent a code to <span className="font-medium">{loginEmail}</span>
            </p>
          </div>
          <form onSubmit={handleLoginOtpSubmit} className="flex flex-col gap-3 w-full">
            <input
              type="text" inputMode="numeric" value={loginOtp}
              onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code" maxLength={6} autoFocus
              className="w-full px-4 py-2.5 text-sm rounded border text-center tracking-widest font-mono focus:outline-none"
              style={INPUT_STYLE}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#2B3A55")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "#D1D5DB")}
            />
            {error && <p className="text-xs text-left" style={{ color: "#B91C1C" }}>{error}</p>}
            <button type="submit" disabled={loading || loginOtp.length < 6}
              className="px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
              style={BTN_PRIMARY}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#EEF1F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
          <button onClick={() => handleLoginEmailSubmit({ preventDefault: () => {} } as React.FormEvent)}
            disabled={loading} className="text-xs disabled:opacity-40" style={{ color: "#9CA3AF" }}>
            Resend code
          </button>
        </div>
      </main>
    );
  }

  // ── REGISTER ─────────────────────────────────────────────────────────────
  if (regScreen === "details") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: "#FAFAF8" }}>
        <BackButton onClick={goHome} />
        <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>Create account</h2>
          <form onSubmit={handleRegDetailsSubmit} className="flex flex-col gap-3 w-full text-left">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#374151" }}>Display name</label>
              <input
                type="text" value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Your name" required autoFocus
                className="w-full px-4 py-2.5 text-sm rounded border focus:outline-none"
                style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#2B3A55")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "#D1D5DB")}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#374151" }}>Shop for</label>
              <div className="flex gap-2">
                {GENDER_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value} type="button"
                    onClick={() => setRegGender(value)}
                    className="flex-1 py-2.5 text-sm font-semibold rounded border transition-colors focus:outline-none focus-visible:ring-2"
                    style={regGender === value
                      ? { background: "#2B3A55", color: "#fff", borderColor: "#2B3A55" }
                      : { background: "#fff", color: "#2B3A55", borderColor: "#D1D5DB" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs" style={{ color: "#B91C1C" }}>{error}</p>}
            <button type="submit" disabled={!regName.trim() || !regGender}
              className="mt-1 px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
              style={BTN_PRIMARY}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            >
              Continue
            </button>
          </form>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            Already have an account?{" "}
            <button onClick={() => { resetRegister(); setMode("login"); }}
              className="underline" style={{ color: "#2B3A55" }}>
              Log In
            </button>
          </p>
        </div>
      </main>
    );
  }

  if (regScreen === "email") {
    // Confirm field only shows an error once the user has typed something in it
    const confirmTouched = regEmailConfirm.length > 0;
    const mismatch = confirmTouched && regEmail.toLowerCase() !== regEmailConfirm.toLowerCase();
    const canSubmit = !loading && isValidEmail(regEmail) && !mismatch && regEmailConfirm.length > 0;

    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: "#FAFAF8" }}>
        <BackButton onClick={() => { setRegScreen("details"); setRegEmailError(null); setError(null); }} />
        <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>Your email</h2>
          <form onSubmit={handleRegEmailSubmit} className="flex flex-col gap-3 w-full">
            <div className="flex flex-col gap-1">
              <input
                type="email" value={regEmail}
                onChange={(e) => { setRegEmail(e.target.value); setRegEmailError(null); }}
                placeholder="your@email.com" required autoFocus
                className="w-full px-4 py-2.5 text-sm rounded border focus:outline-none"
                style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#2B3A55")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "#D1D5DB")}
              />
              {regEmail.length > 0 && !isValidEmail(regEmail) && (
                <p className="text-xs text-left" style={{ color: "#B91C1C" }}>
                  Enter a valid email address.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <input
                type="email" value={regEmailConfirm}
                onChange={(e) => { setRegEmailConfirm(e.target.value); setRegEmailError(null); }}
                placeholder="Confirm email address"
                className="w-full px-4 py-2.5 text-sm rounded border focus:outline-none"
                style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#2B3A55")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "#D1D5DB")}
              />
              {mismatch && (
                <p className="text-xs text-left" style={{ color: "#B91C1C" }}>
                  Emails don&apos;t match.
                </p>
              )}
            </div>

            {/* Server/submit-level errors (e.g. OTP send failed) */}
            {regEmailError && <p className="text-xs text-left" style={{ color: "#B91C1C" }}>{regEmailError}</p>}
            {error && <p className="text-xs text-left" style={{ color: "#B91C1C" }}>{error}</p>}

            <button type="submit" disabled={!canSubmit}
              className="px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
              style={BTN_PRIMARY}
              onMouseEnter={(e) => canSubmit && (e.currentTarget.style.background = "#EEF1F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
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
    <main className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: "#FAFAF8" }}>
      <BackButton onClick={() => { setRegScreen("email"); setRegOtp(""); setError(null); }} />
      <div className="flex flex-col items-center gap-6 text-center w-full max-w-xs">
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>Check your email</h2>
          <p className="text-sm" style={{ color: "#2B3A55" }}>
            We sent a code to <span className="font-medium">{regEmail}</span>
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
            className="w-full px-4 py-2.5 text-sm rounded border text-center tracking-widest font-mono focus:outline-none"
            style={INPUT_STYLE}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#2B3A55")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "#D1D5DB")}
          />
          {error && <p className="text-xs text-left" style={{ color: "#B91C1C" }}>{error}</p>}
          <button type="submit" disabled={loading || regOtp.length < 6}
            className="px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40"
            style={BTN_PRIMARY}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#EEF1F6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
        <button onClick={() => handleRegEmailSubmit({ preventDefault: () => {} } as React.FormEvent)}
          disabled={loading} className="text-xs disabled:opacity-40" style={{ color: "#9CA3AF" }}>
          Resend code
        </button>
      </div>
    </main>
  );
}
