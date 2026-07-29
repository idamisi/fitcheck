"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { CatalogItem } from "../data/catalog";

// ─── types ────────────────────────────────────────────────────────────────────

/** One slot per wearable layer. null = nothing selected for that layer. */
export type OutfitSlot = "top" | "bottom" | "outerwear" | "shoe";

export type OutfitState = {
  top:       CatalogItem | null;
  bottom:    CatalogItem | null;
  outerwear: CatalogItem | null;
  shoe:      CatalogItem | null;
};

type OutfitContextValue = {
  outfit:      OutfitState;
  /** Toggle: if the item is already in its slot, remove it; otherwise set it. */
  toggleItem:  (item: CatalogItem) => void;
  /** Replace the whole outfit in one shot, slotting each item by its category. */
  setOutfitItems: (items: CatalogItem[]) => void;
  clearOutfit: () => void;
  itemInOutfit: (itemId: string) => boolean;
};

// ─── context ─────────────────────────────────────────────────────────────────

const OutfitContext = createContext<OutfitContextValue | null>(null);

const EMPTY: OutfitState = { top: null, bottom: null, outerwear: null, shoe: null };

export function OutfitProvider({ children }: { children: React.ReactNode }) {
  const [outfit, setOutfit] = useState<OutfitState>(EMPTY);

  const toggleItem = useCallback((item: CatalogItem) => {
    const slot = item.category as OutfitSlot;
    setOutfit((prev) => ({
      ...prev,
      [slot]: prev[slot]?.id === item.id ? null : item,
    }));
  }, []);

  const setOutfitItems = useCallback((items: CatalogItem[]) => {
    const next: OutfitState = { ...EMPTY };
    for (const item of items) {
      next[item.category as OutfitSlot] = item;
    }
    setOutfit(next);
  }, []);

  const clearOutfit = useCallback(() => setOutfit(EMPTY), []);

  const itemInOutfit = useCallback(
    (itemId: string) =>
      outfit.top?.id === itemId ||
      outfit.bottom?.id === itemId ||
      outfit.outerwear?.id === itemId ||
      outfit.shoe?.id === itemId,
    [outfit],
  );

  return (
    <OutfitContext.Provider value={{ outfit, toggleItem, setOutfitItems, clearOutfit, itemInOutfit }}>
      {children}
    </OutfitContext.Provider>
  );
}

export function useOutfit(): OutfitContextValue {
  const ctx = useContext(OutfitContext);
  if (!ctx) throw new Error("useOutfit must be used inside <OutfitProvider>");
  return ctx;
}

// ─── selection guard ──────────────────────────────────────────────────────────
// Clears the outfit selection whenever the user navigates away from /catalog
// or /pick-match, regardless of how they leave (Back button, logo, account
// dropdown, browser back/forward — anything that changes the route).
//
// This lives in the (auth) layout rather than as an unmount effect on each
// page: a per-page "clear in effect cleanup" is fragile because React Strict
// Mode's dev-only double-invoke fires that cleanup once right after the
// initial mount, wiping a selection that was just loaded (e.g. via "Load
// outfit") before the user ever left. Tracking pathname transitions in a
// component that persists across the whole authenticated session sidesteps
// that: its own first mount has no previous pathname to compare against, so
// there's nothing to spuriously clear.
const CLEARED_ON_EXIT_ROUTES = new Set(["/catalog", "/pick-match"]);

export function OutfitSelectionGuard() {
  const pathname = usePathname();
  const { clearOutfit } = useOutfit();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathname.current;
    if (prev !== null && prev !== pathname && CLEARED_ON_EXIT_ROUTES.has(prev)) {
      clearOutfit();
    }
    prevPathname.current = pathname;
  }, [pathname, clearOutfit]);

  return null;
}
