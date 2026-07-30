"use client";

import Image from "next/image";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import catalog, { CatalogItem } from "../../data/catalog";
import AccountDropdown from "../../components/AccountDropdown";
import { useOutfit } from "../../lib/outfit-context";
import OutfitFitPanel, { type OutfitFitState } from "../../components/OutfitFitPanel";
import { getStoredMeasurements } from "../../components/FitPanel";
import { createClient } from "../../lib/supabase";
import { CategoryRow } from "../../components/CategoryRows";
import { useSavedItems } from "../../lib/useSavedItems";

type GenderFilter = "all" | "men" | "women";

// ─── page ─────────────────────────────────────────────────────────────────────

export default function PickMatchPage() {
  const router = useRouter();
  const { outfit, toggleItem } = useOutfit();
  const supabase = createClient();

  const { savedRowIds, loadSavedItems, toggleSave } = useSavedItems();
  const [userId, setUserId] = useState<string | null>(null);

  const [gender, setGender] = useState<GenderFilter>("all");

  // ── true once the profile fetch has resolved and gender is correctly seeded ──
  const [profileReady, setProfileReady] = useState(false);

  // ── true if this page was reached via "Load outfit" on the Saved page —
  // changes where the Back button points (→ /saved instead of → /home). ──
  const [cameFromSaved, setCameFromSaved] = useState(false);

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

  // Seed the gender filter from the user's profile before anything renders,
  // so rows never show an unfiltered flash on load (same fix as /catalog).
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("gender")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.gender === "men" || profile?.gender === "women") {
        setGender(profile.gender);
      }

      await loadSavedItems(user.id);
      setProfileReady(true);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "Load outfit" (from Saved) sets a one-shot flag before navigating here so
  // the Back button can return to /saved instead of the default /home.
  useEffect(() => {
    function restoreFromSaved() {
      try {
        if (sessionStorage.getItem("fitcheck_from_saved") === "1") {
          setCameFromSaved(true);
          sessionStorage.removeItem("fitcheck_from_saved");
        }
      } catch {}
    }
    restoreFromSaved();
  }, []);

  // ── Gender-filtered catalog per-category ─────────────────────────────────
  const filteredByGender = useMemo(
    () => (gender === "all" ? catalog : catalog.filter((i) => i.gender === gender)),
    [gender],
  );

  const outerwearItems = useMemo(() => filteredByGender.filter((i) => i.category === "outerwear"), [filteredByGender]);
  const topItems       = useMemo(() => filteredByGender.filter((i) => i.category === "top"),       [filteredByGender]);
  const bottomItems    = useMemo(() => filteredByGender.filter((i) => i.category === "bottom"),    [filteredByGender]);
  const shoeItems      = useMemo(() => filteredByGender.filter((i) => i.category === "shoe"),      [filteredByGender]);

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

  // "Load outfit" (from Saved) sets a one-shot flag before navigating here so
  // the review panel opens immediately instead of requiring a manual click.
  const autoReviewRan = useRef(false);
  useEffect(() => {
    if (autoReviewRan.current || !hasSelection) return;
    let shouldAutoReview = false;
    try {
      shouldAutoReview = sessionStorage.getItem("fitcheck_auto_review") === "1";
    } catch {}
    if (!shouldAutoReview) return;
    autoReviewRan.current = true;
    try {
      sessionStorage.removeItem("fitcheck_auto_review");
    } catch {}
    reviewOutfit();
  }, [hasSelection, reviewOutfit]);

  return (
    <main className="app-refresh app-pick-match min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

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
          onClick={() => router.push(cameFromSaved ? "/saved" : "/home")}
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
          className="app-page-title text-sm font-semibold font-heading absolute left-1/2 -translate-x-1/2"
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
        {/* ── Left: category rows — only rendered after the profile fetch
              resolves so the gender filter is already correct on first paint
              (no unfiltered flash). ── */}
        <div className="flex flex-col gap-8 px-4 py-6 overflow-hidden">
          {!profileReady ? (
            <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading catalog">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-3 w-20 rounded" style={{ background: "var(--border)" }} />
                  <div className="flex gap-3">
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="flex-shrink-0 rounded-2xl"
                        style={{ width: 156, height: 220, background: "var(--border)" }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {outerwearItems.length > 0 && <CategoryRow label="Outerwear" items={outerwearItems} savedRowIds={savedRowIds} onToggleSave={(id) => userId && toggleSave(userId, id)} />}
              {topItems.length > 0 && <CategoryRow label="Tops" items={topItems} savedRowIds={savedRowIds} onToggleSave={(id) => userId && toggleSave(userId, id)} />}
              {bottomItems.length > 0 && <CategoryRow label="Bottoms" items={bottomItems} savedRowIds={savedRowIds} onToggleSave={(id) => userId && toggleSave(userId, id)} />}
              {shoeItems.length > 0 && <CategoryRow label="Shoes" items={shoeItems} savedRowIds={savedRowIds} onToggleSave={(id) => userId && toggleSave(userId, id)} />}
            </>
          )}
        </div>

        {/* ── Right: flat-lay outfit panel ── */}
        <OutfitFlatLay outfit={outfit} onRemove={toggleItem} />
      </div>

      {/* ── Action bar — shown once ≥1 item is selected ── */}
      {hasSelection && (outfitFit.status === "idle" || outfitFit.status === "loading") && (
        <div className="fixed bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-2 pointer-events-none transition-[transform,opacity] duration-250 ease-out starting:opacity-0 starting:translate-y-3 motion-reduce:transition-none">

          {/* Save status toast */}
          {saveStatus === "saved" && (
            <div
              className="pointer-events-none flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-[transform,opacity] duration-200 ease-out starting:opacity-0 starting:scale-90 motion-reduce:transition-none"
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
              className="pointer-events-none text-xs font-semibold px-3 py-1.5 rounded-full transition-[transform,opacity] duration-200 ease-out starting:opacity-0 starting:scale-90 motion-reduce:transition-none"
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
              className="flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:active:scale-100"
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
              className="flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:active:scale-100"
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

// ─── OutfitFlatLay ────────────────────────────────────────────────────────────
// Right-hand sticky panel showing the currently-selected outfit as a vertical
// flat-lay image stack, one slot per category in wear order.
// Empty state shows the original avatar-preview placeholder.

type FlatLayProps = {
  outfit: import("../../lib/outfit-context").OutfitState;
  onRemove: (item: CatalogItem) => void;
};

// Image height per category — outerwear tallest, shoes shortest.
const SLOT_HEIGHTS: Record<string, number> = {
  outerwear: 120,
  top:       110,
  bottom:    110,
  shoe:       80,
};

// Slot labels for accessibility / aria
const SLOT_LABELS: Record<string, string> = {
  outerwear: "Outerwear",
  top:       "Top",
  bottom:    "Bottom",
  shoe:      "Shoes",
};

function OutfitFlatLay({ outfit, onRemove }: FlatLayProps) {
  // Fixed display order — outerwear at top, shoes at bottom.
  const SLOTS = ["outerwear", "top", "bottom", "shoe"] as const;
  const filled = SLOTS.map((s) => outfit[s]).filter((i): i is CatalogItem => i !== null);

  const totalPrice = filled.reduce((sum, i) => {
    if (i.price == null) return sum;
    return sum + i.price;
  }, 0);

  // Work out which currency symbol to show (use first item that has one).
  const currencySymbol = (() => {
    for (const item of filled) {
      if (!item.currency) continue;
      return item.currency === "USD" ? "$" : item.currency + " ";
    }
    return "$";
  })();

  const hasPrices = filled.some((i) => i.price != null);

  return (
    <div
      className="sticky top-[57px] self-start mx-4 my-6 rounded-2xl max-sm:hidden"
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
        minHeight: "calc(100vh - 57px - 48px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Empty state ── */}
      {filled.length === 0 && (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-2"
          aria-label="No items selected yet"
        >
          <svg
            width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="12" cy="9" r="2.5" />
            <path d="M7 20c0-2.76 2.24-5 5-5s5 2.24 5 5" />
          </svg>
          <p className="text-xs text-center px-6" style={{ color: "var(--text-muted)" }}>
            Select items to build your outfit
          </p>
        </div>
      )}

      {/* ── Filled state — flat-lay stack ── */}
      {filled.length > 0 && (
        <div className="flex-1 flex flex-col justify-between">

          {/* Stack of item images */}
          <div className="flex flex-col gap-3 p-4">
            {SLOTS.map((slot) => {
              const item = outfit[slot];
              if (!item) return null;
              const h = SLOT_HEIGHTS[slot];
              return (
                <div key={slot} className="flex flex-col gap-1">
                  {/* Category label */}
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {SLOT_LABELS[slot]}
                  </p>

                  {/* Image + remove button */}
                  <div className="relative rounded-xl overflow-hidden" style={{ height: h, background: "var(--bg)", border: "1px solid var(--border)" }}>
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="(max-width: 1280px) 25vw, 300px"
                      className="object-contain"
                      unoptimized
                    />
                    {/* Deselect (×) button — top-right corner */}
                    <button
                      aria-label={`Remove ${item.name}`}
                      onClick={() => onRemove(item)}
                      className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full transition-[transform,opacity] duration-150 ease-out active:scale-90 focus:outline-none focus-visible:ring-2"
                      style={{
                        width: 22,
                        height: 22,
                        background: "rgba(255,255,255,0.88)",
                        backdropFilter: "blur(4px)",
                        border: "none",
                        cursor: "pointer",
                        zIndex: 1,
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {/* Item name */}
                  <p
                    className="text-[11px] font-medium leading-snug line-clamp-1"
                    style={{ color: "var(--text)" }}
                  >
                    {item.name}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Running total — pinned to bottom of panel */}
          {hasPrices && (
            <div
              className="mx-4 mb-4 mt-1 rounded-xl px-3 py-2.5 flex items-center justify-between"
              style={{ background: "var(--accent-soft)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Total
              </p>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                {currencySymbol}{totalPrice.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
