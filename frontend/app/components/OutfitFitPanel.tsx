"use client";

import Image from "next/image";
import catalog, { type CatalogItem } from "../data/catalog";
import type { OutfitFitOutput } from "../api/outfit-fit/route";

// ─── types ────────────────────────────────────────────────────────────────────

export type { OutfitFitOutput };

export type OutfitFitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: OutfitFitOutput }
  | { status: "error"; message: string };

// ─── OutfitFitPanel ───────────────────────────────────────────────────────────
// Bottom-sheet panel showing a single cohesive outfit review.
// Visual language matches FitPanel: accent "Outfit Review" heading, plain prose body.

export default function OutfitFitPanel({
  outfitState,
  selectedItems,
  onClose,
  onSwap,
}: {
  outfitState: OutfitFitState;
  selectedItems: CatalogItem[];
  onClose: () => void;
  onSwap: (item: CatalogItem) => void;
}) {
  if (outfitState.status === "idle") return null;

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-30"
        style={{ background: "rgba(11,26,51,0.45)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl flex flex-col max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        <div className="px-5 pb-8 flex flex-col gap-5">

          {/* ── Selected item thumbnails ── */}
          {selectedItems.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-1">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col items-center gap-1"
                  style={{ width: 56 }}
                >
                  <div
                    className="relative rounded-xl overflow-hidden border flex-shrink-0"
                    style={{ width: 56, height: 68, borderColor: "var(--border)" }}
                  >
                    {item.imageUrl && (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <p
                    className="text-[9px] text-center leading-tight line-clamp-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.name}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Error state ── */}
          {outfitState.status === "error" && (
            <div className="py-6 text-center">
              <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
                {outfitState.message}
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 text-sm rounded-lg border"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              >
                Close
              </button>
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {outfitState.status === "loading" && (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Reviewing outfit">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--accent)" }}
              >
                Outfit Review
              </p>
              <div className="flex flex-col gap-1.5">
                {[92, 80, 70, 55].map((w, i) => (
                  <div
                    key={i}
                    className="h-3 rounded"
                    style={{ width: `${w}%`, background: "var(--border)" }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {outfitState.status === "done" && (() => {
            const swap = outfitState.data.suggestedSwap;
            const swapItem = swap ? catalog.find((c) => c.id === swap.itemId) : null;
            return (
              <>
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: "var(--accent)" }}
                  >
                    Outfit Review
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                    {outfitState.data.review}
                  </p>
                </div>

                {/* ── Suggested swap card ── */}
                {swapItem && (
                  <div>
                    <p
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: "var(--accent)" }}
                    >
                      Suggested swap
                    </p>
                    <button
                      onClick={() => { onSwap(swapItem); onClose(); }}
                      className="flex items-start gap-3 w-full rounded-xl border p-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2"
                      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      aria-label={`Swap in ${swapItem.name}`}
                    >
                      {/* Thumbnail */}
                      <div
                        className="relative flex-shrink-0 rounded-lg overflow-hidden"
                        style={{ width: 56, height: 68, background: "var(--surface)", border: "1px solid var(--border)" }}
                      >
                        {swapItem.imageUrl && (
                          <Image
                            src={swapItem.imageUrl}
                            alt={swapItem.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                            unoptimized
                          />
                        )}
                      </div>
                      {/* Text */}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-xs font-semibold leading-snug" style={{ color: "var(--text)" }}>
                          {swapItem.name}
                        </p>
                        <p className="text-[11px] capitalize" style={{ color: "var(--text-muted)" }}>
                          {swapItem.color}
                          {swapItem.price != null && swapItem.currency && (
                            <span className="ml-2 font-semibold" style={{ color: "var(--text)" }}>
                              {swapItem.currency === "USD" ? "$" : swapItem.currency}{swapItem.price.toFixed(2)}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] leading-snug mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {swap!.reason}
                        </p>
                        <p
                          className="text-[10px] font-semibold mt-1"
                          style={{ color: "var(--accent)" }}
                        >
                          Tap to swap in →
                        </p>
                      </div>
                    </button>
                  </div>
                )}
              </>
            );
          })()}

          {/* Close button — shown whenever we're not in pure error (which has its own) */}
          {outfitState.status !== "error" && (
            <button
              onClick={onClose}
              className="mt-1 w-full py-2.5 text-sm font-semibold rounded-lg border transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--bg)" }}
            >
              Close
            </button>
          )}

        </div>
      </div>
    </>
  );
}
