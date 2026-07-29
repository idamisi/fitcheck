"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import Image from "next/image";
import type { CatalogItem } from "../data/catalog";
import { useOutfit } from "../lib/outfit-context";

// ─── PickCard ─────────────────────────────────────────────────────────────────
// Tappable card: highlights with an accent-blue border when selected.
// If `matched` is true, shows a small "Match" badge in the top-left corner.

export function PickCard({
  item,
  selected,
  onSelect,
  matched,
}: {
  item: CatalogItem;
  selected: boolean;
  onSelect: () => void;
  matched?: boolean;
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
        borderColor: selected ? "var(--accent)" : matched ? "#93b4e8" : "var(--border)",
        borderWidth: selected || matched ? 2 : 1,
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
        {/* Match badge — only when Fitzy flagged this item */}
        {matched && (
          <div
            className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{
              background: "var(--accent)",
              color: "var(--accent-text)",
              letterSpacing: "0.04em",
            }}
          >
            Match
          </div>
        )}
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
// One horizontally-scrollable row for a single clothing category.
//
// `matchIds` — when provided:
//   • matched items are sorted to the front of the row, rest follow in original order
//   • matched cards get a "Match" badge
// When `matchIds` is undefined (e.g. /pick-match), original order is preserved and
// no badges are shown.
//
// A right-pointing scroll arrow sits in-flow to the right of the scroll container,
// scrolling forward one card-width per click; it hides once the row is at its end.

const CARD_W = 156; // px — must match the flex-shrink-0 width below
const GAP    = 12;  // px — gap-3 = 12px

export function CategoryRow({
  label,
  items,
  matchIds,
}: {
  label: string;
  items: CatalogItem[];
  matchIds?: ReadonlySet<string>;
}) {
  const { toggleItem, itemInOutfit } = useOutfit();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  // ── sort: matched items first (only when matchIds is provided) ──────────────
  const sortedItems = useMemo(() => {
    if (!matchIds || matchIds.size === 0) return items;
    const matched: CatalogItem[] = [];
    const rest: CatalogItem[] = [];
    for (const item of items) {
      (matchIds.has(item.id) ? matched : rest).push(item);
    }
    return [...matched, ...rest];
  }, [items, matchIds]);

  // ── detect whether the row is scrolled to its end ──────────────────────────
  function checkEnd() {
    const el = scrollRef.current;
    if (!el) return;
    // Allow a 2px tolerance for sub-pixel rounding
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkEnd(); // initial state
    el.addEventListener("scroll", checkEnd, { passive: true });
    // Also recheck if the row resizes (e.g. window resize)
    const ro = new ResizeObserver(checkEnd);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkEnd);
      ro.disconnect();
    };
  }, [sortedItems]); // re-run when items change so initial state is accurate

  function scrollForward() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: CARD_W + GAP, behavior: "smooth" });
  }

  return (
    <div>
      <h2
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </h2>

      {/* Row strip + arrow sit side-by-side.
          No negative-margin bleed: the scroll container is a normal flex-1 box,
          so the arrow's 36px slot is genuinely outside the card paint area. */}
      <div className="flex items-center gap-2">
        {/* scroll container — flex-1, constrained to its own box, no negative margin */}
        <div
          ref={scrollRef}
          className="ai-picks-carousel flex gap-3 flex-1"
          style={{
            overflowX: "auto",
            overflowY: "clip",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          } as React.CSSProperties}
        >
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0"
              style={{ width: CARD_W, scrollSnapAlign: "start" }}
            >
              <PickCard
                item={item}
                selected={itemInOutfit(item.id)}
                onSelect={() => toggleItem(item)}
                matched={matchIds ? matchIds.has(item.id) : false}
              />
            </div>
          ))}
        </div>

        {/* ── Scroll-forward arrow — in-flow, outside the card area ── */}
        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 36 }}>
          {!atEnd && (
            <button
              onClick={scrollForward}
              aria-label={`Scroll ${label} row forward`}
              className="flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 transition-opacity hover:opacity-90"
              style={{
                width: 28,
                height: 28,
                background: "var(--surface)",
                border: "1.5px solid #8FB7FF",
                color: "#0B1A33",
                boxShadow: "0 1px 6px rgba(11,26,51,0.12)",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
