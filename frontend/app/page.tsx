"use client";

import { useState } from "react";
import Link from "next/link";
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
      <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#FAFAF8" }}>
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
            FitCheck
          </h1>
          <p className="text-lg tracking-wide" style={{ color: "#2B3A55" }}>
            Check it fits.
          </p>
          <button
            onClick={() => setScreen("measure")}
            className="mt-2 px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: "#FFFFFF", color: "#2B3A55", border: "1.5px solid #2B3A55", "--tw-ring-color": "#2B3A55" } as React.CSSProperties}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            Begin
          </button>
        </div>
      </main>
    );
  }

  // ── Screen 2: Measurement entry ────────────────────────────────────────────
  return (
    <main className="flex flex-col items-center min-h-screen p-8 relative" style={{ background: "#FAFAF8" }}>
      <button
        onClick={() => {
          if (measured) {
            // Avatar result → back to choice screen
            setMeasurements(EMPTY);
          } else {
            // Choice screen → back to landing
            setScreen("landing");
          }
        }}
        aria-label="Back"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded"
        style={{ color: "#2B3A55" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#2B3A55")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      {!measured ? (
        /* Choice screen — centred, takes all available vertical space */
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-sm gap-4">
          <p className="text-base font-medium" style={{ color: "#1A1A1A" }}>How would you like to enter your measurements?</p>
          <MeasurementForm onSubmit={setMeasurements} />
        </div>
      ) : (
        /* Result screen — avatar + button, tightly grouped, centred */
        <div className="flex flex-col items-center justify-center flex-1 gap-3 mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#2B3A55" }}>
            Your Avatar
          </h2>
          <Avatar measurements={measurements} />
          <Link
            href="/catalog"
            className="px-8 py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: "#FFFFFF", color: "#2B3A55", border: "1.5px solid #2B3A55" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#EEF1F6")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#FFFFFF")}
          >
            See What Fits
          </Link>
        </div>
      )}
    </main>
  );
}
