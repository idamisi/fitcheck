"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase";
import catalog, { CatalogItem } from "../../../data/catalog";
import type { FitOutput } from "../../../api/fit/route";
import type { Measurements } from "../../../components/MeasurementForm";
import AccountDropdown from "../../../components/AccountDropdown";
import { useOutfit } from "../../../lib/outfit-context";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getStoredMeasurements(): Measurements | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("fitcheck_measurements");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatPrice(item: CatalogItem) {
  if (item.price == null || !item.currency) return null;
  const sym = item.currency === "USD" ? "$" : item.currency === "GBP" ? "£" : item.currency;
  return { current: `${sym}${item.price.toFixed(2)}`, original: item.originalPrice != null && item.originalPrice > item.price ? `${sym}${item.originalPrice.toFixed(2)}` : null };
}

// ─── FitState ─────────────────────────────────────────────────────────────────

type FitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: FitOutput }
  | { status: "error"; message: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const { toggleItem, itemInOutfit } = useOutfit();

  const itemId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const item = catalog.find((c) => c.id === itemId) ?? null;

  // ── auth guard ────────────────────────────────────────────────────────────
  const [ready, setReady] = useState(false);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

  // ── fit state ─────────────────────────────────────────────────────────────
  const [fit, setFit] = useState<FitState>({ status: "idle" });
  const fitCache = useRef<Map<string, FitOutput>>(new Map());

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      // Check if this item is already saved
      const { data } = await supabase
        .from("saved_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("catalog_item_id", itemId)
        .maybeSingle();

      if (data) setSavedRowId(data.id);

      setReady(true);
    }
    init();
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── save / unsave ─────────────────────────────────────────────────────────
  async function handleToggleSave() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (savedRowId) {
      setSavedRowId(null);
      await supabase.from("saved_items").delete().eq("id", savedRowId);
    } else {
      const { data: inserted } = await supabase
        .from("saved_items")
        .insert({ user_id: user.id, catalog_item_id: itemId })
        .select("id")
        .single();
      if (inserted) setSavedRowId(inserted.id);
    }
  }

  // ── fit check ─────────────────────────────────────────────────────────────
  async function handleCheckFit() {
    if (!item) return;
    const storedM = getStoredMeasurements();
    if (!storedM) {
      setFit({ status: "error", message: "No measurements found. Go to Your measurements and save them first." });
      return;
    }

    const cached = fitCache.current.get(item.id);
    if (cached) { setFit({ status: "done", data: cached }); return; }

    setFit({ status: "loading" });

    try {
      const res = await fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMeasurements: storedM,
          selectedItemId: item.id,
          catalog,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setFit({ status: "error", message: err.error ?? "Request failed." });
        return;
      }

      const data: FitOutput = await res.json();
      fitCache.current.set(item.id, data);
      setFit({ status: "done", data });
    } catch {
      setFit({ status: "error", message: "Network error — please try again." });
    }
  }

  if (!ready) return null;
  if (!item) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Item not found.</p>
      </div>
    );
  }

  const price = formatPrice(item);
  const recoItems: (CatalogItem & { reason: string })[] =
    fit.status === "done"
      ? fit.data.recommendations
          .map((r) => { const ci = catalog.find((c) => c.id === r.id); return ci ? { ...ci, reason: r.reason } : null; })
          .filter((x): x is CatalogItem & { reason: string } => x !== null)
      : [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <style>{`
        .item-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 2.5rem;
          align-items: start;
        }
        @media (max-width: 768px) {
          .item-grid { grid-template-columns: 1fr; gap: 1.5rem; }
        }
        .reco-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 1rem;
        }
        .reco-card:hover {
          border-color: #C8D8F5 !important;
          transform: translateY(-2px);
        }
        .reco-card { transition: border-color 0.15s, transform 0.15s; }
      `}</style>

      {/* ── AccountDropdown fixed top-right ─────────────────────────────────── */}
      <div style={{ position: "fixed", top: 0, right: 0, zIndex: 30, padding: "0.75rem 1.25rem", pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}><AccountDropdown /></div>
      </div>

      {/* ── Nav / back link ────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        padding: "0.75rem clamp(1rem, 4vw, 3rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.875rem", color: "var(--text-muted)",
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to results
        </button>
        <div style={{ width: 40 }} />
      </header>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: "1100px", margin: "0 auto",
        padding: "clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 3rem)",
        paddingBottom: "8rem",
      }}>

        {/* ── Two-column item section ───────────────────────────────────── */}
        <div className="item-grid">

          {/* Left: large image */}
          <div style={{
            position: "relative",
            width: "100%",
            aspectRatio: "3 / 4",
            borderRadius: "16px",
            overflow: "hidden",
            background: "#EFEFEC",
            border: "1px solid var(--border)",
          }}>
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              unoptimized
            />
          </div>

          {/* Right: details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Name + meta */}
            <div>
              <h1 style={{
                fontFamily: "var(--font-heading)", color: "var(--text)",
                fontSize: "clamp(1.25rem, 3vw, 1.625rem)", fontWeight: 700,
                lineHeight: 1.25, letterSpacing: "-0.02em", margin: "0 0 0.5rem",
              }}>
                {item.name}
              </h1>
              {item.brand && (
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  {item.brand}
                </p>
              )}
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                {item.color}
              </p>
            </div>

            {/* Price */}
            {price && (
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text)" }}>{price.current}</span>
                {price.original && (
                  <span style={{ fontSize: "0.875rem", color: "var(--text-muted)", textDecoration: "line-through" }}>
                    {price.original}
                  </span>
                )}
              </div>
            )}

            {/* Style tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {item.styleTags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: "0.75rem", padding: "0.25rem 0.625rem",
                    borderRadius: "999px", background: "var(--bg)",
                    color: "var(--text)", border: "1px solid var(--border)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Sizes */}
            {item.sizes && (
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem" }}>
                  Availability
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--text)", lineHeight: 1.6 }}>
                  {item.sizes}
                </p>
              </div>
            )}

            {/* CTA row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem", alignItems: "center" }}>

              {/* Primary: Check it fits */}
              <button
                onClick={handleCheckFit}
                disabled={fit.status === "loading"}
                className="active:scale-[0.97] disabled:active:scale-100"
                style={{
                  padding: "0.625rem 1.25rem",
                  fontSize: "0.9375rem", fontWeight: 600,
                  background: "var(--accent)", color: "var(--accent-text)",
                  border: "1.5px solid var(--accent)",
                  borderRadius: "8px",
                  cursor: fit.status === "loading" ? "not-allowed" : "pointer",
                  opacity: fit.status === "loading" ? 0.6 : 1,
                  transition: "opacity 0.15s, transform 150ms var(--ease-out-strong)",
                }}
              >
                {fit.status === "loading" ? "Checking…" : "Check it fits"}
              </button>

              {/* Shop now */}
              {item.productUrl && (
                <a
                  href={item.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="active:scale-[0.97]"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.375rem",
                    padding: "0.625rem 1.25rem",
                    fontSize: "0.9375rem", fontWeight: 600,
                    background: "var(--surface)", color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    textDecoration: "none",
                    transition: "border-color 0.15s, transform 150ms var(--ease-out-strong)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  Shop now
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              )}

              {/* Save toggle */}
              <button
                onClick={handleToggleSave}
                aria-label={savedRowId ? `Unsave ${item.name}` : `Save ${item.name}`}
                className="active:scale-[0.97]"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.625rem 1rem",
                  fontSize: "0.875rem", fontWeight: 500,
                  background: "var(--surface)", color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "border-color 0.15s, transform 150ms var(--ease-out-strong)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                {savedRowId ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--accent)" stroke="none" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                )}
                {savedRowId ? "Saved" : "Save"}
              </button>

              {/* Add to look */}
              <button
                onClick={() => item && toggleItem(item)}
                aria-label={itemInOutfit(item.id) ? `Remove ${item.name} from look` : `Add ${item.name} to look`}
                className="active:scale-[0.97]"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.625rem 1rem",
                  fontSize: "0.875rem", fontWeight: 500,
                  background: itemInOutfit(item.id) ? "var(--text)" : "var(--surface)",
                  color: itemInOutfit(item.id) ? "var(--surface)" : "var(--text)",
                  border: `1px solid ${itemInOutfit(item.id) ? "var(--text)" : "var(--border)"}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background-color 0.15s, color 0.15s, transform 150ms var(--ease-out-strong)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={itemInOutfit(item.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="7" r="4"/>
                  <path d="M12 14c-5 0-8 2.24-8 5v1h16v-1c0-2.76-3-5-8-5z"/>
                </svg>
                {itemInOutfit(item.id) ? "In My Look" : "Add to look"}
              </button>
            </div>

            {/* Fit details section — shown after Check it fits is triggered */}
            {fit.status === "error" && (
              <div style={{
                padding: "0.875rem 1rem", borderRadius: "12px",
                background: "#FEF2F2", border: "1px solid #FECACA",
              }}>
                <p style={{ fontSize: "0.875rem", color: "var(--danger)", margin: 0 }}>{fit.message}</p>
              </div>
            )}

            {fit.status === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)", margin: 0 }}>
                  Fit Details
                </p>
                {[80, 95, 70].map((w, i) => (
                  <div key={i} style={{ height: "0.75rem", borderRadius: "4px", width: `${w}%`, background: "var(--border)" }} />
                ))}
              </div>
            )}

            {fit.status === "done" && fit.data.recommendedSize && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)", margin: 0 }}>
                  Recommended Size
                </p>
                <span style={{
                  fontSize: "0.75rem", fontWeight: 700,
                  padding: "0.125rem 0.5rem",
                  borderRadius: "6px",
                  background: "var(--accent)", color: "var(--accent-text)",
                }}>
                  {fit.data.recommendedSize}
                </span>
              </div>
            )}

            {fit.status === "done" && fit.data.fitDescription && (
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)", marginBottom: "0.5rem" }}>
                  Fit Details
                </p>
                <p style={{ fontSize: "0.9375rem", lineHeight: 1.7, color: "var(--text)", margin: 0 }}>
                  {fit.data.fitDescription}
                </p>
              </div>
            )}

          </div>
        </div>

        {/* ── Pairs well with ────────────────────────────────────────────── */}
        {recoItems.length > 0 && (
          <section style={{ marginTop: "3rem" }}>
            <p style={{
              fontSize: "0.75rem", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--accent)", marginBottom: "1rem",
            }}>
              Pairs Well With
            </p>
            <div className="reco-grid">
              {recoItems.map((reco) => (
                <RecoCard
                  key={reco.id}
                  item={reco}
                  reason={reco.reason}
                  onNavigate={() => router.push(`/item/${reco.id}`)}
                />
              ))}
            </div>
          </section>
        )}

      </div>

    </div>
  );
}

// ─── RecoCard ─────────────────────────────────────────────────────────────────

function RecoCard({
  item,
  reason,
  onNavigate,
}: {
  item: CatalogItem;
  reason: string;
  onNavigate: () => void;
}) {
  return (
    <div
      className="reco-card"
      onClick={onNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onNavigate()}
      aria-label={`View ${item.name}`}
      style={{
        display: "flex", flexDirection: "column",
        borderRadius: "16px", overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        cursor: "pointer",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", width: "100%", paddingBottom: "120%", background: "var(--bg)" }}>
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Info */}
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1 }}>
        <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.3, margin: 0 }}>
          {item.name}
        </p>
        <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textTransform: "capitalize", margin: 0 }}>
          {item.color}
        </p>
        {item.price != null && item.currency && (
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
            {item.currency === "USD" ? "$" : item.currency === "GBP" ? "£" : item.currency}{item.price.toFixed(2)}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.25rem" }}>
          {item.styleTags.map((t) => (
            <span key={t} style={{
              fontSize: "0.625rem", padding: "0.125rem 0.375rem",
              borderRadius: "999px", background: "var(--bg)",
              color: "var(--text)", border: "1px solid var(--border)",
            }}>
              {t}
            </span>
          ))}
        </div>
        <p style={{
          fontSize: "0.6875rem", color: "var(--text-muted)", lineHeight: 1.45,
          marginTop: "0.375rem",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
          overflow: "hidden",
        } as React.CSSProperties}>
          {reason}
        </p>
      </div>
    </div>
  );
}
