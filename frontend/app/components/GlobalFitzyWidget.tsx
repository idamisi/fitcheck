"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import catalog from "../data/catalog";
import type { FitzyOutput } from "../api/fitzy/route";
import FitzyChat, { type FitzyChatMessage } from "./FitzyChat";
import { createClient } from "../lib/supabase";
import { useOutfit } from "../lib/outfit-context";

export default function GlobalFitzyWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { clearOutfit } = useOutfit();
  const [gender, setGender] = useState<"all" | "men" | "women">("all");
  const [messages, setMessages] = useState<FitzyChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    async function loadGender() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("gender")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.gender === "men" || profile?.gender === "women") setGender(profile.gender);
    }
    void loadGender();
  }, [supabase]);

  const availableCatalog = useMemo(
    () => (gender === "all" ? catalog : catalog.filter((item) => item.gender === gender)),
    [gender],
  );

  async function handleSend(text: string) {
    const userMessage: FitzyChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const response = await fetch("/api/fitzy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          catalog: availableCatalog,
        }),
      });
      const data = await response.json().catch(() => ({ error: "Fitzy's having trouble — try again." }));
      if (!response.ok) throw new Error(data.error || "Fitzy's having trouble — try again.");

      const result = data as FitzyOutput;
      const assistantMessage: FitzyChatMessage = result.type === "search"
        ? { role: "assistant", content: result.reply, itemIds: result.itemIds }
        : { role: "assistant", content: result.reply };

      if (result.type === "search") {
        clearOutfit();
        sessionStorage.setItem("fitzy_context", JSON.stringify({
          reply: result.reply,
          itemIds: result.itemIds,
          query: text,
          messages: [...nextMessages, assistantMessage],
        }));
        if (pathname === "/catalog") window.location.assign("/catalog");
        else router.push("/catalog");
        return;
      }

      setMessages((current) => [...current, assistantMessage]);
      if (!open) setUnread(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fitzy's having trouble — try again.";
      setMessages((current) => [...current, { role: "assistant", content: message }]);
      if (!open) setUnread(true);
    } finally {
      setLoading(false);
    }
  }

  // Home has the full Ask Fitzy experience built into its page.
  if (pathname === "/home") return null;

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "rgba(11,26,51,0.25)" }} onClick={() => setOpen(false)} />
          <section className="fixed bottom-20 right-4 z-50 flex h-[26rem] w-80 flex-col overflow-hidden rounded-2xl shadow-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} aria-label="Fitzy chat">
            <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>Fitzy</span>
              <button type="button" onClick={() => setOpen(false)} className="focus:outline-none focus-visible:ring-2" style={{ color: "var(--text-muted)" }} aria-label="Close Fitzy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <FitzyChat messages={messages} onSend={handleSend} loading={loading} mode="panel" placeholder="Ask Fitzy anything…" />
            </div>
          </section>
        </>
      )}

      <button
        type="button"
        onClick={() => { setOpen((value) => !value); setUnread(false); }}
        className="fitzy-fab fixed bottom-6 right-4 z-40 flex items-center gap-1 rounded-xl px-2.5 py-1.5 focus:outline-none focus-visible:ring-2"
        style={{ background: open ? "var(--text)" : "var(--accent)", color: open ? "var(--bg)" : "var(--accent-text)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
        aria-label={open ? "Close Fitzy" : "Open Fitzy"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        <span className="text-[11px] font-bold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.01em" }}>Fitzy</span>
        {unread && !open && <span className="absolute right-0 top-0 h-2 w-2 rounded-full border-2" style={{ background: "var(--danger)", borderColor: "var(--bg)", transform: "translate(35%, -35%)" }} aria-label="Unread message" />}
      </button>
    </>
  );
}
