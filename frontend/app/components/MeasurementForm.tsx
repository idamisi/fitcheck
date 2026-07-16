"use client";

import { useState, useRef, useEffect } from "react";

export type Measurements = {
  height: number;
  shoulderWidth: number;
  chest: number;
  waist: number;
  hip: number;
  inseam: number;
};

type FieldMeta = {
  key: keyof Measurements;
  label: string;
  min: number;
  max: number;
  intro: string;
};

const FIELDS: FieldMeta[] = [
  {
    key: "height",
    label: "Height (cm)",
    min: 100,
    max: 230,
    intro: "First things first — how tall are you? We promise this isn't a job application.",
  },
  {
    key: "shoulderWidth",
    label: "Shoulder Width (cm)",
    min: 30,
    max: 70,
    intro: "Shoulders! The unsung heroes of whether a jacket actually fits. Grab a tape measure and go shoulder-point to shoulder-point.",
  },
  {
    key: "chest",
    label: "Chest (cm)",
    min: 50,
    max: 160,
    intro: "Now around the chest — widest part, don't hold your breath in for this one.",
  },
  {
    key: "waist",
    label: "Waist (cm)",
    min: 50,
    max: 160,
    intro: "Waist next. Wherever your pants actually sit, not where you wish they sat.",
  },
  {
    key: "hip",
    label: "Hip (cm)",
    min: 50,
    max: 160,
    intro: "Hips — the widest point below the waist.",
  },
  {
    key: "inseam",
    label: "Inseam (cm)",
    min: 50,
    max: 110,
    intro: "Last one, we swear. Inseam: crotch to ankle. This is the one everyone gets wrong the first time, so take your time.",
  },
];

const EMPTY: Measurements = {
  height: 0,
  shoulderWidth: 0,
  chest: 0,
  waist: 0,
  hip: 0,
  inseam: 0,
};

// ─── Estimate step definitions ────────────────────────────────────────────────

type EstStepKey = "height" | "weight" | "usualTopSize" | "usualBottomSize" | "usualShoeSize" | "fitComment";

type EstStepMeta = {
  key: EstStepKey;
  label: string;
  intro: string;
  faq: string;
};

const EST_STEPS: EstStepMeta[] = [
  {
    key: "height",
    label: "Height (cm)",
    intro: "Height check! No tiptoes, we'll know.",
    faq: "Height helps us scale your estimate to roughly the right proportions before we fill in the rest.",
  },
  {
    key: "weight",
    label: "Weight (kg)",
    intro: "Now the number your bathroom scale already knows.",
    faq: "Weight helps us judge overall build alongside height, so the estimate isn't just guessing from height alone.",
  },
  {
    key: "usualTopSize",
    label: "Usual top size",
    intro: "Whatever's crammed in your t-shirt drawer — what size is it?",
    faq: "Your usual top size gives us a starting point for chest and shoulder width, since we don't have your exact measurements yet.",
  },
  {
    key: "usualBottomSize",
    label: "Usual bottom size",
    intro: "Trouser talk. What size do you usually grab?",
    faq: "Your usual bottom size helps estimate waist, hip, and inseam proportions.",
  },
  {
    key: "usualShoeSize",
    label: "Usual shoe size (US)",
    intro: "Feet don't lie — what's your usual shoe size?",
    faq: "This one's just for matching shoe recommendations to you later — it doesn't affect your body measurement estimate.",
  },
  {
    key: "fitComment",
    label: "Fit notes",
    intro: "Last one — spill the tea on how clothes usually fit you.",
    faq: "Details like 'tops run loose on me' or 'pants are always too long' help us adjust the estimate beyond just sizes and numbers.",
  },
];

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL"] as const;

type Screen = "choice" | "estimate" | "manual";

type Props = {
  onSubmit: (measurements: Measurements) => void;
};

// ─── EstFaqTooltip ────────────────────────────────────────────────────────────
// Closes on outside click without the toggle button immediately re-closing it:
// the document listener is added on the next event-loop tick (setTimeout 0) so
// the click that opened the tooltip has already finished propagating before the
// outside-click handler is active.

type EstFaqTooltipProps = {
  faq: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
};

function EstFaqTooltip({ faq, open, onToggle, onClose }: EstFaqTooltipProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    // Defer adding the listener so the click that triggered onToggle
    // has finished bubbling before we start listening.
    timeoutId = setTimeout(() => {
      document.addEventListener("click", handleOutsideClick);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [open, onClose]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 transition-colors"
      >
        Why do we need this?
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-64 rounded-lg bg-zinc-800 text-white text-xs px-3 py-2 shadow-lg">
          {faq}
        </div>
      )}
    </div>
  );
}

export default function MeasurementForm({ onSubmit }: Props) {
  // ── shared modal state ────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("choice");

  // ── manual modal state ────────────────────────────────────────────────────
  const [step, setStep]             = useState(0);
  const [values, setValues]         = useState<Measurements>(EMPTY);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // ── estimate step state ───────────────────────────────────────────────────
  const [estStep,       setEstStep]       = useState(0);
  const [estHeight,     setEstHeight]     = useState("");
  const [estWeight,     setEstWeight]     = useState("");
  const [estTopSize,    setEstTopSize]    = useState("M");
  const [estBottomSize, setEstBottomSize] = useState("M");
  const [estShoeSize,   setEstShoeSize]   = useState("");
  const [estComment,    setEstComment]    = useState("");
  const [estError,      setEstError]      = useState<string | null>(null);
  const [estShowFaq,    setEstShowFaq]    = useState(false);

  // ── helpers ───────────────────────────────────────────────────────────────
  function openManual(prefill: Measurements = EMPTY) {
    setValues(prefill);
    setStep(0);
    setFieldError(null);
    setShowTooltip(false);
    setScreen("manual");
  }

  function handleClose() {
    setIsOpen(false);
    setScreen("choice");
  }

  // ── estimate step navigation ──────────────────────────────────────────────
  const estCurrent = EST_STEPS[estStep];
  const estIsLast  = estStep === EST_STEPS.length - 1;

  function validateEstStep(): string | null {
    switch (estCurrent.key) {
      case "height": {
        const h = parseFloat(estHeight);
        if (!h) return "Height is required.";
        if (h < 100 || h > 230) return "Must be between 100 and 230 cm.";
        return null;
      }
      case "weight": {
        const w = parseFloat(estWeight);
        if (!w) return "Weight is required.";
        if (w < 30 || w > 250) return "Must be between 30 and 250 kg.";
        return null;
      }
      case "usualShoeSize":
        if (!estShoeSize.trim()) return "Shoe size is required.";
        return null;
      // dropdowns always have a value; fitComment is optional
      default:
        return null;
    }
  }

  function handleEstNext() {
    const err = validateEstStep();
    if (err) { setEstError(err); return; }
    setEstError(null);
    setEstShowFaq(false);
    setEstStep((s) => s + 1);
  }

  function handleEstBack() {
    setEstError(null);
    setEstShowFaq(false);
    if (estStep === 0) {
      setScreen("choice");
    } else {
      setEstStep((s) => s - 1);
    }
  }

  // ── manual modal handlers ─────────────────────────────────────────────────
  const current    = FIELDS[step];
  const isLast     = step === FIELDS.length - 1;
  const rawValue   = values[current.key];
  const inputValue = rawValue === 0 ? "" : String(rawValue);

  function validate(val: number): string | null {
    if (val === 0) return `${current.label.replace(/ \(cm\)/, "")} is required.`;
    if (val < current.min || val > current.max)
      return `Must be between ${current.min} and ${current.max} cm.`;
    return null;
  }

  function handleFieldChange(raw: string) {
    const num = parseFloat(raw) || 0;
    setValues((prev) => ({ ...prev, [current.key]: num }));
    setFieldError(null);
  }

  function handleNext() {
    const err = validate(values[current.key]);
    if (err) { setFieldError(err); return; }
    setFieldError(null);
    setStep((s) => s + 1);
  }

  function handleBack() {
    setFieldError(null);
    setStep((s) => s - 1);
  }

  function handleFinish() {
    const err = validate(values[current.key]);
    if (err) { setFieldError(err); return; }
    setIsOpen(false);
    setStep(0);
    onSubmit(values);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      isLast ? handleFinish() : handleNext();
    }
  }

  // ── render the correct input for each estimate step ───────────────────────
  function renderEstInput() {
    switch (estCurrent.key) {
      case "height":
        return (
          <input
            key="est-height"
            type="number"
            min={100}
            max={230}
            step="any"
            autoFocus
            value={estHeight}
            onChange={(e) => { setEstHeight(e.target.value); setEstError(null); }}
            placeholder="100–230"
            className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${estError ? "border-red-400 focus:ring-red-300" : "border-zinc-300 focus:ring-zinc-400"}`}
          />
        );
      case "weight":
        return (
          <input
            key="est-weight"
            type="number"
            min={30}
            max={250}
            step="any"
            autoFocus
            value={estWeight}
            onChange={(e) => { setEstWeight(e.target.value); setEstError(null); }}
            placeholder="30–250"
            className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${estError ? "border-red-400 focus:ring-red-300" : "border-zinc-300 focus:ring-zinc-400"}`}
          />
        );
      case "usualTopSize":
        return (
          <select
            key="est-top"
            autoFocus
            value={estTopSize}
            onChange={(e) => setEstTopSize(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          >
            {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        );
      case "usualBottomSize":
        return (
          <select
            key="est-bottom"
            autoFocus
            value={estBottomSize}
            onChange={(e) => setEstBottomSize(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          >
            {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        );
      case "usualShoeSize":
        return (
          <input
            key="est-shoe"
            type="text"
            autoFocus
            value={estShoeSize}
            onChange={(e) => { setEstShoeSize(e.target.value); setEstError(null); }}
            placeholder="e.g. 10"
            className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${estError ? "border-red-400 focus:ring-red-300" : "border-zinc-300 focus:ring-zinc-400"}`}
          />
        );
      case "fitComment":
        return (
          <textarea
            key="est-comment"
            autoFocus
            value={estComment}
            onChange={(e) => setEstComment(e.target.value)}
            placeholder="e.g. tops fit loose on me, pants run long"
            rows={3}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
          />
        );
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Choice buttons — rendered inline on Screen 2, not behind a modal ── */}
      {screen === "choice" && (
        <div className="flex flex-col gap-3 w-full">
          <button
            type="button"
            onClick={() => { setIsOpen(true); openManual(); }}
            className="w-full rounded-md px-4 py-3 text-sm font-semibold transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: "#FFFFFF", color: "#2B3A55", border: "1.5px solid #2B3A55" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            I know my measurements
            <span className="block text-xs font-normal mt-0.5" style={{ color: "#2B3A55", opacity: 0.7 }}>
              Enter each value directly
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setIsOpen(true); setEstStep(0); setEstError(null); setEstShowFaq(false); setScreen("estimate"); }}
            className="w-full rounded-md px-4 py-3 text-sm font-semibold transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: "#FFFFFF", color: "#2B3A55", border: "1.5px solid #2B3A55" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            Estimate my measurements
            <span className="block text-xs font-normal mt-0.5" style={{ color: "#2B3A55", opacity: 0.7 }}>
              Tell us your size and we'll estimate
            </span>
          </button>
        </div>
      )}

      {/* Modal backdrop — used for manual + estimate step flows */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="relative w-full max-w-sm mx-4 rounded-2xl bg-white shadow-xl p-8 flex flex-col gap-6">
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* ── CHOICE SCREEN (fallback — should not normally render) ─── */}
            {screen === "choice" && (
              <p className="text-sm text-zinc-500">Loading…</p>
            )}

            {/* ── ESTIMATE STEP FLOW ────────────────────────────────────── */}
            {screen === "estimate" && (
              <>
                {/* Progress dots */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">
                    Step {estStep + 1} of {EST_STEPS.length}
                  </span>
                  <div className="flex gap-1.5">
                    {EST_STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={`block h-2 w-2 rounded-full transition-colors ${
                          i < estStep
                            ? "bg-zinc-900"
                            : i === estStep
                            ? "bg-zinc-600"
                            : "bg-zinc-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Intro copy */}
                <p className="text-sm text-zinc-500 leading-relaxed">{estCurrent.intro}</p>

                {/* Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-zinc-700">
                    {estCurrent.label}
                    {estCurrent.key === "fitComment" && (
                      <span className="text-zinc-400 font-normal ml-1">(optional)</span>
                    )}
                  </label>
                  {renderEstInput()}
                  {estError && (
                    <p className="text-xs text-red-500" role="alert">{estError}</p>
                  )}
                </div>

                {/* Per-step FAQ tooltip */}
                <EstFaqTooltip
                  faq={estCurrent.faq}
                  open={estShowFaq}
                  onToggle={() => setEstShowFaq((v) => !v)}
                  onClose={() => setEstShowFaq(false)}
                />

                {/* Navigation */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleEstBack}
                    className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Back
                  </button>
                  {estIsLast ? (
                    /* TODO: wire to /api/estimate once /api/fit and watsonx.ai client are built */
                    <button
                      type="button"
                      disabled
                      className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white opacity-40 cursor-not-allowed"
                    >
                      Estimate & Review
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleEstNext}
                      className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
                    >
                      Next
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── MANUAL STEP MODAL ─────────────────────────────────────── */}
            {screen === "manual" && (
              <>
                {/* Progress dots */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">
                    Step {step + 1} of {FIELDS.length}
                  </span>
                  <div className="flex gap-1.5">
                    {FIELDS.map((_, i) => (
                      <span
                        key={i}
                        className={`block h-2 w-2 rounded-full transition-colors ${
                          i < step
                            ? "bg-zinc-900"
                            : i === step
                            ? "bg-zinc-600"
                            : "bg-zinc-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Intro copy */}
                <p className="text-sm text-zinc-500 leading-relaxed">{current.intro}</p>

                {/* Input */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="modal-input" className="text-sm font-medium text-zinc-700">
                    {current.label}
                  </label>
                  <input
                    id="modal-input"
                    key={current.key}
                    type="number"
                    min={current.min}
                    max={current.max}
                    step="any"
                    autoFocus
                    value={inputValue}
                    onChange={(e) => handleFieldChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`${current.min}–${current.max}`}
                    className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      fieldError
                        ? "border-red-400 focus:ring-red-300"
                        : "border-zinc-300 focus:ring-zinc-400"
                    }`}
                  />
                  {fieldError && (
                    <p className="text-xs text-red-500" role="alert">{fieldError}</p>
                  )}
                </div>

                {/* Why tooltip */}
                <EstFaqTooltip
                  faq="Real measurements mean real fit comparisons, not guesses."
                  open={showTooltip}
                  onToggle={() => setShowTooltip((v) => !v)}
                  onClose={() => setShowTooltip(false)}
                />

                {/* Navigation buttons */}
                <div className="flex gap-3">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      Back
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setScreen("choice")}
                      className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={isLast ? handleFinish : handleNext}
                    className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
                  >
                    {isLast ? "Finish" : "Next"}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
