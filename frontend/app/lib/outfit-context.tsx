"use client";

import { createContext, useContext, useState, useCallback } from "react";
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
    <OutfitContext.Provider value={{ outfit, toggleItem, clearOutfit, itemInOutfit }}>
      {children}
    </OutfitContext.Provider>
  );
}

export function useOutfit(): OutfitContextValue {
  const ctx = useContext(OutfitContext);
  if (!ctx) throw new Error("useOutfit must be used inside <OutfitProvider>");
  return ctx;
}
