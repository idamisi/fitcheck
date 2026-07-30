"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import catalog, { CatalogItem } from "../data/catalog";
import type { FitOutput } from "../api/fit/route";

// ─── types (re-exported so consumers can share them) ─────────────────────────

export type { FitOutput };

export type FitState =
  | { status: "idle" }
  | { status: "loading"; item: CatalogItem }
  | { status: "done"; data: FitOutput; item: CatalogItem }
  | { status: "error"; message: string };

// ─── helpers ─────────────────────────────────────────────────────────────────

export function getStoredMeasurements() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("fitcheck_measurements");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

type RecoItemWithCatalog = {
  id: string;
  name: string;
  reason: string;
  catalogItem: CatalogItem | undefined;
};

// ─── FitPanel ─────────────────────────────────────────────────────────────────
// A bottom-sheet panel showing fit details + pairing recommendations for one
// item at a time. Consumers own the FitState and pass it in; the panel handles
// its own drill-down navigation stack internally.

export default function FitPanel({
  fit,
  recoItems,
  onClose,
  onCheckFit,
}: {
  fit: FitState;
  recoItems: RecoItemWithCatalog[];
  onClose: () => void;
  onCheckFit: (item: CatalogItem) => void;
}) {
  const rootItem = fit.status !== "idle" && fit.status !== "error" ? fit.item : null;
  const rootItemId = rootItem?.id ?? null;

  type DrillEntry = {
    item: CatalogItem;
    fitStatus: "loading" | "done" | "error";
    data?: FitOutput;
    error?: string;
    recos: RecoItemWithCatalog[];
  };

  const [stack, setStack] = useState<DrillEntry[]>([]);

  useEffect(() => {
    setStack([]);
  }, [rootItemId]);

  const drillCache = useRef<Map<string, FitOutput>>(new Map());

  function getStackIds(): string[] {
    const ids: string[] = [];
    if (rootItem) ids.push(rootItem.id);
    for (const entry of stack) ids.push(entry.item.id);
    return ids;
  }

  async function drillInto(item: CatalogItem) {
    const excludeIds = getStackIds();
    setStack((prev) => [...prev, { item, fitStatus: "loading", recos: [] }]);

    const cached = drillCache.current.get(item.id);
    if (cached) {
      const recos = cached.recommendations
        .map((r) => ({ ...r, catalogItem: catalog.find((c) => c.id === r.id) }))
        .filter((r) => r.catalogItem != null && !excludeIds.includes(r.id));
      setStack((prev) => {
        const next = [...prev];
        next[next.length - 1] = { item, fitStatus: "done", data: cached, recos };
        return next;
      });
      return;
    }

    const storedM = getStoredMeasurements();

    try {
      const res = await fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMeasurements: storedM ?? { height: 0, shoulderWidth: 0, chest: 0, waist: 0, hip: 0, inseam: 0 },
          selectedItemId: item.id,
          catalog,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setStack((prev) => {
          const next = [...prev];
          next[next.length - 1] = { item, fitStatus: "error", error: err.error ?? "Request failed.", recos: [] };
          return next;
        });
        return;
      }

      const data: FitOutput = await res.json();
      drillCache.current.set(item.id, data);
      const recos = data.recommendations
        .map((r) => ({ ...r, catalogItem: catalog.find((c) => c.id === r.id) }))
        .filter((r) => r.catalogItem != null && !excludeIds.includes(r.id));
      setStack((prev) => {
        const next = [...prev];
        next[next.length - 1] = { item, fitStatus: "done", data, recos };
        return next;
      });
    } catch {
      setStack((prev) => {
        const next = [...prev];
        next[next.length - 1] = { item, fitStatus: "error", error: "Network error — try again.", recos: [] };
        return next;
      });
    }
  }

  const currentDrill = stack.length > 0 ? stack[stack.length - 1] : null;

  // Carousel drag-scroll
  const carouselRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0 });

  function carouselMouseDown(e: React.MouseEvent) {
    const el = carouselRef.current; if (!el) return;
    dragState.current = { dragging: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = "grabbing";
  }
  function carouselMouseMove(e: React.MouseEvent) {
    if (!dragState.current.dragging) return;
    const el = carouselRef.current; if (!el) return;
    e.preventDefault();
    el.scrollLeft = dragState.current.scrollLeft - (e.pageX - el.offsetLeft - dragState.current.startX);
  }
  function carouselMouseUp() {
    dragState.current.dragging = false;
    if (carouselRef.current) carouselRef.current.style.cursor = "grab";
  }

  // ── render helpers ────────────────────────────────────────────────────────

  function renderItemHeader(item: CatalogItem) {
    return (
      <div className="flex items-start gap-3 pt-1">
        <div
          className="relative flex-shrink-0 rounded-xl overflow-hidden border"
          style={{ width: 56, height: 68, borderColor: "var(--border)" }}
        >
          {item.imageUrl && (
            <Image src={item.imageUrl} alt={item.name} fill sizes="56px" className="object-cover" unoptimized />
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{item.name}</p>
          <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{item.color}</p>
          {item.price != null && item.currency && (
            <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--text)" }}>
              {item.currency === "USD" ? "$" : item.currency}{item.price.toFixed(2)}
              {item.originalPrice != null && item.originalPrice > item.price && (
                <span className="ml-1.5 line-through font-normal" style={{ color: "var(--text-muted)" }}>
                  ${item.originalPrice.toFixed(2)}
                </span>
              )}
            </p>
          )}
          {item.sizes && (
            <p className="text-[10px] leading-snug mt-0.5" style={{ color: "var(--text-muted)" }}>
              Sizes: {item.sizes}
            </p>
          )}
          {item.productUrl && (
            <a
              href={item.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md w-fit"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              onClick={(e) => e.stopPropagation()}
            >
              Shop {item.brand ? `at ${item.brand}` : "now"}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    );
  }

  function renderAiSkeleton() {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading fit details">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--accent)" }}>
            Fit Details
          </p>
          <div className="flex flex-col gap-1.5">
            {[80, 95, 70].map((w, i) => (
              <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: "var(--border)" }} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--accent)" }}>
            Pairs Well With
          </p>
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-shrink-0 rounded-xl" style={{ width: 120, height: 160, background: "var(--border)" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderRecoCarousel(recos: RecoItemWithCatalog[], onDrill: (item: CatalogItem) => void) {
    if (recos.length === 0) return null;
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--accent)" }}>
          Pairs Well With
        </p>
        <div
          ref={carouselRef}
          className="flex gap-3 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "none", cursor: "grab", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          onMouseDown={carouselMouseDown}
          onMouseMove={carouselMouseMove}
          onMouseUp={carouselMouseUp}
          onMouseLeave={carouselMouseUp}
        >
          {recos.map((r) => {
            if (!r.catalogItem) return null;
            const ci = r.catalogItem;
            return (
              <button
                key={r.id}
                onClick={() => onDrill(ci)}
                className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden border focus:outline-none focus-visible:ring-2"
                style={{ width: 120, background: "var(--bg)", borderColor: "var(--border)", textAlign: "left" }}
                aria-label={`View fit details for ${ci.name}`}
              >
                <div className="relative w-full flex-shrink-0" style={{ height: 140 }}>
                  <Image src={ci.imageUrl} alt={ci.name} fill sizes="120px" className="object-cover" unoptimized />
                </div>
                <div className="p-2 flex flex-col gap-0.5">
                  <p className="text-[10px] font-semibold leading-snug" style={{ color: "var(--text)" }}>{ci.name}</p>
                  <p className="text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>{ci.color}</p>
                  <p
                    className="text-[10px] leading-snug mt-0.5"
                    style={{
                      color: "var(--text-muted)",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      overflow: "hidden",
                    } as React.CSSProperties}
                  >
                    {r.reason}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── main render ───────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="fixed inset-0 z-30"
        style={{ background: "rgba(11,26,51,0.45)" }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl flex flex-col max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        {stack.length > 0 && (
          <div className="px-5 pt-1 flex-shrink-0">
            <button
              onClick={() => setStack((prev) => prev.slice(0, -1))}
              className="flex items-center gap-1 text-xs focus:outline-none focus-visible:ring-2 rounded"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back
            </button>
          </div>
        )}

        <div className="px-5 pb-8 flex flex-col gap-5">

          {/* Error (no item) */}
          {fit.status === "error" && stack.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>{fit.message}</p>
              <button onClick={onClose} className="mt-4 px-6 py-2 text-sm rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Close</button>
            </div>
          )}

          {/* Root item — loading or done */}
          {(fit.status === "loading" || fit.status === "done") && stack.length === 0 && (
            <>
              {renderItemHeader(fit.item)}
              {fit.status === "loading" && renderAiSkeleton()}
              {fit.status === "done" && (
                <>
                  {fit.data.recommendedSize && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Recommended Size</p>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                      >
                        {fit.data.recommendedSize}
                      </span>
                    </div>
                  )}
                  {fit.data.fitDescription && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--accent)" }}>Fit Details</p>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{fit.data.fitDescription}</p>
                    </div>
                  )}
                  {renderRecoCarousel(recoItems, drillInto)}
                </>
              )}
              <button onClick={onClose} className="mt-1 w-full py-2.5 text-sm font-semibold rounded-lg border transition-colors" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--bg)" }}>Close</button>
            </>
          )}

          {/* Drilled item */}
          {currentDrill && (
            <>
              {renderItemHeader(currentDrill.item)}
              {currentDrill.fitStatus === "loading" && renderAiSkeleton()}
              {currentDrill.fitStatus === "error" && (
                <p className="text-sm" style={{ color: "var(--danger)" }}>{currentDrill.error}</p>
              )}
              {currentDrill.fitStatus === "done" && currentDrill.data && (
                <>
                  {currentDrill.data.recommendedSize && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Recommended Size</p>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                      >
                        {currentDrill.data.recommendedSize}
                      </span>
                    </div>
                  )}
                  {currentDrill.data.fitDescription && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--accent)" }}>Fit Details</p>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{currentDrill.data.fitDescription}</p>
                    </div>
                  )}
                  {renderRecoCarousel(currentDrill.recos, drillInto)}
                </>
              )}
              <button onClick={onClose} className="mt-1 w-full py-2.5 text-sm font-semibold rounded-lg border transition-colors" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--bg)" }}>Close</button>
            </>
          )}

        </div>
      </div>
    </>
  );
}
