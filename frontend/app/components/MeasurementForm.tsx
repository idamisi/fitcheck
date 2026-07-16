"use client";

import { useState } from "react";

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

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL"] as const;

type Screen = "choice" | "estimate" | "manual";

type Props = {
  onSubmit: (measurements: Measurements) => void;
};

export default function MeasurementForm({ onSubmit }: Props) {
  // ── shared modal state ────────────────────────────────────────────────────
  const [isOpen, setIsOpen]   = useState(false);
  const [screen, setScreen]   = useState<Screen>("choice");

  // ── manual modal state ────────────────────────────────────────────────────
  const [step, setStep]         = useState(0);
  const [values, setValues]     = useState<Measurements>(EMPTY);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // ── estimate form state ───────────────────────────────────────────────────
  const [estHeight,     setEstHeight]     = useState("");
  const [estWeight,     setEstWeight]     = useState("");
  const [estTopSize,    setEstTopSize]    = useState("M");
  const [estBottomSize, setEstBottomSize] = useState("M");
  const [estShoeSize,   setEstShoeSize]   = useState("");
  const [estComment,    setEstComment]    = useState("");
  const [estError,      setEstError]      = useState<string | null>(null);

  // ── helpers ───────────────────────────────────────────────────────────────
  function openManual(prefill: Measurements = EMPTY) {
    setValues(prefill);
    setStep(0);
    setFieldError(null);
    setShowTooltip(false);
    setScreen("manual");
  }

  function handleOpen() {
    setScreen("choice");
    setEstError(null);
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
  }

  // ── manual modal handlers ─────────────────────────────────────────────────
  const current  = FIELDS[step];
  const isLast   = step === FIELDS.length - 1;
  const rawValue = values[current.key];
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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="w-full max-w-md mx-auto block rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
      >
        Enter Your Measurements
      </button>

      {/* Modal backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="relative w-full max-w-sm mx-4 rounded-2xl bg-white shadow-xl p-8 flex flex-col gap-6">

            {/* ── CHOICE SCREEN ─────────────────────────────────────────── */}
            {screen === "choice" && (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Your measurements</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    How would you like to enter them?
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => openManual()}
                    className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors text-left"
                  >
                    I know my measurements
                    <span className="block text-xs font-normal text-zinc-400 mt-0.5">
                      Enter each value directly
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScreen("estimate")}
                    className="w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors text-left"
                  >
                    Estimate my measurements
                    <span className="block text-xs font-normal text-zinc-500 mt-0.5">
                      Tell us your size and we'll estimate
                    </span>
                  </button>
                </div>
              </>
            )}

            {/* ── ESTIMATE SCREEN ───────────────────────────────────────── */}
            {screen === "estimate" && (
              <>
                <div>
                  <button
                    type="button"
                    onClick={() => setScreen("choice")}
                    className="text-xs text-zinc-400 hover:text-zinc-600 mb-3 transition-colors"
                  >
                    ← Back
                  </button>
                  <h2 className="text-lg font-semibold text-zinc-900">Estimate my measurements</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Fill in what you know — we'll estimate the rest. You can review and edit before confirming.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Height */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-zinc-700">Height (cm)</label>
                    <input
                      type="number"
                      min={100}
                      max={230}
                      step="any"
                      value={estHeight}
                      onChange={(e) => { setEstHeight(e.target.value); setEstError(null); }}
                      placeholder="100–230"
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                  </div>

                  {/* Weight */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-zinc-700">Weight (kg)</label>
                    <input
                      type="number"
                      min={30}
                      max={250}
                      step="any"
                      value={estWeight}
                      onChange={(e) => { setEstWeight(e.target.value); setEstError(null); }}
                      placeholder="30–250"
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                  </div>

                  {/* Top size */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-zinc-700">Usual top size</label>
                    <select
                      value={estTopSize}
                      onChange={(e) => setEstTopSize(e.target.value)}
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
                    >
                      {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Bottom size */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-zinc-700">Usual bottom size</label>
                    <select
                      value={estBottomSize}
                      onChange={(e) => setEstBottomSize(e.target.value)}
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
                    >
                      {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Shoe size */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-zinc-700">Shoe size (US)</label>
                    <input
                      type="text"
                      value={estShoeSize}
                      onChange={(e) => { setEstShoeSize(e.target.value); setEstError(null); }}
                      placeholder="e.g. 10"
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                  </div>

                  {/* Fit comment */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-zinc-700">
                      Fit notes{" "}
                      <span className="text-zinc-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={estComment}
                      onChange={(e) => setEstComment(e.target.value)}
                      placeholder="e.g. tops fit loose on me, pants run long"
                      rows={2}
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
                    />
                  </div>
                </div>

                {estError && (
                  <p className="text-xs text-red-500" role="alert">{estError}</p>
                )}

                {/* TODO: wire to /api/estimate once watsonx.ai client and /api/fit are built */}
                <button
                  type="button"
                  disabled
                  className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white opacity-40 cursor-not-allowed"
                >
                  Estimate & Review — coming soon
                </button>
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
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTooltip((v) => !v)}
                    className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 transition-colors"
                  >
                    Why do we need this?
                  </button>
                  {showTooltip && (
                    <div className="absolute bottom-full mb-2 left-0 w-64 rounded-lg bg-zinc-800 text-white text-xs px-3 py-2 shadow-lg">
                      Real measurements mean real fit comparisons, not guesses.
                    </div>
                  )}
                </div>

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
