"use client";

/**
 * FitzyOutfitBrowser
 * ──────────────────
 * Shared component used by both /pick-match and /catalog (Fitzy search results).
 *
 * Props:
 *   fitzyMatchIds  – When provided, each card in this set gets a "Match" badge
 *                    and a slightly bolder accent border. Items are NOT reordered;
 *                    the full catalog's natural order is preserved.
 *   headerText     – Optional reasoning text shown above the category rows
 *                    (Fitzy's reply, e.g. "I've put together some polished…").
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import catalog, { CatalogItem } from "../data/catalog";
import { useOutfit, type OutfitItem } from "../lib/outfit-context";
import OutfitFitPanel, { type OutfitFitState } from "./OutfitFitPanel";
import { getStoredMeasurements } from "./FitPanel";
import { createClient } from "../lib/supabase";
import AutofitButton from "./AnchorBuildPrompt";

// ─── data slices (full catalog, natural order) ────────────────────────────────

const outerwearItems = catalog.filter((i) => i.category === "outerwear");
const topItems       = catalog.filter((i) => i.category === "top");
const bottomItems    = catalog.filter((i) => i.category === "bottom");
const shoeItems      = catalog.filter((i) => i.category === "shoe");

// ─── PickCard ─────────────────────────────────────────────────────────────────
// Tappable card that highlights with an accent-blue border when selected.
// When `isFitzyMatch` is true a "Match" badge is shown in the top-left corner.

function PickCard({
  item,
  selected,
  onSelect,
  isFitzyMatch,
}: {
  item: CatalogItem;
  selected: boolean;
  onSelect: () => void;
  isFitzyMatch?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      className="flex flex-col rounded-2xl overflow-hidden border cursor-pointer transition-shadow focus:outline-none focus-visible:ring-2"
      style={{
        borderColor: selected ? "var(--accent)" : isFitzyMatch ? "var(--accent)" : "var(--border)",
        borderWidth: selected || isFitzyMatch ? 2 : 1,
        background: "var(--surface)",
        boxShadow: selected ? "0 0 0 2px var(--accent)" : undefined,
      }}
    >
      <div className="relative w-full" style={{ paddingBottom: "120%", background: "var(--bg)" }}>
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, 160px"
          className="object-cover"
          unoptimized
        />
        {/* Match badge — top-left, only when this item is in Fitzy's selection */}
        {isFitzyMatch && (
          <span
            className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
            style={{
              background: "var(--accent)",
              color: "var(--accent-text)",
              lineHeight: 1.4,
            }}
            aria-label="Fitzy match"
          >
            Match
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="text-xs font-medium leading-snug" style={{ color: "var(--text)" }}>
          {item.name}
        </p>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
            {item.color}
          </p>
          {item.price != null && item.currency && (
            <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
              {item.currency === "USD" ? "$" : item.currency}{item.price.toFixed(2)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {item.styleTags.map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CategoryRow ──────────────────────────────────────────────────────────────
// One horizontally scrollable row for a single clothing category.
// Items stay in catalog order; matched items are badged but not reordered.

function CategoryRow({
  label,
  items,
  matchIds,
}: {
  label: string;
  items: CatalogItem[];
  matchIds: Set<string>;
}) {
  const { toggleItem, itemInOutfit } = useOutfit();

  return (
    <div>
      <h2
        className="text-xs font-semibold uppercase tracking-wider px-4 mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </h2>
      <div
        className="ai-picks-carousel flex gap-3 overflow-x-auto -mx-4 px-4"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          paddingRight: "2rem",
        } as React.CSSProperties}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0"
            style={{ width: 156, scrollSnapAlign: "start" }}
          >
            <PickCard
              item={item}
              selected={itemInOutfit(item.id)}
              onSelect={() => toggleItem(item)}
              isFitzyMatch={matchIds.size > 0 ? matchIds.has(item.id) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FitzyOutfitBrowser ───────────────────────────────────────────────────────

export default function FitzyOutfitBrowser({
  fitzyMatchIds,
  headerText,
  pageTitle = "Pick & Match",
  backPath = "/home",
}: {
  /** Item IDs from Fitzy's search results. If non-empty, cards get Match badges. */
  fitzyMatchIds?: string[];
  /** Fitzy's reasoning text, shown above the category rows. */
  headerText?: string;
  /** Page heading shown in the sticky header. */
  pageTitle?: string;
  /** Path to navigate to when Back is pressed. */
  backPath?: string;
}) {
  const router = useRouter();
  const { outfit, toggleItem } = useOutfit();
  const supabase = createClient();

  const matchIds = new Set(fitzyMatchIds ?? []);

  const [outfitFit, setOutfitFit] = useState<OutfitFitState>({ status: "idle" });

  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collect selected items in display order (outerwear → top → bottom → shoe),
  // skipping null slots.
  const selectedItems: OutfitItem[] = [
    outfit.outerwear,
    outfit.top,
    outfit.bottom,
    outfit.shoe,
  ].filter((i): i is OutfitItem => i !== null);

  const hasSelection = selectedItems.length > 0;

  // Auto-clear the save toast after 3 s.
  useEffect(() => {
    if (saveStatus === "saved" || saveStatus === "error") {
      saveToastTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
    return () => {
      if (saveToastTimer.current) clearTimeout(saveToastTimer.current);
    };
  }, [saveStatus]);

  const saveOutfit = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaveStatus("error"); return; }
      const { error } = await supabase
        .from("saved_outfits")
        .insert({
          user_id: user.id,
          catalog_item_ids: selectedItems.map((i) => i.id),
        });
      if (error) {
        console.error("[save-fit] saved_outfits insert failed:", error);
        setSaveStatus("error");
      } else {
        setSaveStatus("saved");
      }
    } catch (e) {
      console.error("[save-fit] unexpected error:", e);
      setSaveStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfit.outerwear?.id, outfit.top?.id, outfit.bottom?.id, outfit.shoe?.id]);

  const reviewOutfit = useCallback(async () => {
    const storedMeasurements = getStoredMeasurements();
    if (!storedMeasurements) {
      setOutfitFit({ status: "error", message: "No measurements found. Please enter your measurements first." });
      return;
    }

    setOutfitFit({ status: "loading" });

    try {
      const res = await fetch("/api/outfit-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMeasurements: storedMeasurements,
          items: selectedItems.map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            color: i.color,
            styleTags: i.styleTags,
            sizes: i.sizes,
            isAnchor: i.isAnchor,
          })),
          catalog: catalog.map((c) => ({
            id: c.id,
            name: c.name,
            category: c.category,
            color: c.color,
            styleTags: c.styleTags,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setOutfitFit({ status: "error", message: err.error ?? "Request failed." });
        return;
      }

      const data = await res.json();
      setOutfitFit({ status: "done", data });
    } catch {
      setOutfitFit({ status: "error", message: "Network error — please try again." });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfit.outerwear?.id, outfit.top?.id, outfit.bottom?.id, outfit.shoe?.id]);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => router.push(backPath)}
          className="flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded-lg"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h1
          className="text-sm font-semibold font-heading absolute left-1/2 -translate-x-1/2"
          style={{ color: "var(--text)" }}
        >
          {pageTitle}
        </h1>
        <div style={{ width: 40 }} />
      </header>

      {/* ── Fitzy reasoning header (shown when fitzyMatchIds are present) ── */}
      {headerText && (
        <div
          className="px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {headerText}
          </p>
          {matchIds.size > 0 && (
            <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--accent)" }}>
              {matchIds.size} item{matchIds.size !== 1 ? "s" : ""} highlighted by Fitzy
            </p>
          )}
        </div>
      )}

      {/* ── Two-column body ── */}
      <div
        className="flex-1 grid"
        style={{
          gridTemplateColumns: "minmax(0, 65fr) minmax(0, 35fr)",
          alignItems: "start",
          gap: 0,
        }}
      >
        {/* ── Left: category rows ── */}
        <div className="flex flex-col gap-8 px-4 py-6 overflow-hidden">
          <CategoryRow label="Outerwear" items={outerwearItems} matchIds={matchIds} />
          <CategoryRow label="Tops"      items={topItems}       matchIds={matchIds} />
          <CategoryRow label="Bottoms"   items={bottomItems}    matchIds={matchIds} />
          {shoeItems.length > 0 && (
            <CategoryRow label="Shoes"   items={shoeItems}      matchIds={matchIds} />
          )}
        </div>

        {/* ── Right: avatar placeholder ── */}
        <div
          className="sticky top-[57px] self-start mx-4 my-6 rounded-2xl flex flex-col items-center justify-center gap-2 max-sm:hidden"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            minHeight: "calc(100vh - 57px - 48px)",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="12" cy="9" r="2.5" />
            <path d="M7 20c0-2.76 2.24-5 5-5s5 2.24 5 5" />
          </svg>
          <p className="text-xs text-center px-6" style={{ color: "var(--text-muted)" }}>
            Avatar preview
          </p>
          <p className="text-[10px] text-center px-6" style={{ color: "var(--border)" }}>
            coming soon
          </p>
        </div>
      </div>

      {/* ── Action bar — shown once ≥1 item is selected ── */}
      {hasSelection && (outfitFit.status === "idle" || outfitFit.status === "loading") && (
        <div className="fixed bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-2 pointer-events-none">

          {/* Save status toast */}
          {saveStatus === "saved" && (
            <div
              className="pointer-events-none flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
              role="status"
              aria-live="polite"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </div>
          )}
          {saveStatus === "error" && (
            <div
              className="pointer-events-none text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "var(--surface)", color: "var(--danger)", border: "1px solid var(--border)" }}
              role="alert"
              aria-live="assertive"
            >
              Couldn&apos;t save — try again
            </div>
          )}

          {/* Button pair */}
          <div className="pointer-events-auto flex items-center gap-3">
            <AutofitButton />
            {/* Save fit */}
            <button
              onClick={saveOutfit}
              disabled={saveStatus === "saving"}
              className="order-3 flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
              style={{
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                opacity: saveStatus === "saving" ? 0.65 : 1,
              }}
            >
              {saveStatus === "saving" ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                  Save fit
                </>
              )}
            </button>

            {/* Review my fit */}
            <button
              onClick={reviewOutfit}
              disabled={outfitFit.status === "loading"}
              className="order-2 flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
              style={{
                background: "var(--accent)",
                color: "var(--accent-text)",
                border: "1px solid var(--accent)",
                opacity: outfitFit.status === "loading" ? 0.75 : 1,
              }}
            >
              {outfitFit.status === "loading" ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Reviewing…
                </>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h6" /><path d="M9 3h6v4H9z" /><path d="M5 5h1a2 2 0 0 1 2 2v1h8V7a2 2 0 0 1 2-2h1v16H5z" /><path d="m9 15 2 2 4-4" /></svg>Review my fit</>
              )}
            </button>
          </div>

        </div>
      )}

      {/* ── Outfit fit panel (bottom sheet) ── */}
      <OutfitFitPanel
        outfitState={outfitFit}
        selectedItems={selectedItems}
        onClose={() => setOutfitFit({ status: "idle" })}
        onSwap={(item) => { toggleItem(item); setOutfitFit({ status: "idle" }); }}
      />

    </main>
  );
}
