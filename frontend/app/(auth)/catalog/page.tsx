"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import catalog, { CatalogItem } from "../../data/catalog";
import type { SearchOutput } from "../../api/search/route";
import type { FitzyOutput } from "../../api/fitzy/route";
import { createClient } from "../../lib/supabase";
import AccountDropdown from "../../components/AccountDropdown";
import { useOutfit } from "../../lib/outfit-context";
import OutfitAvatarWidget from "../../components/OutfitAvatarWidget";
import type { Measurements } from "../../components/MeasurementForm";
import FitzyChat from "../../components/FitzyChat";
import type { FitzyChatMessage } from "../../components/FitzyChat";
import FitPanel, { type FitState, type FitOutput, getStoredMeasurements } from "../../components/FitPanel";

// ─── helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES = ["all", "top", "bottom", "outerwear", "shoe"] as const;
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
  shoe: "Shoes",
  men: "Men",
  women: "Women",
  casual: "Casual",
  classic: "Classic",
  "smart-casual": "Smart-Casual",
  streetwear: "Streetwear",
  sporty: "Sporty",
  formal: "Formal",
};

// ─── shared pill button ───────────────────────────────────────────────────────

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
          ? { background: "var(--accent)", color: "var(--accent-text)", borderColor: "var(--accent)" }
          : { background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }
      }
    >
      {label}
    </button>
  );
}

// ─── types ────────────────────────────────────────────────────────────────────

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: SearchOutput; query: string }
  | { status: "error"; message: string };

// ─── page ─────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const router = useRouter();
  const supabase = createClient();
  const { toggleItem, itemInOutfit } = useOutfit();

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [style, setStyle] = useState<StyleFilter>("all");
  const [fit, setFit] = useState<FitState>({ status: "idle" });
  const [measurements, setMeasurements] = useState<Measurements | null>(null);

  // ── per-session AI response cache (item id → FitOutput) ─────────────────────
  const fitCache = useRef<Map<string, FitOutput>>(new Map());

  // ── Fitzy chat state (shared thread) ──────────────────────────────────────
  const [fitzyMessages, setFitzyMessages] = useState<FitzyChatMessage[]>([]);
  const [fitzyLoading, setFitzyLoading] = useState(false);
  const [fitzyOpen, setFitzyOpen] = useState(false);
  const [fitzyUnread, setFitzyUnread] = useState(false);

  // ── Header text (Fitzy's reply for current results) ───────────────────────
  const [fitzyHeaderText, setFitzyHeaderText] = useState<string | null>(null);

  // ── Active Fitzy item IDs (drives grid ordering) ─────────────────────────
  const [fitzyItemIds, setFitzyItemIds] = useState<string[] | null>(null);

  // ── Filter panel open/closed ──────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Legacy search state (kept for backward compat with URL ?q= flow) ─────
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  // ── saved items ────────────────────────────────────────────────────────────
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      // Seed gender filter from the user's profile preference
      const { data: profile } = await supabase
        .from("profiles")
        .select("gender")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.gender === "men" || profile?.gender === "women") {
        setGender(profile.gender);
      }

      const { data } = await supabase
        .from("saved_items")
        .select("id, catalog_item_id")
        .eq("user_id", user.id);

      const map: Record<string, string> = {};
      for (const row of data ?? []) map[row.catalog_item_id] = row.id;
      setSavedMap(map);

      // Load measurements for the outfit widget
      setMeasurements(getStoredMeasurements());

      // Restore Fitzy context passed from home page via sessionStorage
      try {
        const raw = sessionStorage.getItem("fitzy_context");
        if (raw) {
          const ctx = JSON.parse(raw);
          if (ctx.reply)     setFitzyHeaderText(ctx.reply);
          if (ctx.itemIds)   setFitzyItemIds(ctx.itemIds);
          if (ctx.messages)  setFitzyMessages(ctx.messages);
          // Clear so a refresh doesn't re-apply stale context
          sessionStorage.removeItem("fitzy_context");
        }
      } catch { /* ignore */ }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleSave(itemId: string) {
    const existingRowId = savedMap[itemId];

    if (existingRowId) {
      // Optimistic unsave
      setSavedMap((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
      await supabase.from("saved_items").delete().eq("id", existingRowId);
    } else {
      // Optimistic save — use a temp key until the real row id comes back
      const tempKey = `temp-${itemId}`;
      setSavedMap((prev) => ({ ...prev, [itemId]: tempKey }));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: inserted } = await supabase
        .from("saved_items")
        .insert({ user_id: user.id, catalog_item_id: itemId })
        .select("id")
        .single();
      if (inserted) {
        setSavedMap((prev) => ({ ...prev, [itemId]: inserted.id }));
      }
    }
  }

  // ── Fitzy send handler (catalog-side — updates grid in place) ─────────────
  async function handleFitzySend(text: string) {
    const userMsg: FitzyChatMessage = { role: "user", content: text };
    const next = [...fitzyMessages, userMsg];
    setFitzyMessages(next);
    setFitzyLoading(true);

    try {
      const res = await fetch("/api/fitzy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          catalog,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        const errMsg = { role: "assistant" as const, content: err.error ?? "Fitzy's having trouble right now — try again." };
        setFitzyMessages((prev) => [...prev, errMsg]);
        if (!fitzyOpen) setFitzyUnread(true);
        return;
      }

      const data: FitzyOutput = await res.json();

      if (data.type === "search") {
        // Update grid in-place — no navigation
        setFitzyHeaderText(data.reply);
        setFitzyItemIds(data.itemIds);
        const assistantMsg = { role: "assistant" as const, content: data.reply, itemIds: data.itemIds };
        setFitzyMessages((prev) => [...prev, assistantMsg]);
        if (!fitzyOpen) setFitzyUnread(true);
      } else {
        const assistantMsg = { role: "assistant" as const, content: data.reply };
        setFitzyMessages((prev) => [...prev, assistantMsg]);
        if (!fitzyOpen) setFitzyUnread(true);
      }
    } catch {
      const errMsg = { role: "assistant" as const, content: "Fitzy's having trouble right now — try again." };
      setFitzyMessages((prev) => [...prev, errMsg]);
      if (!fitzyOpen) setFitzyUnread(true);
    } finally {
      setFitzyLoading(false);
    }
  }

  // ── manual-filter pass ─────────────────────────────────────────────────────
  const manualFiltered = useMemo(() => {
    return catalog.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (gender !== "all" && item.gender !== gender) return false;
      if (style !== "all" && !item.styleTags.includes(style)) return false;
      return true;
    });
  }, [category, gender, style]);

  // ── grid ordering — Fitzy IDs take priority over legacy searchState ────────
  const { matchedItems, restItems, matchReasons } = useMemo(() => {
    // Fitzy results (from /api/fitzy) — primary path
    if (fitzyItemIds && fitzyItemIds.length > 0) {
      const matchIds = new Set(fitzyItemIds);
      const ranked = fitzyItemIds
        .map((id) => catalog.find((item) => item.id === id))
        .filter((item): item is CatalogItem => !!item && manualFiltered.includes(item));
      const rest = manualFiltered.filter((item) => !matchIds.has(item.id));
      return { matchedItems: ranked, restItems: rest, matchReasons: {} as Record<string, string> };
    }

    // Legacy /api/search results (backward compat)
    if (searchState.status === "done") {
      const matchIds = new Set(searchState.data.matches.map((m) => m.id));
      const reasons: Record<string, string> = {};
      for (const m of searchState.data.matches) reasons[m.id] = m.reason;
      const ranked = searchState.data.matches
        .map((m) => manualFiltered.find((item) => item.id === m.id))
        .filter((item): item is CatalogItem => item != null);
      const rest = manualFiltered.filter((item) => !matchIds.has(item.id));
      return { matchedItems: ranked, restItems: rest, matchReasons: reasons };
    }

    return { matchedItems: manualFiltered, restItems: [] as CatalogItem[], matchReasons: {} as Record<string, string> };
  }, [fitzyItemIds, searchState, manualFiltered]);

  const totalVisible = matchedItems.length + restItems.length;

  // ── legacy search call (kept for any direct ?q= fallback) ─────────────────
  async function runSearch(q: string) {
    if (!q.trim()) return;
    setSearchState({ status: "loading" });

    const activeFilters: Record<string, string> = {};
    if (category !== "all") activeFilters.category = category;
    if (gender !== "all") activeFilters.gender = gender;
    if (style !== "all") activeFilters.style = style;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          catalog,
          activeFilters: Object.keys(activeFilters).length ? activeFilters : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setSearchState({ status: "error", message: err.error ?? "Search failed." });
        return;
      }

      const data: SearchOutput = await res.json();
      setSearchState({ status: "done", data, query: q });
    } catch {
      setSearchState({ status: "error", message: "Network error — please try again." });
    }
  }

  // ── fit-check call — opens panel immediately, then fires AI (or uses cache) ─
  async function checkFit(item: CatalogItem) {
    const storedMeasurements = getStoredMeasurements();
    if (!storedMeasurements) {
      setFit({
        status: "error",
        message: "No measurements found. Please go back and enter your measurements first.",
      });
      return;
    }

    // Cache hit — show instantly
    const cached = fitCache.current.get(item.id);
    if (cached) {
      setFit({ status: "done", data: cached, item });
      return;
    }

    // Show item info immediately while AI loads
    setFit({ status: "loading", item });

    const activeFilters: Record<string, string> = {};
    if (category !== "all") activeFilters.category = category;
    if (style !== "all") activeFilters.style = style;

    try {
      const res = await fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMeasurements: storedMeasurements,
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
      fitCache.current.set(item.id, data);
      setFit({ status: "done", data, item });
    } catch {
      setFit({ status: "error", message: "Network error — please try again." });
    }
  }

  // ── recommendation items resolved from catalog ─────────────────────────────
  const recoItems =
    fit.status === "done"
      ? fit.data.recommendations
          .map((r) => ({ ...r, catalogItem: catalog.find((c) => c.id === r.id) }))
          .filter((r) => r.catalogItem != null)
      : [];

  // ────────────────────────────────────────────────────────────────────────────
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
        <div style={{ width: 40 }} />
      </header>

      {/* ── Fitzy reply header — replaces static tagline ── */}
      <div
        className="px-5 pt-5 pb-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <p
          className="text-xl font-bold tracking-tight font-heading leading-snug"
          style={{ color: "var(--text)" }}
        >
          {fitzyHeaderText ?? "Browse items."}
        </p>
        {fitzyItemIds && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {matchedItems.length} match{matchedItems.length !== 1 ? "es" : ""}
          </p>
        )}
      </div>

      {/* ── Filters — collapsed behind a toggle ── */}
      <div
        className="px-5 py-2 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 rounded"
          style={{ color: "var(--text-muted)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Refine results
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {filtersOpen && (
          <div className="flex flex-col gap-2 mt-2.5">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <FilterPill key={c} label={LABEL[c]} active={category === c} onClick={() => setCategory(c)} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GENDERS.map((g) => (
                <FilterPill key={g} label={LABEL[g]} active={gender === g} onClick={() => setGender(g)} />
              ))}
              <span className="self-center text-xs" style={{ color: "var(--border)" }}>|</span>
              {STYLES.map((s) => (
                <FilterPill key={s} label={LABEL[s]} active={style === s} onClick={() => setStyle(s)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 px-4 py-6 pb-32">
        {totalVisible === 0 ? (
          <p className="text-sm text-center mt-12" style={{ color: "var(--text-muted)" }}>
            No items match the selected filters.
          </p>
        ) : (
          <>
            {matchedItems.length > 0 && (
              <div
                className="ai-picks-carousel flex gap-3 overflow-x-auto -mx-4 px-4"
                style={{
                  scrollSnapType: "x mandatory",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  paddingRight: "2rem",
                }}
              >
                {matchedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex-shrink-0"
                    style={{ width: 156, scrollSnapAlign: "start" }}
                  >
                    <ItemCard
                      item={item}
                      onFitCheck={checkFit}
                      fitLoading={fit.status === "loading"}
                      searchReason={matchReasons[item.id]}
                      saved={item.id in savedMap}
                      onToggleSave={() => toggleSave(item.id)}
                      inOutfit={itemInOutfit(item.id)}
                      onToggleOutfit={() => toggleItem(item)}
                    />
                  </div>
                ))}
              </div>
            )}

            {restItems.length > 0 && (
              <>
                {matchedItems.length > 0 && (
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      More items
                    </span>
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  </div>
                )}
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    opacity: fitzyItemIds ? 0.45 : 1,
                  }}
                >
                  {restItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onFitCheck={checkFit}
                      fitLoading={fit.status === "loading"}
                      saved={item.id in savedMap}
                      onToggleSave={() => toggleSave(item.id)}
                      inOutfit={itemInOutfit(item.id)}
                      onToggleOutfit={() => toggleItem(item)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Fit-check panel ── */}
      {fit.status !== "idle" && (
        <FitPanel
          fit={fit}
          recoItems={recoItems}
          onClose={() => setFit({ status: "idle" })}
          onCheckFit={checkFit}
        />
      )}

      {/* ── Fitzy floating panel ── */}
      {fitzyOpen && (
        <>
          {/* Backdrop — tap outside to dismiss */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(11,26,51,0.25)" }}
            onClick={() => setFitzyOpen(false)}
          />
          <div
            className="fixed bottom-20 right-4 z-50 w-80 rounded-2xl flex flex-col overflow-hidden shadow-lg"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              height: 420,
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>
                Fitzy
              </span>
              <button
                onClick={() => setFitzyOpen(false)}
                className="focus:outline-none"
                style={{ color: "var(--text-muted)" }}
                aria-label="Close Fitzy"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Chat thread */}
            <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
              <FitzyChat
                messages={fitzyMessages}
                onSend={handleFitzySend}
                loading={fitzyLoading}
                mode="panel"
                onFitCheck={checkFit}
                placeholder="Refine or ask something…"
              />
            </div>
          </div>
        </>
      )}

      {/* ── Fitzy FAB — stacked above My Look widget ── */}
      <button
        onClick={() => {
          setFitzyOpen((v) => !v);
          setFitzyUnread(false);
        }}
        className="fixed right-4 z-40 flex items-center gap-1 px-2.5 py-1.5 rounded-xl focus:outline-none focus-visible:ring-2 transition-colors"
        style={{
          bottom: 116,
          background: fitzyOpen ? "#0B1A33" : "#8FB7FF",
          color: fitzyOpen ? "#F7F5F1" : "#0B1A33",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
        aria-label={fitzyOpen ? "Close Fitzy" : "Open Fitzy"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="text-[11px] font-bold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.01em" }}>
          Fitzy
        </span>
        {/* Unread dot */}
        {fitzyUnread && !fitzyOpen && (
          <span
            className="absolute top-0 right-0 w-2 h-2 rounded-full border-2"
            style={{
              background: "#B91C1C",
              borderColor: "#F7F5F1",
              transform: "translate(35%, -35%)",
            }}
            aria-label="Unread message"
          />
        )}
      </button>

      {/* ── Outfit avatar widget (My Look) ── */}
      {measurements && <OutfitAvatarWidget measurements={measurements} />}
    </main>
  );
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onFitCheck,
  fitLoading,
  searchReason,
  saved,
  onToggleSave,
  inOutfit,
  onToggleOutfit,
}: {
  item: CatalogItem;
  onFitCheck: (item: CatalogItem) => void;
  fitLoading: boolean;
  searchReason?: string;
  saved: boolean;
  onToggleSave: () => void;
  inOutfit: boolean;
  onToggleOutfit: () => void;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden border cursor-pointer"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      onClick={() => onFitCheck(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onFitCheck(item)}
      aria-label={`View fit details for ${item.name}`}
    >
      <div className="relative w-full" style={{ paddingBottom: "120%", background: "var(--bg)" }}>
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-cover"
          unoptimized
        />
        {/* Save button — stopPropagation so it doesn't also trigger card click */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
          aria-label={saved ? `Unsave ${item.name}` : `Save ${item.name}`}
          className="absolute top-2 right-2 rounded-full p-1 focus:outline-none focus-visible:ring-2 transition-colors"
          style={{ background: "rgba(255,255,255,0.85)" }}
        >
          {saved ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          )}
        </button>
      </div>
      <div className="flex flex-col gap-1.5 p-3 flex-1">
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
        <div className="flex flex-wrap gap-1 mt-auto pt-1">
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
        {searchReason && (
          <p
            className="text-[10px] leading-snug pt-1 mt-0.5 border-t"
            style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
          >
            {searchReason}
          </p>
        )}
        {/* Bottom action row — stopPropagation on inner buttons */}
        <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onFitCheck(item)}
            disabled={fitLoading}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
            style={{
              background: "var(--accent)",
              color: "var(--accent-text)",
              borderColor: "var(--accent)",
              opacity: fitLoading ? 0.6 : 1,
            }}
          >
            {fitLoading ? "Loading…" : "Check Fit"}
          </button>
          <button
            onClick={onToggleOutfit}
            aria-label={inOutfit ? `Remove ${item.name} from look` : `Add ${item.name} to look`}
            title={inOutfit ? "Remove from My Look" : "Add to My Look"}
            className="flex-shrink-0 px-2 py-1.5 text-xs font-semibold rounded-lg border transition-colors focus:outline-none focus-visible:ring-2"
            style={inOutfit
              ? { background: "var(--text)", color: "var(--surface)", borderColor: "var(--text)" }
              : { background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
          >
            {inOutfit ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="7" r="4" />
                <path d="M12 14c-5 0-8 2.24-8 5v1h16v-1c0-2.76-3-5-8-5z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="7" r="4" />
                <path d="M12 14c-5 0-8 2.24-8 5v1h16v-1c0-2.76-3-5-8-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

