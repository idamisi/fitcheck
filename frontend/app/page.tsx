"use client";
import MeasurementForm, { Measurements } from "./components/MeasurementForm";

function handleMeasurements(measurements: Measurements) {
  console.log("Submitted measurements:", measurements);
}

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold tracking-tight">FitCheck</h1>
      <p className="mt-3 mb-8 text-zinc-500 text-lg">AI-powered visual outfit matching</p>
      <MeasurementForm onSubmit={handleMeasurements} />
    </main>
  );
}
