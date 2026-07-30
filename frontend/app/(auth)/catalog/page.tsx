"use client";

import Image from "next/image";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import catalog, { CatalogItem } from "../../data/catalog";
import type { FitzyOutput } from "../../api/fitzy/route";
import { createClient } from "../../lib/supabase";
import AccountDropdown from "../../components/AccountDropdown";
import { useOutfit } from "../../lib/outfit-context";
import { CategoryRow } from "../../components/CategoryRows";
import OutfitFitPanel, { type OutfitFitState } from "../../components/OutfitFitPanel";
import { getStoredMeasurements } from "../../components/FitPanel";
import type { Measurements } from "../../components/MeasurementForm";
import FitzyChat from "../../components/FitzyChat";
import type { FitzyChatMessage } from "../../components/FitzyChat";
import { useSavedItems } from "../../lib/useSavedItems";

// ─── helpers ─────────────────────────────────────────────────────────────────

const GENDERS = ["all", "men", "women"] as const;
const STYLES = ["all", "casual", "classic", "smart-casual", "streetwear", "sporty", "formal"] as const;

type GenderFilter = (typeof GENDERS)[number];
type StyleFilter = (typeof STYLES)[number];

const LABEL: Record<string, string> = {
  all: "All",
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
  "px-3 py-1 text-xs font-medium rounded-full border transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.94] focus:outline-none focus-visible:ring-2";

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

// ─── page ─────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const router = useRouter();
  const supabase = createClient();
  const { outfit, toggleItem, clearOutfit } = useOutfit();

  const { savedRowIds, loadSavedItems, toggleSave } = useSavedItems();
  const [userId, setUserId] = useState<string | null>(null);

  const [gender, setGender] = useState<GenderFilter>("all");
  const [style, setStyle] = useState<StyleFilter>("all");
  const [measurements, setMeasurements] = useState<Measurements | null>(null);

  // ── true once the profile fetch has resolved and gender is correctly seeded ──
  const [profileReady, setProfileReady] = useState(false);

  // ── Fitzy chat state (shared thread) ──────────────────────────────────────
  const [fitzyMessages, setFitzyMessages] = useState<FitzyChatMessage[]>([]);
  const [fitzyLoading, setFitzyLoading] = useState(false);
  const [fitzyOpen, setFitzyOpen] = useState(false);
  const [fitzyUnread, setFitzyUnread] = useState(false);

  // ── Header text (Fitzy's reply for current results) ───────────────────────
  const [fitzyHeaderText, setFitzyHeaderText] = useState<string | null>(null);

  // ── Active Fitzy item IDs (drives Match badges) ───────────────────────────
  const [fitzyItemIds, setFitzyItemIds] = useState<string[] | null>(null);

  // ── Filter panel open/closed ──────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Outfit review state (reused from Pick & Match) ────────────────────────
  const [outfitFit, setOutfitFit] = useState<OutfitFitState>({ status: "idle" });

  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      setUserId(user.id);

      // Seed gender filter from the user's profile preference
      const { data: profile } = await supabase
        .from("profiles")
        .select("gender")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.gender === "men" || profile?.gender === "women") {
        setGender(profile.gender);
      }

      // Load measurements for the outfit review panel
      setMeasurements(getStoredMeasurements());

      // Load saved items so hearts are filled from the start
      await loadSavedItems(user.id);

      // Mark profile as ready — rows must not render until this point so the
      // user never sees an unfiltered flash before the gender preference lands.
      setProfileReady(true);

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

  // ── Auto-clear save toast ────────────────────────────────────────────────
  useEffect(() => {
    if (saveStatus === "saved" || saveStatus === "error") {
      saveToastTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
    return () => {
      if (saveToastTimer.current) clearTimeout(saveToastTimer.current);
    };
  }, [saveStatus]);

  // ── Filtered catalog per-category ────────────────────────────────────────
  const filteredByGenderStyle = useMemo(() => {
    return catalog.filter((item) => {
      if (gender !== "all" && item.gender !== gender) return false;
      if (style !== "all" && !item.styleTags.includes(style)) return false;
      return true;
    });
  }, [gender, style]);

  const outerwearItems = useMemo(() => filteredByGenderStyle.filter((i) => i.category === "outerwear"), [filteredByGenderStyle]);
  const topItems       = useMemo(() => filteredByGenderStyle.filter((i) => i.category === "top"),       [filteredByGenderStyle]);
  const bottomItems    = useMemo(() => filteredByGenderStyle.filter((i) => i.category === "bottom"),    [filteredByGenderStyle]);
  const shoeItems      = useMemo(() => filteredByGenderStyle.filter((i) => i.category === "shoe"),      [filteredByGenderStyle]);

  // ── matchIds set — used by CategoryRow to badge Fitzy's picks ────────────
  const matchIds = useMemo<ReadonlySet<string>>(
    () => (fitzyItemIds ? new Set(fitzyItemIds) : new Set()),
    [fitzyItemIds],
  );

  const matchCount = useMemo(
    () => (fitzyItemIds ? filteredByGenderStyle.filter((i) => matchIds.has(i.id)).length : 0),
    [fitzyItemIds, filteredByGenderStyle, matchIds],
  );

  // ── Fitzy send handler ───────────────────────────────────────────────────
  async function handleFitzySend(text: string) {
    // A new search replaces the visible results — drop any previously
    // selected outfit items before the new results land.
    clearOutfit();

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
          // Send only the currently visible (gender+style-filtered) items so
          // Fitzy never picks IDs that would be silently dropped from the rows.
          catalog: filteredByGenderStyle,
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

  // ── Outfit review / save (same logic as Pick & Match) ────────────────────
  const selectedItems: CatalogItem[] = [
    outfit.outerwear,
    outfit.top,
    outfit.bottom,
    outfit.shoe,
  ].filter((i): i is CatalogItem => i !== null);

  const hasSelection = selectedItems.length > 0;

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
            id: i.id, name: i.name, category: i.category,
            color: i.color, styleTags: i.styleTags, sizes: i.sizes,
          })),
          catalog: catalog.map((c) => ({
            id: c.id, name: c.name, category: c.category,
            color: c.color, styleTags: c.styleTags,
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

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <main className="app-refresh app-catalog min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

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

      {/* ── Two-column body (mirrors Pick & Match layout) ── */}
      <div
        className="flex-1 grid"
        style={{
          gridTemplateColumns: "minmax(0, 65fr) minmax(0, 35fr)",
          alignItems: "start",
          gap: 0,
        }}
      >
        {/* ── Left: Fitzy header + filters + category rows ── */}
        <div className="flex flex-col overflow-hidden">

          {/* Fitzy reply header */}
          <div
            className="px-5 pt-5 pb-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <p
              className="app-page-title text-xl font-bold tracking-tight font-heading leading-snug"
              style={{ color: "var(--text)" }}
            >
              {fitzyHeaderText ?? "Browse items."}
            </p>
            {fitzyItemIds && matchCount > 0 && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {matchCount} match{matchCount !== 1 ? "es" : ""} — look for the{" "}
                <span
                  className="app-match-badge inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  Match
                </span>{" "}
                badge
              </p>
            )}
          </div>

          {/* Filters */}
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

          {/* Category rows — only rendered after the profile fetch resolves so
              the gender filter is already correct on first paint (no unfiltered flash). */}
          <div className="flex flex-col gap-8 px-4 py-6 pb-32">
            {!profileReady ? (
              /* Loading skeleton — four rows matching the four category rows */
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
                {outerwearItems.length > 0 && (
                  <CategoryRow
                    label="Outerwear"
                    items={outerwearItems}
                    matchIds={fitzyItemIds ? matchIds : undefined}
                    savedRowIds={savedRowIds}
                    onToggleSave={(id) => userId && toggleSave(userId, id)}
                  />
                )}
                {topItems.length > 0 && (
                  <CategoryRow
                    label="Tops"
                    items={topItems}
                    matchIds={fitzyItemIds ? matchIds : undefined}
                    savedRowIds={savedRowIds}
                    onToggleSave={(id) => userId && toggleSave(userId, id)}
                  />
                )}
                {bottomItems.length > 0 && (
                  <CategoryRow
                    label="Bottoms"
                    items={bottomItems}
                    matchIds={fitzyItemIds ? matchIds : undefined}
                    savedRowIds={savedRowIds}
                    onToggleSave={(id) => userId && toggleSave(userId, id)}
                  />
                )}
                {shoeItems.length > 0 && (
                  <CategoryRow
                    label="Shoes"
                    items={shoeItems}
                    matchIds={fitzyItemIds ? matchIds : undefined}
                    savedRowIds={savedRowIds}
                    onToggleSave={(id) => userId && toggleSave(userId, id)}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right: flat-lay outfit panel ── */}
        <OutfitFlatLay outfit={outfit} onRemove={toggleItem} />
      </div>

      {/* ── Action bar — shown once ≥1 item is selected (same as Pick & Match) ── */}
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
              Couldn&apos;t save — try again
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

      {/* ── Outfit fit panel (bottom sheet — same as Pick & Match) ── */}
      <OutfitFitPanel
        outfitState={outfitFit}
        selectedItems={selectedItems}
        onClose={() => setOutfitFit({ status: "idle" })}
        onSwap={(item) => { toggleItem(item); setOutfitFit({ status: "idle" }); }}
      />

      {/* ── Fitzy floating panel ── */}
      {fitzyOpen && (
        <>
          {/* Backdrop — tap outside to dismiss */}
          <div
            className="fixed inset-0 z-40 transition-opacity duration-200 ease-out starting:opacity-0 motion-reduce:transition-none"
            style={{ background: "rgba(11,26,51,0.25)" }}
            onClick={() => setFitzyOpen(false)}
          />
          <div
            className="fixed bottom-20 right-4 z-50 w-80 rounded-2xl flex flex-col overflow-hidden shadow-lg transition-[transform,opacity] duration-200 ease-out starting:opacity-0 starting:scale-95 motion-reduce:transition-none"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              height: 420,
              transformOrigin: "bottom right",
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
                placeholder="Refine or ask something…"
              />
            </div>
          </div>
        </>
      )}

      {/* ── Fitzy FAB — stacked above action bar ── */}
      <button
        onClick={() => {
          setFitzyOpen((v) => !v);
          setFitzyUnread(false);
        }}
        className="fitzy-fab fixed right-4 bottom-6 z-40 flex items-center gap-1 px-2.5 py-1.5 rounded-xl focus:outline-none focus-visible:ring-2"
        style={{
          "--fab-offset": hasSelection ? "-92px" : "0px",
          background: fitzyOpen ? "var(--text)" : "var(--accent)",
          color: fitzyOpen ? "var(--bg)" : "var(--accent-text)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        } as React.CSSProperties}
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
            className="unread-dot absolute top-0 right-0 w-2 h-2 rounded-full border-2"
            style={{
              background: "var(--danger)",
              borderColor: "var(--bg)",
              transform: "translate(35%, -35%)",
            }}
            aria-label="Unread message"
          />
        )}
      </button>

    </main>
  );
}

// ─── OutfitFlatLay ────────────────────────────────────────────────────────────
// Right-hand sticky panel — vertical flat-lay image stack of the current outfit.
// Empty state shows the original avatar-preview placeholder.

type FlatLayProps = {
  outfit: import("../../lib/outfit-context").OutfitState;
  onRemove: (item: CatalogItem) => void;
};

const SLOT_HEIGHTS: Record<string, number> = {
  outerwear: 120,
  top:       110,
  bottom:    110,
  shoe:       80,
};

const SLOT_LABELS: Record<string, string> = {
  outerwear: "Outerwear",
  top:       "Top",
  bottom:    "Bottom",
  shoe:      "Shoes",
};

function OutfitFlatLay({ outfit, onRemove }: FlatLayProps) {
  const SLOTS = ["outerwear", "top", "bottom", "shoe"] as const;
  const filled = SLOTS.map((s) => outfit[s]).filter((i): i is CatalogItem => i !== null);

  const totalPrice = filled.reduce((sum, i) => (i.price == null ? sum : sum + i.price), 0);

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
      {filled.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="12" cy="9" r="2.5" />
            <path d="M7 20c0-2.76 2.24-5 5-5s5 2.24 5 5" />
          </svg>
          <p className="text-xs text-center px-6" style={{ color: "var(--text-muted)" }}>
            Select items to build your outfit
          </p>
        </div>
      )}

      {filled.length > 0 && (
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex flex-col gap-3 p-4">
            {SLOTS.map((slot) => {
              const item = outfit[slot];
              if (!item) return null;
              const h = SLOT_HEIGHTS[slot];
              return (
                <div key={slot} className="flex flex-col gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {SLOT_LABELS[slot]}
                  </p>
                  <div className="relative rounded-xl overflow-hidden" style={{ height: h, background: "var(--bg)", border: "1px solid var(--border)" }}>
                    <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 1280px) 25vw, 300px" className="object-contain" unoptimized />
                    <button
                      aria-label={`Remove ${item.name}`}
                      onClick={() => onRemove(item)}
                      className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full transition-[transform,opacity] duration-150 ease-out active:scale-90 focus:outline-none focus-visible:ring-2"
                      style={{ width: 22, height: 22, background: "rgba(255,255,255,0.88)", backdropFilter: "blur(4px)", border: "none", cursor: "pointer", zIndex: 1 }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[11px] font-medium leading-snug line-clamp-1" style={{ color: "var(--text)" }}>
                    {item.name}
                  </p>
                </div>
              );
            })}
          </div>

          {hasPrices && (
            <div className="mx-4 mb-4 mt-1 rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: "var(--accent-soft)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Total</p>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{currencySymbol}{totalPrice.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
