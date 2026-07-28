"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import catalog, { CatalogItem } from "../../data/catalog";
import AccountDropdown from "../../components/AccountDropdown";

// ─── data slices ──────────────────────────────────────────────────────────────

const outerwearItems = catalog.filter((i) => i.category === "outerwear");
const topItems       = catalog.filter((i) => i.category === "top");
const bottomItems    = catalog.filter((i) => i.category === "bottom");
const shoeItems      = catalog.filter((i) => i.category === "shoe");

// ─── PickCard ─────────────────────────────────────────────────────────────────
// Minimal read-only card — same visual as ItemCard in catalog/page.tsx but
// without action buttons (those come in a later pass).

function PickCard({ item }: { item: CatalogItem }) {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
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
// One horizontally scrollable row of cards for a single garment category.

function CategoryRow({ label, items }: { label: string; items: CatalogItem[] }) {
  return (
    <div>
      <h2
        className="text-xs font-semibold uppercase tracking-wider px-4 mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </h2>
      <div
        className="ai-picks-carousel flex gap-3 overflow-x-auto -mx-4 px-4"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          paddingRight: "2rem",
        } as React.CSSProperties}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0"
            style={{ width: 156, scrollSnapAlign: "start" }}
          >
            <PickCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function PickMatchPage() {
  const router = useRouter();

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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h1
          className="text-sm font-semibold font-heading absolute left-1/2 -translate-x-1/2"
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
        {/* ── Left: category rows ── */}
        <div className="flex flex-col gap-8 px-4 py-6 overflow-hidden">
          <CategoryRow label="Outerwear" items={outerwearItems} />
          <CategoryRow label="Tops"      items={topItems} />
          <CategoryRow label="Bottoms"   items={bottomItems} />
          {shoeItems.length > 0 && (
            <CategoryRow label="Shoes" items={shoeItems} />
          )}
        </div>

        {/* ── Right: avatar placeholder ── */}
        <div
          className="sticky top-[57px] self-start mx-4 my-6 rounded-2xl flex flex-col items-center justify-center gap-2 max-sm:hidden"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            minHeight: "calc(100vh - 57px - 48px)",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="12" cy="9" r="2.5" />
            <path d="M7 20c0-2.76 2.24-5 5-5s5 2.24 5 5" />
          </svg>
          <p className="text-xs text-center px-6" style={{ color: "var(--text-muted)" }}>
            Avatar preview
          </p>
          <p className="text-[10px] text-center px-6" style={{ color: "var(--border)" }}>
            coming soon
          </p>
        </div>
      </div>

    </main>
  );
}
