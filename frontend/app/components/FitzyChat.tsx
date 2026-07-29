"use client";

// ─── FitzyChat ────────────────────────────────────────────────────────────────
// Reusable multi-turn chat UI for Fitzy.
// The PARENT owns message state and passes it down so the same thread can be
// shared between the home page (full-screen) and the catalog floating panel.
//
// Props:
//   messages      — current message array (read)
//   onSend        — called with (userText, updatedMessages) after user submits
//   loading       — true while waiting for AI response
//   mode          — "full" (home page) | "panel" (catalog floating panel)

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import catalog, { CatalogItem } from "../data/catalog";
import type { ChatMessage } from "../api/fitzy/route";

// ─── ItemMiniCard ─────────────────────────────────────────────────────────────
// Small inline card shown inside a chat bubble for search results.

function ItemMiniCard({
  item,
  onFitCheck,
}: {
  item: CatalogItem;
  onFitCheck?: (item: CatalogItem) => void;
}) {
  return (
    <div
      className="flex gap-2 rounded-xl overflow-hidden border"
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
    >
      <div className="relative flex-shrink-0" style={{ width: 52, height: 64 }}>
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="52px"
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="flex flex-col justify-center gap-0.5 py-2 pr-2 min-w-0">
        <p className="text-xs font-medium leading-snug truncate" style={{ color: "var(--text)" }}>
          {item.name}
        </p>
        <p className="text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>
          {item.color}
        </p>
        {onFitCheck && (
          <button
            onClick={() => onFitCheck(item)}
            className="mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-md focus:outline-none"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            Check Fit
          </button>
        )}
      </div>
    </div>
  );
}

// ─── TypingDots ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: "var(--text-muted)",
            opacity: 0.5,
            animation: `fitzy-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes fitzy-dot {
          0%, 80%, 100% { transform: scale(1); opacity: 0.5; }
          40%            { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FitzyChatMessage = ChatMessage & {
  // present on assistant messages of type "search"
  itemIds?: string[];
};

export type { ChatMessage };

// ─── FitzyChat ────────────────────────────────────────────────────────────────

export default function FitzyChat({
  messages,
  onSend,
  loading,
  mode = "full",
  onFitCheck,
  placeholder = "Ask Fitzy anything…",
}: {
  messages: FitzyChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  mode?: "full" | "panel";
  onFitCheck?: (item: CatalogItem) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft.trim() || loading) return;
    onSend(draft.trim());
    setDraft("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const isPanel = mode === "panel";
  const threadHeight = isPanel ? "h-56" : "flex-1 min-h-0";

  return (
    <div className="flex flex-col h-full">
      {/* ── Thread ── */}
      <div
        className={`${threadHeight} overflow-y-auto px-3 py-3 flex flex-col gap-3`}
        style={{ scrollbarWidth: "thin" }}
      >
        {messages.length === 0 && !loading && (
          <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
            Ask Fitzy what you&apos;re looking for
          </p>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";

          // Resolve item cards for search messages
          const cards: CatalogItem[] =
            !isUser && msg.itemIds
              ? (msg.itemIds
                  .map((id) => catalog.find((c) => c.id === id))
                  .filter(Boolean) as CatalogItem[])
              : [];

          return (
            <div key={i} className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
              {/* Bubble */}
              <div
                className="max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
                style={
                  isUser
                    ? { background: "var(--text)", color: "var(--bg)", borderRadius: "18px 18px 4px 18px" }
                    : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "18px 18px 18px 4px" }
                }
              >
                {msg.content}
              </div>

              {/* Inline item cards for search results */}
              {cards.length > 0 && (
                <div className="flex flex-col gap-1.5 w-full max-w-[85%]">
                  {cards.map((item) => (
                    <ItemMiniCard key={item.id} item={item} onFitCheck={onFitCheck} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-start">
            <div
              className="rounded-2xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "18px 18px 18px 4px" }}
            >
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div
        className="flex-shrink-0 px-3 py-2 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            className="flex-1 px-3 py-2 text-xs rounded-lg border focus:outline-none disabled:opacity-50"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          <button
            type="submit"
            disabled={!draft.trim() || loading}
            className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-lg focus:outline-none focus-visible:ring-2 disabled:opacity-40 transition-colors"
            style={{ background: "var(--accent)", color: "var(--accent-text)", border: "1.5px solid var(--accent)" }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
