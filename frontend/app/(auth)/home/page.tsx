"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import AccountDropdown from "../../components/AccountDropdown";
import FitCheckLandingShell from "../../components/FitCheckLandingShell";
import type { FitzyChatMessage } from "../../components/FitzyChat";
import type { FitzyOutput } from "../../api/fitzy/route";
import catalog from "../../data/catalog";

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [gender, setGender] = useState<"all" | "men" | "women">("all");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<FitzyChatMessage[]>([]);
  const [fitzyLoading, setFitzyLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, gender")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.gender === "men" || profile?.gender === "women") setGender(profile.gender);
      setReady(true);
    }
    void init();
  }, [router, supabase]);

  const filteredCatalog = useMemo(
    () => (gender === "all" ? catalog : catalog.filter((item) => item.gender === gender)),
    [gender],
  );

  async function handleSend(text: string) {
    const userMessage: FitzyChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setFitzyLoading(true);
    try {
      const response = await fetch("/api/fitzy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content }) => ({ role, content })), catalog: filteredCatalog }),
      });
      const result = await response.json().catch(() => ({ error: "Fitzy's having trouble right now — try again." }));
      if (!response.ok) throw new Error(result.error);
      const data = result as FitzyOutput;
      const assistantMessage: FitzyChatMessage = data.type === "search"
        ? { role: "assistant", content: data.reply, itemIds: data.itemIds }
        : { role: "assistant", content: data.reply };
      if (data.type === "search") {
        sessionStorage.setItem("fitzy_context", JSON.stringify({ reply: data.reply, itemIds: data.itemIds, query: text, messages: [...nextMessages, assistantMessage] }));
        router.push("/catalog");
      } else setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Fitzy's having trouble right now — try again." }]);
    } finally {
      setFitzyLoading(false);
    }
  }

  function handlePrompt(prompt: string) {
    setDraft("");
    void handleSend(prompt);
  }

  if (!ready) return null;
  return (
    <FitCheckLandingShell
      navAction={<AccountDropdown />}
      subheading={`Hey, ${displayName ?? "there"} — let's find your next fit.`}
      inputValue={draft}
      onInputChange={setDraft}
      onAsk={handleSend}
      onPrompt={handlePrompt}
      onWardrobe={() => router.push("/wardrobe")}
      onPickMatch={() => router.push("/pick-match")}
      onSaved={() => router.push("/saved")}
      loading={fitzyLoading}
      messages={messages}
    />
  );
}
