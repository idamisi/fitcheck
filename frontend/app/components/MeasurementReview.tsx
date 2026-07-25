"use client";

import { Measurements } from "./MeasurementForm";

// ─── field definitions ────────────────────────────────────────────────────────

export const REVIEW_FIELDS: {
  key: keyof Measurements;
  label: string;
  display: (val: number) => string;
}[] = [
  { key: "height",        label: "Height",        display: (v) => v > 0 ? `${v} cm` : "—" },
  { key: "shoulderWidth", label: "Shoulder Width", display: (v) => v > 0 ? `${v} cm` : "—" },
  { key: "chest",         label: "Chest",          display: (v) => v > 0 ? `${v} cm` : "—" },
  { key: "waist",         label: "Waist",          display: (v) => v > 0 ? `${v} cm` : "—" },
  { key: "hip",           label: "Hip",            display: (v) => v > 0 ? `${v} cm` : "—" },
  { key: "inseam",        label: "Inseam",         display: (v) => v > 0 ? `${v} cm` : "—" },
];

// ─── component ────────────────────────────────────────────────────────────────

type Props = {
  values: Measurements;
  onEdit: (fieldIndex: number) => void;
  onConfirm: () => void;
};

export default function MeasurementReview({ values, onEdit, onConfirm }: Props) {
  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex flex-col items-start gap-1">
        <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Review your measurements</p>
        <p className="text-xs" style={{ color: "#9CA3AF" }}>
          Tap any row to change a value, then confirm to save.
        </p>
      </div>

      {/* Values list */}
      <div className="flex flex-col divide-y rounded-lg border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
        {REVIEW_FIELDS.map(({ key, label, display }, idx) => (
          <div
            key={key}
            className="flex items-center justify-between px-4 py-3"
            style={{ background: "#fff" }}
          >
            <span className="text-sm" style={{ color: "#374151" }}>{label}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums" style={{ color: "#1A1A1A" }}>
                {display(values[key])}
              </span>
              <button
                type="button"
                onClick={() => onEdit(idx)}
                className="text-xs underline underline-offset-2 focus:outline-none transition-colors"
                style={{ color: "#9CA3AF" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#2B3A55")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm */}
      <button
        type="button"
        onClick={onConfirm}
        className="w-full py-2.5 text-sm font-semibold rounded transition-colors focus:outline-none focus-visible:ring-2"
        style={{ background: "#2B3A55", color: "#fff", border: "1.5px solid #2B3A55" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#1e2d45")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#2B3A55")}
      >
        Confirm &amp; Save
      </button>
    </div>
  );
}
