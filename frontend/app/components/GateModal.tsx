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
        className="fixed inset-0 z-50 transition-opacity duration-200 ease-out starting:opacity-0 motion-reduce:transition-none"
        style={{ background: "rgba(11,26,51,0.45)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-50 left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-7 flex flex-col gap-5 transition-[transform,opacity] duration-200 ease-out starting:opacity-0 starting:scale-95 motion-reduce:transition-none"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
      >
        {/* × close */}
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="absolute top-4 right-4 focus:outline-none focus-visible:ring-2 rounded transition-transform duration-150 ease-out active:scale-90"
          style={{ color: "var(--text-muted)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex flex-col gap-2 pr-4">
          <p className="text-lg font-semibold leading-snug" style={{ fontFamily: "var(--font-heading)", color: "var(--text)" }}>
            {heading}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {body}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onRegister}
            className="w-full py-2.5 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-transform duration-150 ease-out active:scale-[0.98]"
            style={{ background: "var(--accent)", color: "var(--accent-text)", border: "1.5px solid var(--accent)" }}
          >
            Register
          </button>
          <button
            onClick={onLogin}
            className="w-full py-2.5 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 transition-transform duration-150 ease-out active:scale-[0.98]"
            style={{ background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--text)" }}
          >
            Sign In
          </button>
        </div>
      </div>
    </>
  );
}
