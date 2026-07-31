"use client";

import { useState, useEffect } from "react";
import GateModal from "./components/GateModal";
import FitCheckLandingShell from "./components/FitCheckLandingShell";
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
  background: "var(--accent)",
  color: "var(--text)",
  border: "1.5px solid var(--accent)",
};

// Navy CTA — deep navy bg, off-white text (landing "Get started")
const BTN_NAVY: React.CSSProperties = {
  background: "var(--text)",
  color: "var(--bg)",
  border: "1.5px solid var(--text)",
};

// Ghost — white bg, navy text + border (landing "I already have an account")
const BTN_GHOST: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--text)",
  border: "1.5px solid var(--text)",
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

  const QUICK_PROMPTS = ["Dinner date outfit", "Pair a jacket", "Browse streetwear"];

  return (
    <>
      <FitCheckLandingShell
        navAction={(
          <button onClick={onGoChoice} className="landing-signin px-5 py-2 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors">
            Sign In
          </button>
        )}
        subheading="YOUR DIGITAL STYLIST"
        inputValue={chatInput}
        onInputChange={setChatInput}
        onAsk={() => setGate("fitzy")}
        onPrompt={(prompt) => { setChatInput(prompt); setGate("fitzy"); }}
        onWardrobe={() => setGate("catalogue")}
        onPickMatch={() => setGate("catalogue")}
        onSaved={() => setGate("fitzy")}
      />
      {gateProps && (
        <GateModal
          heading={gateProps.heading!}
          body={gateProps.body!}
          onClose={gateProps.onClose!}
          onRegister={gateProps.onRegister!}
          onLogin={gateProps.onLogin!}
        />
      )}
    </>
  );

  /* Legacy inline presentation retained temporarily for reference while the
     shared shell is exercised by both public and authenticated entry points. */

  return (
    <div className="landing-redesign min-h-screen flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav
        className="landing-nav sticky top-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="landing-logo text-lg font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)", color: "var(--text)" }}
        >
          FitCheck
        </span>
        <button
          onClick={onGoChoice}
          className="landing-signin px-5 py-2 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors"
          style={{ background: "var(--accent)", color: "var(--text)", border: "1.5px solid var(--accent)" }}
        >
          Sign In
        </button>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <main className="landing-hero relative flex-1 flex flex-col items-center px-6 pt-14 pb-10 gap-6 overflow-hidden">

        {/* background clothing silhouettes — absolutely positioned within the hero */}
        <div className="landing-silhouettes absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">

          {/* T-shirt — top-left, large, accent blue */}
          <svg
            viewBox="0 0 120 110"
            width="180" height="165"
            style={{ position: "absolute", top: "4%", left: "3%", transform: "rotate(-8deg)", opacity: 0.32 }}
          >
            <path
              d="M30 8 L10 28 L28 36 L24 100 L96 100 L92 36 L110 28 L90 8 Q80 0 72 6 Q65 18 60 18 Q55 18 48 6 Q40 0 30 8Z"
              fill="#6FA0F5" stroke="#3b71c8" strokeWidth="2.5" strokeLinejoin="round"
            />
          </svg>

          {/* Jeans/trousers — bottom-left, medium, coral */}
          {/*
            Fix: tighten the crotch gap. Previous path diverged the inner leg
            lines from x=50 all the way to x=42/58 at the hem, with Q-curves
            pulling outward to x=22/78 — making each leg look disconnected.
            New path keeps the inner edges much closer together (x=46/54 at
            crotch, Q-curves only reach x=44/56) so the two legs read as one
            connected garment. Waistband is also given a slightly curved top.
          */}
          <svg
            viewBox="0 0 100 130"
            width="138" height="179"
            style={{ position: "absolute", bottom: "6%", left: "7%", transform: "rotate(4deg)", opacity: 0.28 }}
          >
            <path
              d="M14 8 Q50 3 86 8 L82 58 L66 126 L49 126 L51 70 L46 70 L40 126 L23 126 L18 58 Z"
              fill="#31B77A" stroke="#14734F" strokeWidth="2.5" strokeLinejoin="round"
            />
            {/* fly seam — short center line from waist to crotch */}
            <path d="M18 18 L82 18" fill="none" stroke="#14734F" strokeWidth="2" />
            <path d="M31 22 Q35 34 45 37 M69 22 Q65 34 55 37" fill="none" stroke="#14734F" strokeWidth="1.6" />
            <line x1="50" y1="8" x2="50" y2="70" stroke="#14734F" strokeWidth="1.8" />
          </svg>

          {/* A-line dress — top-right, large, coral */}
          <svg
            viewBox="0 0 110 140"
            width="150" height="190"
            style={{ position: "absolute", top: "2%", right: "5%", transform: "rotate(7deg)", opacity: 0.30 }}
          >
            {/* bodice */}
            <path
              d="M36 6 Q28 2 20 14 L8 28 L26 36 L28 56 L82 56 L84 36 L102 28 L90 14 Q82 2 74 6 Q66 18 55 18 Q44 18 36 6Z"
              fill="#E8734A" stroke="#b84e26" strokeWidth="2.5" strokeLinejoin="round"
            />
            {/* skirt */}
            <path
              d="M28 56 L14 136 L96 136 L82 56 Z"
              fill="#E8734A" stroke="#b84e26" strokeWidth="2.5" strokeLinejoin="round"
            />
          </svg>

          {/* Structured tote bag — bottom-right, medium, accent blue */}
          <svg
            viewBox="0 0 100 110"
            width="130" height="143"
            style={{ position: "absolute", bottom: "12%", right: "6%", transform: "rotate(-5deg)", opacity: 0.35 }}
          >
            {/* bag body */}
            <rect x="8" y="32" width="84" height="72" rx="6"
              fill="#6FA0F5" stroke="#3b71c8" strokeWidth="2.5"
            />
            {/* handles */}
            <path d="M28 32 Q28 8 50 8 Q72 8 72 32"
              fill="none" stroke="#3b71c8" strokeWidth="5" strokeLinecap="round"
            />
            {/* pocket line */}
            <rect x="22" y="52" width="56" height="32" rx="4"
              fill="none" stroke="#3b71c8" strokeWidth="2"
            />
            {/* clasp */}
            <circle cx="50" cy="52" r="4" fill="#3b71c8" />
          </svg>

          {/* Sneaker — center-right area, accent blue */}
          {/*
            Redrawn from scratch in a 200×90 viewBox so proportions stay
            correct. The shoe faces right (toe at left, heel at right).

            Key decisions that fix the "beret" problem:
            - Upper never rises above y=22 (≈25% of height), keeping the
              silhouette low-profile and unmistakably shoe-shaped.
            - Toe box (left side) is rounded but stays below y=24.
            - Collar opening is a shallow concave cut at the heel-top, not
              a dome — this is what differentiates a shoe from a hat.
            - Sole is a flat-bottomed band with a slight heel stack.
            - Laces are near-horizontal cross-straps, not vertical lines.
          */}
          <svg
            viewBox="0 0 200 90"
            width="200" height="90"
            style={{ display: "none" }}
          >
            {/* ── sole — flat bottom, slight heel lift on right ── */}
            <path
              d="M18 72 Q10 74 10 68 L10 64 Q12 58 22 58 L170 58 Q190 58 192 64 L192 70 Q192 76 182 76 L30 76 Q20 76 18 72 Z"
              fill="#3A1723" stroke="#3A1723" strokeWidth="0" strokeLinejoin="round"
            />
            {/* ── upper — low-profile, toe rounds up gently, collar dips at heel ── */}
            <path
              d="M22 58
                 Q14 56 12 48
                 Q12 36 22 30
                 Q30 24 42 22
                 Q60 18 80 20
                 L126 20
                 Q150 18 166 26
                 Q180 34 182 46
                 Q184 54 178 58
                 L22 58 Z"
              fill="#F2E4D5" stroke="#6E293F" strokeWidth="2.2" strokeLinejoin="round"
            />
            {/* ── collar opening — concave arc at heel top ── */}
            <path
              d="M148 20 Q162 14 174 20 Q182 26 182 36 Q178 28 166 26 Q152 22 148 20 Z"
              fill="#6E293F" stroke="none"
            />
            {/* ── toe cap — darker rounded front ── */}
            <path
              d="M22 58 Q12 56 12 48 Q12 36 22 30 Q30 24 42 22 Q52 20 58 22 Q44 26 36 34 Q28 42 26 52 Q24 56 22 58 Z"
              fill="#B94A67" stroke="none"
            />
            {/* ── lace eyelets / cross-laces (horizontal, 3 pairs) ── */}
            <path d="M76 28 Q88 26 100 28" fill="none" stroke="#6E293F" strokeWidth="2" strokeLinecap="round"/>
            <path d="M76 28 L76 42 M100 28 L100 42" fill="none" stroke="#6E293F" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M76 42 Q88 40 100 42" fill="none" stroke="#6E293F" strokeWidth="2" strokeLinecap="round"/>
            <path d="M76 42 L78 54 M100 42 L98 54" fill="none" stroke="#6E293F" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M78 54 Q88 52 98 54" fill="none" stroke="#6E293F" strokeWidth="2" strokeLinecap="round"/>
            {/* ── midsole stripe ── */}
            <rect x="10" y="58" width="182" height="6" rx="0"
              fill="none" stroke="#6E293F" strokeWidth="1.5"
            />
          </svg>

        </div>

        {/* ── Wordmark + subtitle ──────────────────────────────────── */}
        <div className="landing-copy flex flex-col items-center gap-3 text-center max-w-lg relative z-10">
          <h1
            className="font-bold tracking-tight leading-none"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text)", fontSize: "clamp(42px, 8vw, 56px)" }}
          >
            FitCheck
          </h1>
          <p className="text-base leading-relaxed max-w-sm" style={{ color: "var(--text-muted)" }}>
            Ask Fitzy, and get real catalog picks matched to your actual measurements.
          </p>
        </div>

        {/* ── Fitzy input card ─────────────────────────────────────── */}
        <div
          className="fitzy-command w-full max-w-md flex flex-col gap-3 relative z-10 rounded-2xl p-4"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 24px rgba(11,26,51,0.07), 0 1px 4px rgba(11,26,51,0.05)",
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setGate("fitzy"); }}
              placeholder="e.g. What should I wear to a smart-casual dinner?"
              className="flex-1 px-4 py-2.5 text-sm rounded-xl border focus:outline-none"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            <button
              onClick={() => setGate("fitzy")}
            className="fitzy-ask px-4 py-2.5 text-sm font-semibold rounded-xl focus:outline-none focus-visible:ring-2 transition-colors flex-shrink-0"
              style={{ background: "var(--accent)", color: "var(--text)", border: "1.5px solid var(--accent)" }}
            >
              Ask
            </button>
          </div>

          {/* Quick-prompt chips */}
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => { setChatInput(prompt); setGate("fitzy"); }}
                className="px-3 py-1 text-xs font-medium rounded-full border transition-colors focus:outline-none focus-visible:ring-2"
                style={{
                  background: "var(--surface)",
                  color: "var(--text-muted)",
                  borderColor: "var(--border)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* ── Feature cards ────────────────────────────────────────── */}
        <div className="landing-features w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">

          {/* Browse catalogue */}
          <button
            onClick={() => setGate("catalogue")}
            className="landing-feature flex flex-col gap-2 text-left p-5 rounded-xl border focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Browse catalogue
            </span>
            <span className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Filter by category, gender, and style. Find your next fit.
            </span>
          </button>

          {/* Pick & Match */}
          <button
            onClick={() => setGate("catalogue")}
            className="landing-feature flex flex-col gap-2 text-left p-5 rounded-xl border focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Pick &amp; Match
            </span>
            <span className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Build a full outfit, swipe through every category, and see it as a set.
            </span>
          </button>

          {/* Honest AI review */}
          <button
            onClick={() => setGate("fitzy")}
            className="landing-feature flex flex-col gap-2 text-left p-5 rounded-xl border focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Honest AI review
            </span>
            <span className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Get a real, detailed opinion on fit and style — no scores, no fluff.
            </span>
          </button>
        </div>

      </main>

      {/* Gate modal is rendered by the shared shell return above. */}
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
              style={{ background: "var(--accent)", color: "var(--text)", border: "1.5px solid var(--accent)" }}
            >
              Create account
            </button>
            <button
              onClick={() => { setFlowOrigin("choice"); setMode("login"); setError(null); }}
              className="w-full px-8 py-3 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors"
              style={{ background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--text)" }}
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
