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
};

const FIELDS: FieldMeta[] = [
  { key: "height",        label: "Height (cm)",         min: 100, max: 230 },
  { key: "shoulderWidth", label: "Shoulder Width (cm)", min:  30, max:  70 },
  { key: "chest",         label: "Chest (cm)",          min:  50, max: 160 },
  { key: "waist",         label: "Waist (cm)",          min:  50, max: 160 },
  { key: "hip",           label: "Hip (cm)",            min:  50, max: 160 },
  { key: "inseam",        label: "Inseam (cm)",         min:  50, max: 110 },
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
  const [errors, setErrors] = useState<Partial<Record<keyof Measurements, string>>>({});

  function handleChange(key: keyof Measurements, raw: string) {
    setValues((prev) => ({ ...prev, [key]: parseFloat(raw) || 0 }));
    // Clear the error for this field as soon as the user edits it.
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nextErrors: Partial<Record<keyof Measurements, string>> = {};

    for (const { key, label, min, max } of FIELDS) {
      const v = values[key];
      if (v === 0) {
        nextErrors[key] = `${label.replace(/ \(cm\)/, "")} is required.`;
      } else if (v < min || v > max) {
        nextErrors[key] = `Must be between ${min} and ${max} cm.`;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    onSubmit(values);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto flex flex-col gap-4"
      noValidate
    >
      {FIELDS.map(({ key, label, min, max }) => (
        <div key={key} className="flex flex-col gap-1">
          <label htmlFor={key} className="text-sm font-medium text-zinc-700">
            {label}
          </label>
          <input
            id={key}
            type="number"
            min={min}
            max={max}
            step="any"
            value={values[key] === 0 ? "" : values[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={`${min}–${max}`}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
            className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              errors[key]
                ? "border-red-400 focus:ring-red-300"
                : "border-zinc-300 focus:ring-zinc-400"
            }`}
          />
          {errors[key] && (
            <p id={`${key}-error`} className="text-xs text-red-500" role="alert">
              {errors[key]}
            </p>
          )}
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
