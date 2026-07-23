"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import catalog, { CatalogItem } from "../../data/catalog";

type SavedRow = { id: string; catalog_item_id: string };

export default function SavedPage() {
  const router = useRouter();
  const supabase = createClient();

  const [rows, setRows] = useState<SavedRow[]>([]);
  const [ready, setReady] = useState(false);

  // ── Auth gate + load saved_items ─────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data } = await supabase
        .from("saved_items")
        .select("id, catalog_item_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setRows(data ?? []);
      setReady(true);
    }
    init();
  }, [router, supabase]);

  async function handleUnsave(rowId: string) {
    // Optimistic remove
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    await supabase.from("saved_items").delete().eq("id", rowId);
  }

  if (!ready) return null;

  // Join saved rows against the in-memory catalog
  const savedItems = rows
    .map((r) => ({ rowId: r.id, item: catalog.find((c) => c.id === r.catalog_item_id) }))
    .filter((r): r is { rowId: string; item: CatalogItem } => r.item != null);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "#FAFAF8" }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "#FAFAF8", borderColor: "#E5E7EB" }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded"
          style={{ color: "#2B3A55" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#2B3A55")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Saved</span>
        <div style={{ width: 40 }} /> {/* balance */}
      </header>

      <div className="flex-1 px-4 py-6 flex flex-col gap-8">

        {/* ── Saved Items ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#2B3A55" }}>
            Saved Items
          </p>

          {savedItems.length === 0 ? (
            <p className="text-sm" style={{ color: "#9CA3AF" }}>
              No saved items yet — heart something from the catalog.
            </p>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
            >
              {savedItems.map(({ rowId, item }) => (
                <SavedItemCard
                  key={rowId}
                  item={item}
                  onUnsave={() => handleUnsave(rowId)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Saved Outfits — honest empty state ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#2B3A55" }}>
            Saved Outfits
          </p>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>
            No saved outfits yet — outfit building is coming soon.
          </p>
        </section>

      </div>
    </main>
  );
}

// ─── SavedItemCard ─────────────────────────────────────────────────────────────

function SavedItemCard({
  item,
  onUnsave,
}: {
  item: CatalogItem;
  onUnsave: () => void;
}) {
  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden border"
      style={{ borderColor: "#E5E7EB", background: "#fff" }}
    >
      <div className="relative w-full" style={{ paddingBottom: "120%", background: "#F3F4F6" }}>
        <Image
          src={item.imageUrl}
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
        <button
          onClick={onUnsave}
          className="mt-auto pt-2 flex items-center gap-1 text-xs transition-colors focus:outline-none"
          style={{ color: "#9CA3AF" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#B91C1C")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
          aria-label={`Unsave ${item.name}`}
        >
          {/* filled heart */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Unsave
        </button>
      </div>
    </div>
  );
}
