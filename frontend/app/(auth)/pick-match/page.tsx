"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import catalog, { CatalogItem } from "../../data/catalog";
import AccountDropdown from "../../components/AccountDropdown";
import { useOutfit } from "../../lib/outfit-context";
import OutfitFitPanel, { type OutfitFitState } from "../../components/OutfitFitPanel";
import { getStoredMeasurements } from "../../components/FitPanel";
import { createClient } from "../../lib/supabase";

// ─── data slices ──────────────────────────────────────────────────────────────

const outerwearItems = catalog.filter((i) => i.category === "outerwear");
const topItems       = catalog.filter((i) => i.category === "top");
const bottomItems    = catalog.filter((i) => i.category === "bottom");
const shoeItems      = catalog.filter((i) => i.category === "shoe");

// ─── PickCard ─────────────────────────────────────────────────────────────────
// Tappable card: highlights with an accent-blue border when selected.

function PickCard({ item, selected, onSelect }: {
  item: CatalogItem;
  selected: boolean;
  onSelect: () => void;
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
        borderColor: selected ? "var(--accent)" : "var(--border)",
        borderWidth: selected ? 2 : 1,
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
// One horizontally scrollable row. Tap a card to select it for this category;
// tapping the current selection toggles it off.

function CategoryRow({ label, items }: { label: string; items: CatalogItem[] }) {
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
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function PickMatchPage() {
  const router = useRouter();
  const { outfit, toggleItem } = useOutfit();
  const supabase = createClient();

  const [outfitFit, setOutfitFit] = useState<OutfitFitState>({ status: "idle" });

  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collect selected items in display order (outerwear → top → bottom → shoe),
  // skipping null slots.
  const selectedItems: CatalogItem[] = [
    outfit.outerwear,
    outfit.top,
    outfit.bottom,
    outfit.shoe,
  ].filter((i): i is CatalogItem => i !== null);

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
      if (!user) {
        setSaveStatus("error");
        return;
      }
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
  // selectedItems identity changes each render; compare by item ids instead
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfit.outerwear?.id, outfit.top?.id, outfit.bottom?.id, outfit.shoe?.id]);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* Account dropdown — fixed top-right */}
      <div className="fixed top-0 right-0 z-30 px-5 py-3" style={{ pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}><AccountDropdown /></div>
      </div>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => router.push("/home")}
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
          Pick &amp; Match
        </h1>
        <div style={{ width: 40 }} />
      </header>

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
          <CategoryRow label="Outerwear" items={outerwearItems} />
          <CategoryRow label="Tops"      items={topItems} />
          <CategoryRow label="Bottoms"   items={bottomItems} />
          {shoeItems.length > 0 && (
            <CategoryRow label="Shoes" items={shoeItems} />
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
              Couldn't save — try again
            </div>
          )}

          {/* Button pair */}
          <div className="pointer-events-auto flex items-center gap-3">
            {/* Save fit */}
            <button
              onClick={saveOutfit}
              disabled={saveStatus === "saving"}
              className="flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  Save fit
                </>
              )}
            </button>

            {/* Review my fit */}
            <button
              onClick={reviewOutfit}
              disabled={outfitFit.status === "loading"}
              className="flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
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
                "Review my fit"
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
