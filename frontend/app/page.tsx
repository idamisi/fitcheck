"use client";

import { useState } from "react";
import MeasurementForm, { Measurements } from "./components/MeasurementForm";
import Avatar from "./components/Avatar";

const EMPTY: Measurements = {
  height: 0,
  shoulderWidth: 0,
  chest: 0,
  waist: 0,
  hip: 0,
  inseam: 0,
};

type Screen = "landing" | "measure";

const hasMeasurements = (m: Measurements) => Object.values(m).some((v) => v > 0);

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [measurements, setMeasurements] = useState<Measurements>(EMPTY);
  const measured = hasMeasurements(measurements);

  // ── Screen 1: Landing ──────────────────────────────────────────────────────
  if (screen === "landing") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-zinc-900">
            FitCheck
          </h1>
          <p className="text-lg text-zinc-500 tracking-wide">
            Check it fits.
          </p>
          <button
            onClick={() => setScreen("measure")}
            className="mt-2 px-8 py-2.5 text-sm font-semibold text-zinc-900 bg-white border border-zinc-900 rounded hover:bg-zinc-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            Begin
          </button>
        </div>
      </main>
    );
  }

  // ── Screen 2: Measurement entry ────────────────────────────────────────────
  return (
    <main className="flex flex-col items-center min-h-screen p-8 gap-10 relative">
      <button
        onClick={() => setScreen("landing")}
        aria-label="Back to landing"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div className="flex flex-col items-center gap-2 mt-8">
        <p className="text-zinc-500 text-base">How would you like to enter your measurements?</p>
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-12 w-full max-w-3xl">
        <div className="flex-1 w-full">
          <MeasurementForm onSubmit={setMeasurements} />
        </div>

        {measured && (
          <div className="flex flex-col items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              Silhouette Preview
            </h2>
            <Avatar measurements={measurements} />
          </div>
        )}
      </div>
    </main>
  );
}
