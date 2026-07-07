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

export default function Home() {
  const [measurements, setMeasurements] = useState<Measurements>(EMPTY);

  return (
    <main className="flex flex-col items-center min-h-screen p-8 gap-10">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-bold tracking-tight">FitCheck</h1>
        <p className="text-zinc-500 text-lg">AI-powered visual outfit matching</p>
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-12 w-full max-w-3xl">
        <div className="flex-1 w-full">
          <MeasurementForm onSubmit={setMeasurements} />
        </div>

        <div className="flex flex-col items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
            Silhouette Preview
          </h2>
          <Avatar measurements={measurements} />
        </div>
      </div>
    </main>
  );
}
