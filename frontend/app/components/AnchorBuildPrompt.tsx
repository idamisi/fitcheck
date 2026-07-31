"use client";

import { useState } from "react";
import { useOutfit, type OutfitSlot } from "../lib/outfit-context";
import type { CatalogItem } from "../data/catalog";

type BuildState = "idle" | "loading" | "error";
const SLOTS: OutfitSlot[] = ["top", "bottom", "outerwear", "shoe"];

export default function AutofitButton() {
  const { outfit, fillEmptySlots } = useOutfit();
  const [state, setState] = useState<BuildState>("idle");

  const anchor = SLOTS.map((slot) => outfit[slot]).find((item) => item?.isAnchor) ?? null;
  const emptySlots = SLOTS.filter((slot) => !outfit[slot]);
  const canAutofit = !!anchor && emptySlots.length > 0;

  async function handleAutoBuild() {
    if (!anchor || !canAutofit) return;
    setState("loading");
    try {
      const response = await fetch("/api/outfit/auto-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anchor: {
            category: anchor.category,
            color: anchor.color,
            styleTags: anchor.styleTags,
            description: anchor.description,
          },
          emptySlots,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not build an outfit.");

      // Context checks the current state again, so manual picks made while the
      // request was in flight are never overwritten.
      fillEmptySlots(data.items as CatalogItem[]);
    } catch (error) {
      console.error("[anchor-build] failed:", error);
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleAutoBuild}
      disabled={!canAutofit || state === "loading"}
      title={!canAutofit ? "Choose an anchor item with an empty slot to use Autofit" : state === "error" ? "Couldn’t build a fit — try again" : undefined}
      className="order-1 flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:active:scale-100"
      style={{
        background: "var(--surface)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        opacity: canAutofit && state !== "loading" ? 1 : 0.45,
      }}
    >
      {state === "loading" ? (
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 3-1.9 5.8L4.5 10.7l5.6 1.9L12 18.5l1.9-5.9 5.6-1.9-5.6-1.9z" />
          <path d="m19 3-.5 1.5L17 5l1.5.5L19 7l.5-1.5L21 5l-1.5-.5z" />
        </svg>
      )}
      {state === "loading" ? "Building…" : "Autofit"}
    </button>
  );
}
