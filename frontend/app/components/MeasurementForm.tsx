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

const FIELDS: { key: keyof Measurements; label: string }[] = [
  { key: "height", label: "Height (cm)" },
  { key: "shoulderWidth", label: "Shoulder Width (cm)" },
  { key: "chest", label: "Chest (cm)" },
  { key: "waist", label: "Waist (cm)" },
  { key: "hip", label: "Hip (cm)" },
  { key: "inseam", label: "Inseam (cm)" },
];

const EMPTY: Measurements = {
  height: 0,
  shoulderWidth: 0,
  chest: 0,
  waist: 0,
  hip: 0,
  inseam: 0,
};

type Props = {
  onSubmit: (measurements: Measurements) => void;
};

export default function MeasurementForm({ onSubmit }: Props) {
  const [values, setValues] = useState<Measurements>(EMPTY);

  function handleChange(key: keyof Measurements, raw: string) {
    setValues((prev) => ({ ...prev, [key]: parseFloat(raw) || 0 }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto flex flex-col gap-4"
    >
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1">
          <label htmlFor={key} className="text-sm font-medium text-zinc-700">
            {label}
          </label>
          <input
            id={key}
            type="number"
            min={0}
            step="any"
            value={values[key] === 0 ? "" : values[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder="0"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>
      ))}
      <button
        type="submit"
        className="mt-2 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
      >
        Submit Measurements
      </button>
    </form>
  );
}
