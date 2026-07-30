"use client";

import { useState, useCallback } from "react";
import { createClient } from "./supabase";

// ─── useSavedItems ────────────────────────────────────────────────────────────
// Manages the saved_items table for the current user.
//
// Usage:
//   const { savedRowIds, loadSavedItems, toggleSave } = useSavedItems();
//
//   // On mount, after you have the user:
//   await loadSavedItems(user.id);
//
//   // To check whether an item is saved:
//   const rowId = savedRowIds.get(catalogItemId);  // undefined → not saved
//
//   // To toggle (save if unsaved, unsave if saved):
//   await toggleSave(user.id, catalogItemId);

export type SavedRowMap = Map<string, string>; // catalog_item_id → saved_items row id

export function useSavedItems() {
  // Map from catalog_item_id → saved_items.id (row id used for deletion)
  const [savedRowIds, setSavedRowIds] = useState<SavedRowMap>(new Map());
  const supabase = createClient();

  const loadSavedItems = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("saved_items")
        .select("id, catalog_item_id")
        .eq("user_id", userId);

      if (!data) return;
      const map: SavedRowMap = new Map();
      for (const row of data) {
        map.set(row.catalog_item_id, row.id);
      }
      setSavedRowIds(map);
    },
    [supabase],
  );

  const toggleSave = useCallback(
    async (userId: string, catalogItemId: string) => {
      const existingRowId = savedRowIds.get(catalogItemId);

      if (existingRowId) {
        // Optimistic removal
        setSavedRowIds((prev) => {
          const next = new Map(prev);
          next.delete(catalogItemId);
          return next;
        });
        await supabase.from("saved_items").delete().eq("id", existingRowId);
      } else {
        // Optimistic insert — we don't have the real row id yet, so use a
        // temporary placeholder; the real id replaces it once the insert resolves.
        const tempId = `temp-${catalogItemId}`;
        setSavedRowIds((prev) => new Map(prev).set(catalogItemId, tempId));

        const { data, error } = await supabase
          .from("saved_items")
          .insert({ user_id: userId, catalog_item_id: catalogItemId })
          .select("id")
          .single();

        if (error) {
          // Roll back the optimistic update
          setSavedRowIds((prev) => {
            const next = new Map(prev);
            next.delete(catalogItemId);
            return next;
          });
        } else if (data) {
          // Replace placeholder with the real row id
          setSavedRowIds((prev) => new Map(prev).set(catalogItemId, data.id));
        }
      }
    },
    [savedRowIds, supabase],
  );

  return { savedRowIds, loadSavedItems, toggleSave };
}
