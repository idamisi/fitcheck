"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import catalog, { CatalogItem } from "../data/catalog";
import type { FitOutput } from "../api/fit/route";

// ─── helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES = ["all", "top", "bottom", "outerwear"] as const;
const GENDERS = ["all", "men", "women"] as const;
const STYLES = ["all", "casual", "classic", "smart-casual", "streetwear", "sporty", "formal"] as const;

type CategoryFilter = (typeof CATEGORIES)[number];
type GenderFilter = (typeof GENDERS)[number];
type StyleFilter = (typeof STYLES)[number];

const LABEL: Record<string, string> = {
  all: "All",
  top: "Tops",
  bottom: "Bottoms",
  outerwear: "Outerwear",
  men: "Men",
  women: "Women",
  casual: "Casual",
  classic: "Classic",
  "smart-casual": "Smart-Casual",
  streetwear: "Streetwear",
  sporty: "Sporty",
  formal: "Formal",
};

// ─── measurements passed via search params (set by the avatar screen) ────────
// We read from sessionStorage so the catalog page stays independent of routing.
function getStoredMeasurements() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("fitcheck_measurements");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── component ───────────────────────────────────────────────────────────────

const BTN_BASE =
  "px-3 py-1 text-xs font-medium rounded-full border transition-colors focus:outline-none focus-visible:ring-2";

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={BTN_BASE}
      style={
        active
          ? { background: "#2B3A55", color: "#fff", borderColor: "#2B3A55" }
          : { background: "#fff", color: "#2B3A55", borderColor: "#2B3A55" }
      }
    >
      {label}
    </button>
  );
}

type FitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: FitOutput; item: CatalogItem }
  | { status: "error"; message: string };

export default function CatalogPage() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [style, setStyle] = useState<StyleFilter>("all");
  const [fit, setFit] = useState<FitState>({ status: "idle" });

  // ── filtered items ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return catalog.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (gender !== "all" && item.gender !== gender) return false;
      if (style !== "all" && !item.styleTags.includes(style)) return false;
      return true;
    });
  }, [category, gender, style]);

  // ── fit-check call ──────────────────────────────────────────────────────────
  async function checkFit(item: CatalogItem) {
    const measurements = getStoredMeasurements();
    if (!measurements) {
      setFit({
        status: "error",
        message: "No measurements found. Please go back and enter your measurements first.",
      });
      return;
    }

    setFit({ status: "loading" });

    const activeFilters: Record<string, string> = {};
    if (category !== "all") activeFilters.category = category;
    if (style !== "all") activeFilters.style = style;

    try {
      const res = await fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMeasurements: measurements,
          selectedItemId: item.id,
          catalog,
          activeFilters: Object.keys(activeFilters).length ? activeFilters : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setFit({ status: "error", message: err.error ?? "Request failed." });
        return;
      }

      const data: FitOutput = await res.json();
      setFit({ status: "done", data, item });
    } catch {
      setFit({ status: "error", message: "Network error — please try again." });
    }
  }

  // ── recommendation items (resolved from catalog) ───────────────────────────
  const recoItems =
    fit.status === "done"
      ? fit.data.recommendations
          .map((r) => ({
            ...r,
            catalogItem: catalog.find((c) => c.id === r.id),
          }))
          .filter((r) => r.catalogItem != null)
      : [];

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col" style={{ background: "#FAFAF8" }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "#FAFAF8", borderColor: "#E5E7EB" }}
      >
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded"
          style={{ color: "#2B3A55" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#1A1A1A")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#2B3A55")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </Link>
        <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>
          Catalog <span style={{ color: "#9CA3AF" }}>({filtered.length})</span>
        </span>
      </header>

      {/* ── Filters ── */}
      <div
        className="sticky top-[49px] z-10 px-6 py-3 border-b flex flex-col gap-2"
        style={{ background: "#FAFAF8", borderColor: "#E5E7EB" }}
      >
        {/* Category row */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <FilterPill key={c} label={LABEL[c]} active={category === c} onClick={() => setCategory(c)} />
          ))}
        </div>
        {/* Gender + Style rows */}
        <div className="flex flex-wrap gap-1.5">
          {GENDERS.map((g) => (
            <FilterPill key={g} label={LABEL[g]} active={gender === g} onClick={() => setGender(g)} />
          ))}
          <span className="self-center text-xs" style={{ color: "#D1D5DB" }}>|</span>
          {STYLES.map((s) => (
            <FilterPill key={s} label={LABEL[s]} active={style === s} onClick={() => setStyle(s)} />
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 px-4 py-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-center mt-12" style={{ color: "#9CA3AF" }}>
            No items match the selected filters.
          </p>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} onFitCheck={checkFit} />
            ))}
          </div>
        )}
      </div>

      {/* ── Fit-check overlay ── */}
      {fit.status !== "idle" && (
        <FitPanel
          fit={fit}
          recoItems={recoItems}
          onClose={() => setFit({ status: "idle" })}
        />
      )}
    </main>
  );
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onFitCheck,
}: {
  item: CatalogItem;
  onFitCheck: (item: CatalogItem) => void;
}) {
  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden border"
      style={{ borderColor: "#E5E7EB", background: "#fff" }}
    >
      <div className="relative w-full" style={{ paddingBottom: "120%", background: "#F3F4F6" }}>
        <Image
          src={item.imageUrl!}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <p className="text-xs font-medium leading-snug" style={{ color: "#1A1A1A" }}>
          {item.name}
        </p>
        <p className="text-xs capitalize" style={{ color: "#9CA3AF" }}>
          {item.color}
        </p>
        <div className="flex flex-wrap gap-1 mt-auto pt-1">
          {item.styleTags.map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "#EEF1F6", color: "#2B3A55" }}
            >
              {t}
            </span>
          ))}
        </div>
        <button
          onClick={() => onFitCheck(item)}
          className="mt-2 w-full py-1.5 text-xs font-semibold rounded border transition-colors focus:outline-none focus-visible:ring-2"
          style={{ background: "#FFFFFF", color: "#2B3A55", borderColor: "#2B3A55" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
        >
          Check Fit
        </button>
      </div>
    </div>
  );
}

// ─── FitPanel ─────────────────────────────────────────────────────────────────

type RecoItemWithCatalog = {
  id: string;
  name: string;
  reason: string;
  catalogItem: CatalogItem | undefined;
};

function FitPanel({
  fit,
  recoItems,
  onClose,
}: {
  fit: FitState;
  recoItems: RecoItemWithCatalog[];
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl flex flex-col max-h-[85vh] overflow-y-auto"
        style={{ background: "#FAFAF8", boxShadow: "0 -4px 24px rgba(0,0,0,0.12)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "#D1D5DB" }} />
        </div>

        <div className="px-5 pb-8 flex flex-col gap-5">
          {fit.status === "loading" && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Spinner />
              <p className="text-sm" style={{ color: "#2B3A55" }}>Analysing fit…</p>
            </div>
          )}

          {fit.status === "error" && (
            <div className="py-8 text-center">
              <p className="text-sm font-medium" style={{ color: "#B91C1C" }}>{fit.message}</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 text-sm rounded border"
                style={{ borderColor: "#2B3A55", color: "#2B3A55" }}
              >
                Close
              </button>
            </div>
          )}

          {fit.status === "done" && (
            <>
              {/* Selected item header */}
              <div className="flex items-center gap-3 pt-1">
                <div
                  className="relative flex-shrink-0 rounded overflow-hidden border"
                  style={{ width: 56, height: 68, borderColor: "#E5E7EB" }}
                >
                  {fit.item.imageUrl && (
                    <Image
                      src={fit.item.imageUrl}
                      alt={fit.item.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>{fit.item.name}</p>
                  <p className="text-xs capitalize" style={{ color: "#9CA3AF" }}>{fit.item.color}</p>
                </div>
              </div>

              {/* Fit description */}
              {fit.data.fitDescription && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#2B3A55" }}>
                    Fit Details
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>
                    {fit.data.fitDescription}
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {recoItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "#2B3A55" }}>
                    Pairs Well With
                  </p>
                  <div className="flex flex-col gap-3">
                    {recoItems.map((r) => (
                      <div
                        key={r.id}
                        className="flex gap-3 p-3 rounded-lg border"
                        style={{ borderColor: "#E5E7EB", background: "#fff" }}
                      >
                        {r.catalogItem?.imageUrl && (
                          <div
                            className="relative flex-shrink-0 rounded overflow-hidden border"
                            style={{ width: 52, height: 64, borderColor: "#E5E7EB" }}
                          >
                            <Image
                              src={r.catalogItem.imageUrl}
                              alt={r.name}
                              fill
                              sizes="52px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>{r.name}</p>
                          {r.catalogItem && (
                            <p className="text-xs capitalize" style={{ color: "#9CA3AF" }}>{r.catalogItem.color}</p>
                          )}
                          <p className="text-xs leading-snug mt-0.5" style={{ color: "#374151" }}>{r.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="mt-1 w-full py-2.5 text-sm font-semibold rounded border transition-colors"
                style={{ borderColor: "#2B3A55", color: "#2B3A55", background: "#fff" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF1F6")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2B3A55"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
