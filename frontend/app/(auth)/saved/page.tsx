"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import catalog, { CatalogItem } from "../../data/catalog";
import AccountDropdown from "../../components/AccountDropdown";
import { useOutfit } from "../../lib/outfit-context";

type SavedItemRow    = { id: string; catalog_item_id: string };
type SavedOutfitRow  = { id: string; catalog_item_ids: string[]; created_at: string };

export default function SavedPage() {
  const router = useRouter();
  const supabase = createClient();

  const [itemRows,   setItemRows]   = useState<SavedItemRow[]>([]);
  const [outfitRows, setOutfitRows] = useState<SavedOutfitRow[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const [itemsRes, outfitsRes] = await Promise.all([
        supabase
          .from("saved_items")
          .select("id, catalog_item_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("saved_outfits")
          .select("id, catalog_item_ids, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (outfitsRes.error) {
        console.error("[saved-page] saved_outfits fetch failed:", outfitsRes.error);
      }

      setItemRows(itemsRes.data ?? []);
      setOutfitRows(outfitsRes.data ?? []);
      setReady(true);
    }
    init();
  }, [router, supabase]);

  async function handleUnsaveItem(rowId: string) {
    setItemRows((prev) => prev.filter((r) => r.id !== rowId));
    await supabase.from("saved_items").delete().eq("id", rowId);
  }

  async function handleUnsaveOutfit(rowId: string) {
    setOutfitRows((prev) => prev.filter((r) => r.id !== rowId));
    await supabase.from("saved_outfits").delete().eq("id", rowId);
  }

  if (!ready) return null;

  const savedItems = itemRows
    .map((r) => ({ rowId: r.id, item: catalog.find((c) => c.id === r.catalog_item_id) }))
    .filter((r): r is { rowId: string; item: CatalogItem } => r.item != null);

  // Resolve each outfit row's ids to full CatalogItem objects (silently drop unknown ids).
  const savedOutfits = outfitRows.map((row) => ({
    rowId: row.id,
    createdAt: row.created_at,
    items: row.catalog_item_ids
      .map((id) => catalog.find((c) => c.id === id))
      .filter((i): i is CatalogItem => i != null),
  }));

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* Account dropdown — fixed top-right */}
      <div className="fixed top-0 right-0 z-30 px-5 py-3" style={{ pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}><AccountDropdown /></div>
      </div>

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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <span className="text-sm font-semibold font-heading" style={{ color: "var(--text)" }}>Saved</span>
        <div style={{ width: 40 }} />
      </header>

      <div className="flex-1 px-4 py-6 flex flex-col gap-8">

        {/* ── Saved Outfits ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Saved Outfits
          </p>
          {savedOutfits.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No saved outfits yet — select items on Pick &amp; Match and tap Save fit.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {savedOutfits.map(({ rowId, items }) => (
                <SavedOutfitCard
                  key={rowId}
                  items={items}
                  onUnsave={() => handleUnsaveOutfit(rowId)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Saved Items ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Saved Items
          </p>
          {savedItems.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No saved items yet — heart something from the catalog.
            </p>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {savedItems.map(({ rowId, item }) => (
                <SavedItemCard key={rowId} item={item} onUnsave={() => handleUnsaveItem(rowId)} />
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

// ─── SavedOutfitCard ──────────────────────────────────────────────────────────
// Shows all items in a saved outfit as a horizontal strip of thumbnails,
// with a single "Remove" button for the whole outfit.

function SavedOutfitCard({ items, onUnsave }: { items: CatalogItem[]; onUnsave: () => void }) {
  const router = useRouter();
  const { setOutfitItems } = useOutfit();

  function handleLoadOutfit() {
    setOutfitItems(items);
    try {
      sessionStorage.setItem("fitcheck_auto_review", "1");
      sessionStorage.setItem("fitcheck_from_saved", "1");
    } catch {}
    router.push("/pick-match");
  }

  return (
    <div
      className="rounded-2xl border p-3 flex flex-col gap-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Item thumbnails — only categories actually present in this outfit are rendered */}
      <div className="flex gap-2 flex-wrap">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/item/${item.id}`}
            className="flex flex-col gap-1"
            style={{ width: 72 }}
          >
            <div
              className="relative rounded-xl overflow-hidden transition-colors"
              style={{ width: 72, height: 88, background: "var(--bg)", border: "1px solid var(--border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <Image
                src={item.imageUrl} alt={item.name} fill
                sizes="72px" className="object-cover" unoptimized
              />
            </div>
            <p
              className="text-[10px] leading-tight text-center truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {item.name}
            </p>
          </Link>
        ))}
      </div>

      {/* Category tags */}
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item.id}
            className="text-[10px] px-1.5 py-0.5 rounded-full capitalize"
            style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            {item.category}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleLoadOutfit}
          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 w-fit"
          style={{ background: "#8FB7FF", color: "#1A4A8F", border: "1px solid #8FB7FF", borderRadius: 8 }}
          aria-label="Load outfit into Pick & Match and review fit"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3.5-7.1" /><polyline points="21 3 21 9 15 9" />
          </svg>
          Load outfit
        </button>

        <button
          onClick={onUnsave}
          className="flex items-center gap-1 text-xs transition-colors focus:outline-none w-fit"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          aria-label="Remove saved outfit"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Remove outfit
        </button>
      </div>
    </div>
  );
}

// ─── SavedItemCard ────────────────────────────────────────────────────────────

function SavedItemCard({ item, onUnsave }: { item: CatalogItem; onUnsave: () => void }) {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="relative w-full" style={{ paddingBottom: "120%", background: "var(--bg)" }}>
        <Image
          src={item.imageUrl} alt={item.name} fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-cover" unoptimized
        />
      </div>
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <p className="text-xs font-medium leading-snug" style={{ color: "var(--text)" }}>{item.name}</p>
        <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{item.color}</p>
        <button
          onClick={onUnsave}
          className="mt-auto pt-2 flex items-center gap-1 text-xs transition-colors focus:outline-none"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          aria-label={`Unsave ${item.name}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Unsave
        </button>
      </div>
    </div>
  );
}
