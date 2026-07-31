"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountDropdown from "../../components/AccountDropdown";
import { createClient } from "../../lib/supabase";
import { useOutfit, type OutfitItem } from "../../lib/outfit-context";
import type { CatalogItem } from "../../data/catalog";

type WardrobeCategory = "top" | "bottom" | "outerwear" | "shoe";

type WardrobeRow = {
  id: string;
  image_url: string;
  category: WardrobeCategory;
  color: string;
  style_tags: string[];
  description: string | null;
  location: string;
};

type WardrobeItem = WardrobeRow & {
  storagePath: string | null;
  signedUrl: string | null;
};

type SuggestionModalState = {
  wardrobeItem: WardrobeItem;
  items: CatalogItem[];
  loading: boolean;
};

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function formatPrice(item: CatalogItem) {
  if (item.price == null || !item.currency) return null;
  const symbol = item.currency === "USD" ? "$" : item.currency === "GBP" ? "£" : item.currency;
  return `${symbol}${item.price.toFixed(2)}`;
}

function storagePathFromUrl(imageUrl: string): string | null {
  const marker = "/wardrobe-photos/";
  const markerIndex = imageUrl.indexOf(marker);
  if (markerIndex === -1) {
    // Newer records may store the private bucket path directly instead of a
    // public URL. Supporting both avoids coupling display to bucket privacy.
    return imageUrl.startsWith("http") ? null : imageUrl;
  }

  return decodeURIComponent(imageUrl.slice(markerIndex + marker.length).split("?")[0]);
}

// Wardrobe items occupy the same category slots as catalog items. The extra
// catalog fields are intentionally blank because this is a user-owned item,
// not a retail listing.
function toOutfitItem(item: WardrobeItem): OutfitItem {
  return {
    id: item.id,
    name: item.description || `${item.color} ${item.category}`,
    category: item.category,
    gender: "men",
    color: item.color,
    styleTags: item.style_tags,
    imageUrl: item.signedUrl ?? "",
    description: item.description ?? undefined,
    isAnchor: false,
  };
}

export default function WardrobePage() {
  const router = useRouter();
  const supabase = createClient();
  const { itemInOutfit, toggleItem } = useOutfit();

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [suggestionModal, setSuggestionModal] = useState<SuggestionModalState | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>("All");

  useEffect(() => {
    async function loadWardrobe() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data: rows, error: fetchError } = await supabase
        .from("wardrobe_items")
        .select("id, image_url, category, color, style_tags, description, location")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("[wardrobe] fetch failed:", fetchError.message);
        setError("Could not load your wardrobe. Please try again.");
        setReady(true);
        return;
      }

      const resolved = await Promise.all((rows ?? []).map(async (row) => {
        const storagePath = storagePathFromUrl(row.image_url);
        if (!storagePath) return { ...row, storagePath: null, signedUrl: null };

        const { data, error: signedUrlError } = await supabase.storage
          .from("wardrobe-photos")
          .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

        if (signedUrlError) {
          console.error("[wardrobe] signed URL failed:", signedUrlError.message);
        }

        return { ...row, storagePath, signedUrl: data?.signedUrl ?? null };
      }));

      setItems(resolved);
      setReady(true);
    }

    loadWardrobe();
  }, [router, supabase]);

  async function handleDelete(item: WardrobeItem) {
    setDeletingId(item.id);
    setError(null);

    if (item.storagePath) {
      const { error: storageError } = await supabase.storage
        .from("wardrobe-photos")
        .remove([item.storagePath]);

      if (storageError) {
        console.error("[wardrobe] storage delete failed:", storageError.message);
        setError("Could not remove the photo. Please try again.");
        setDeletingId(null);
        return;
      }
    }

    const { error: databaseError } = await supabase
      .from("wardrobe_items")
      .delete()
      .eq("id", item.id);

    if (databaseError) {
      console.error("[wardrobe] item delete failed:", databaseError.message);
      setError("Could not remove the wardrobe item. Please try again.");
      setDeletingId(null);
      return;
    }

    // Do this after deletion succeeds so a failed operation never clears the
    // user's in-progress outfit.
    if (itemInOutfit(item.id)) toggleItem(toOutfitItem(item));
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setDeletingId(null);
  }

  function handleAddToOutfit(item: WardrobeItem) {
    if (!itemInOutfit(item.id)) toggleItem(toOutfitItem(item));
    router.push("/pick-match");
  }

  function handleAddCatalogItem(item: CatalogItem) {
    if (!itemInOutfit(item.id)) toggleItem(item);
  }

  async function handleSuggestions(item: WardrobeItem) {
    setSuggestingId(item.id);
    setError(null);
    setSuggestionModal({ wardrobeItem: item, items: [], loading: true });
    try {
      const response = await fetch("/api/wardrobe/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: item.category,
          color: item.color,
          styleTags: item.style_tags,
          description: item.description ?? undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not get styling suggestions.");
      setSuggestionModal({ wardrobeItem: item, items: data.items as CatalogItem[], loading: false });
    } catch (suggestionError) {
      console.error("[wardrobe] suggestion failed:", suggestionError);
      setError(suggestionError instanceof Error ? suggestionError.message : "Could not get styling suggestions.");
      setSuggestionModal(null);
    } finally {
      setSuggestingId(null);
    }
  }

  if (!ready) return null;

  // Derive sorted unique location tabs from current items (blank → unlabelled, shown as "Unlabelled")
  const locationTabs = ["All", ...Array.from(
    new Set(items.map((item) => item.location.trim() || "Unlabelled"))
  ).sort()];

  const visibleItems = locationFilter === "All"
    ? items
    : items.filter((item) =>
        locationFilter === "Unlabelled"
          ? !item.location.trim()
          : item.location.trim() === locationFilter
      );

  return (
    <main className="app-refresh app-saved min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="fixed top-0 right-0 z-30 px-5 py-3" style={{ pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}><AccountDropdown /></div>
      </div>

      <header
        className="sticky top-0 z-20 relative flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => router.push("/home")}
          className="flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded-lg"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(event) => (event.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(event) => (event.currentTarget.style.color = "var(--text-muted)")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <span className="app-page-title text-sm font-semibold font-heading absolute left-1/2 -translate-x-1/2" style={{ color: "var(--text)" }}>My Wardrobe</span>
        <div style={{ width: 40 }} />
      </header>

      <div className="flex-1 px-4 py-6">
        {error && (
          <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}

        {items.length === 0 ? (
          <section
            className="mx-auto mt-10 max-w-md rounded-2xl border p-8 text-center"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h1 className="font-heading text-xl font-semibold" style={{ color: "var(--text)" }}>Your wardrobe is waiting</h1>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Upload photos of clothes you already own, and Fitzy can style them alongside the catalog.
            </p>
            <Link
              href="/wardrobe/upload"
              className="mt-6 inline-flex rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Upload new item
            </Link>
          </section>
        ) : (
          <section>
            {/* Location filter tabs — only shown when there are items */}
            {locationTabs.length > 1 && (
              <div
                className="flex flex-wrap gap-2 mb-4"
                role="tablist"
                aria-label="Filter by location"
              >
                {locationTabs.map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={locationFilter === tab}
                    onClick={() => setLocationFilter(tab)}
                    className="px-3 py-1 rounded-full text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2"
                    style={{
                      background: locationFilter === tab ? "var(--accent)" : "var(--surface)",
                      color: locationFilter === tab ? "var(--accent-text)" : "var(--text-muted)",
                      borderColor: locationFilter === tab ? "var(--accent)" : "var(--border)",
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            <p className="app-section-title text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              {locationFilter === "All" ? "Your items" : locationFilter}
            </p>

            {visibleItems.length === 0 ? (
              <p className="text-sm mt-6" style={{ color: "var(--text-muted)" }}>
                No items tagged &ldquo;{locationFilter}&rdquo;.
              </p>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {visibleItems.map((item) => (
                  <WardrobeCard
                    key={item.id}
                    item={item}
                    inOutfit={itemInOutfit(item.id)}
                    deleting={deletingId === item.id}
                    suggesting={suggestingId === item.id}
                    onAddToOutfit={() => handleAddToOutfit(item)}
                    onGetSuggestions={() => handleSuggestions(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Upload footer ─────────────────────────────────────────────────────── */}
      <div
        className="flex justify-center px-6 py-5 border-t"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <Link
          href="/wardrobe/upload"
          className="text-sm font-semibold px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          Upload new item
        </Link>
      </div>

      {suggestionModal && (
        <WardrobeSuggestionsModal
          wardrobeItem={suggestionModal.wardrobeItem}
          suggestions={suggestionModal.items}
          loading={suggestionModal.loading}
          itemInOutfit={itemInOutfit}
          onAddToOutfit={handleAddCatalogItem}
          onClose={() => setSuggestionModal(null)}
        />
      )}
    </main>
  );
}

function WardrobeCard({
  item,
  inOutfit,
  deleting,
  suggesting,
  onAddToOutfit,
  onGetSuggestions,
  onDelete,
}: {
  item: WardrobeItem;
  inOutfit: boolean;
  deleting: boolean;
  suggesting: boolean;
  onAddToOutfit: () => void;
  onGetSuggestions: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="relative w-full" style={{ paddingBottom: "120%", background: "var(--bg)" }}>
        {item.signedUrl ? (
          <Image src={item.signedUrl} alt={item.description || `${item.color} ${item.category}`} fill sizes="(max-width: 640px) 50vw, 200px" className="object-cover" unoptimized />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>Photo unavailable</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-xs font-medium capitalize" style={{ color: "var(--text)" }}>{item.category}</p>
        <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{item.color}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          {item.style_tags.map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{tag}</span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <button
            type="button"
            onClick={onAddToOutfit}
            disabled={deleting || !item.signedUrl}
            className="flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {inOutfit ? "In outfit" : "Add to outfit"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Delete ${item.color} ${item.category}`}
            className="rounded-lg border p-2 transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
            onMouseEnter={(event) => (event.currentTarget.style.color = "var(--danger)")}
            onMouseLeave={(event) => (event.currentTarget.style.color = "var(--text-muted)")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={onGetSuggestions}
          disabled={deleting || suggesting}
          className="mt-2 text-left text-xs font-semibold focus:outline-none focus-visible:ring-2 disabled:opacity-50"
          style={{ color: "var(--accent)" }}
        >
          {suggesting ? "Finding matches…" : "Get styling suggestions"}
        </button>
      </div>
    </article>
  );
}

function WardrobeSuggestionsModal({
  wardrobeItem,
  suggestions,
  loading,
  itemInOutfit,
  onAddToOutfit,
  onClose,
}: {
  wardrobeItem: WardrobeItem;
  suggestions: CatalogItem[];
  loading: boolean;
  itemInOutfit: (itemId: string) => boolean;
  onAddToOutfit: (item: CatalogItem) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30 bg-[#0b1a33]/45" onClick={onClose} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wardrobe-suggestions-title"
        className="fixed bottom-0 left-0 right-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ background: "var(--border)" }} />
        </div>
        <div className="px-5 pb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Fitzy&apos;s picks</p>
              <h2 id="wardrobe-suggestions-title" className="mt-1 font-heading text-lg font-semibold" style={{ color: "var(--text)" }}>
                Style your {wardrobeItem.color} {wardrobeItem.category}
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>A few catalog pieces that pair nicely with it.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close styling suggestions" className="rounded-lg p-2 focus:outline-none focus-visible:ring-2" style={{ color: "var(--text-muted)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center" aria-busy="true" aria-label="Finding styling suggestions">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Finding your best matches…</p>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((item) => {
                const price = formatPrice(item);
                const added = itemInOutfit(item.id);
                return (
                  <article key={item.id} className="overflow-hidden rounded-xl border" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
                    <Link href={`/item/${item.id}`} className="block focus:outline-none focus-visible:ring-2">
                      <div className="relative" style={{ height: 220, background: "var(--surface)" }}>
                        <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" unoptimized />
                      </div>
                      <div className="p-3 pb-2">
                        <p className="font-heading text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>{item.name}</p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text)" }}>{price ?? "Price unavailable"}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.styleTags.map((tag) => <span key={tag} className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{tag}</span>)}
                        </div>
                      </div>
                    </Link>
                    <div className="px-3 pb-3">
                      <button
                        type="button"
                        onClick={() => onAddToOutfit(item)}
                        disabled={added}
                        className="w-full rounded-lg px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-60"
                        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                      >
                        {added ? "Added to outfit" : "Add to outfit"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>No complementary catalog pieces found just yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
