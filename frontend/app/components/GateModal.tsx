"use client";

// ─── GateModal ────────────────────────────────────────────────────────────────
// Logged-out interrupt modal. Used on the landing page for Fitzy, Browse
// catalogue, and the avatar — each trigger passes its own heading + body copy.
// The parent controls navigation via onRegister / onLogin callbacks so this
// component never redirects on its own.

type Props = {
  heading: string;
  body: string;
  onClose: () => void;
  onRegister: () => void;
  onLogin: () => void;
};

export default function GateModal({ heading, body, onClose, onRegister, onLogin }: Props) {
  return (
    <>
      {/* backdrop — click outside to dismiss */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(11,26,51,0.45)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-50 left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-7 flex flex-col gap-5"
        style={{ background: "#FFFFFF", border: "1px solid #E2DDD6", color: "#0B1A33" }}
      >
        {/* × close */}
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="absolute top-4 right-4 focus:outline-none focus-visible:ring-2 rounded"
          style={{ color: "#6B7280" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex flex-col gap-2 pr-4">
          <p className="text-lg font-semibold leading-snug" style={{ fontFamily: "var(--font-heading)", color: "#0B1A33" }}>
            {heading}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
            {body}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onRegister}
            className="w-full py-2.5 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "#8FB7FF", color: "#0B1A33", border: "1.5px solid #8FB7FF" }}
          >
            Register
          </button>
          <button
            onClick={onLogin}
            className="w-full py-2.5 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-colors"
            style={{ background: "#FFFFFF", color: "#0B1A33", border: "1.5px solid #0B1A33" }}
          >
            Sign In
          </button>
        </div>
      </div>
    </>
  );
}
