import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../lib/supabase-server";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  gender?: string;
  color: string;
  styleTags: string[];
};

type WardrobeItem = {
  id: string;
  category: string;
  color: string;
  style_tags: string[];
  description: string | null;
  collection_name: string;
};

export type FitzyInput = {
  messages: ChatMessage[];   // full history, newest last
  catalog: CatalogItem[];
};

export type FitzyOutput =
  | { type: "search"; reply: string; itemIds: string[] }
  | { type: "chat";   reply: string };

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildSystemPrompt(catalog: CatalogItem[], wardrobeItems: WardrobeItem[]): string {
  const catalogSummary = catalog
    .map(
      (c) =>
        `id:${c.id} | ${c.name} | ${c.category} | ${c.gender ?? "any"} | ${c.color} | ${c.styleTags.join(",")}`,
    )
    .join("\n");
  const wardrobeSummary = wardrobeItems.length > 0
    ? wardrobeItems.map((item) =>
      `id:${item.id} | ${item.category} | ${item.color} | collection:${item.collection_name || "Unsorted"} | ${item.style_tags.join(",")}${item.description ? ` | ${item.description}` : ""}`,
    ).join("\n")
    : "(No wardrobe items uploaded.)";

  return `You are Fitzy, a friendly and direct personal style assistant inside FitCheck.

You have access to a clothing catalog. For every user message you must decide:

(A) SEARCH — the user is asking for clothing recommendations (e.g. "show me something casual", 
    "what would work for a dinner date", "something warmer", "recommend a jacket").
    → Return JSON: { "type": "search", "reply": "<your reasoning in 1-2 sentences>", "itemIds": ["id1","id2",...] }
    → Pick 2–8 catalog IDs that best match. Use conversation history for context (e.g. if they said 
      "something warmer" after a previous search, refine based on what you showed before).
    → reply should be Fitzy speaking naturally about the picks, e.g. "Here are some laid-back options 
      that'd work well for a casual evening."

(B) CHAT — the user is asking a follow-up question, giving feedback, or saying something that 
    does NOT require showing new items (e.g. "what fabric is that?", "nice", "I don't like blue", 
    "tell me more about the first one").
    → Return JSON: { "type": "chat", "reply": "<your conversational reply>" }

STRICT RULES:
- Respond with ONLY a JSON object. No markdown. No prose outside the JSON.
- For "search" type, itemIds must only contain IDs from the CATALOG ITEMS section below.
- For "chat" type, omit itemIds entirely.
- USER'S OWN WARDROBE ITEMS are already owned, never for sale. Only reference them when the user clearly asks about their own clothes (for example: "my jacket", "what I own", or "pair this with my..."). Do not proactively mention them for general outfit requests.
- When you do reference a wardrobe item, call it something the user owns; never imply they should buy it.
- Each owned item includes a free-text collection label. Answer direct questions about a named collection using only items with that label. If the user says to exclude a collection (for example, "don't suggest anything from my Riyadh collection"), honour that instruction for the current conversation only; it is not a permanent preference. Unless they give such an instruction, collections may be freely combined.
- Keep reply under 60 words.
- Be warm, direct, and specific. Never say "Great choice!" or filler phrases.

CATALOG ITEMS (purchasable):
${catalogSummary}

USER'S OWN WARDROBE ITEMS (already owned, not for sale):
${wardrobeSummary}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: FitzyInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { messages, catalog } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages must be a non-empty array." }, { status: 400 });
  }

  // RLS plus this explicit user filter ensures Fitzy only receives the current
  // user's own items. Missing auth or an empty wardrobe remains a normal flow.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  let wardrobeItems: WardrobeItem[] = [];
  if (user) {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("id, category, color, style_tags, description, collection_name")
      .eq("user_id", user.id);
    if (error) console.error("[/api/fitzy] wardrobe fetch failed:", error.message);
    else wardrobeItems = data ?? [];
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
  }

  // Cap history to last 10 messages to avoid runaway token usage
  const cappedMessages = messages.slice(-10);

  const client = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: token,
  });

  const systemPrompt = buildSystemPrompt(catalog, wardrobeItems);

  console.log("[/api/fitzy] history length:", cappedMessages.length);

  const fitzyMessages_param = [
    { role: "user" as const, content: systemPrompt + "\n\nNow begin the conversation." },
    { role: "assistant" as const, content: '{"type":"chat","reply":"Hey! What are you looking for today?"}' },
    ...cappedMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  async function callOnce(): Promise<string> {
    const completion = await client.chat.completions.create({
      model: "google/gemma-4-31B-it:novita",
      messages: fitzyMessages_param,
      max_tokens: 400,
      temperature: 0,
    });
    const content = completion.choices[0]?.message?.content ?? "";
    if (!content) throw new Error("Empty response from model.");
    return content;
  }

  let rawResponse: string;
  try {
    rawResponse = await callOnce();
  } catch (e) {
    const err = e as Error & { status?: number };
    // Single automatic retry only on 429 (rate limit), after a short back-off.
    if (err.status === 429) {
      try {
        await sleep(2500);
        rawResponse = await callOnce();
      } catch (e2) {
        const err2 = e2 as Error & { status?: number };
        console.error("[/api/fitzy] retry after 429 also failed:", err2.message);
        return NextResponse.json(
          { error: "Too many requests — please wait a moment and try again." },
          { status: 429 },
        );
      }
    } else {
      console.error("[/api/fitzy] model call failed:", err.message);
      return NextResponse.json(
        { error: "AI service unavailable — please try again shortly." },
        { status: 502 },
      );
    }
  }

  console.log("[/api/fitzy] raw response:", rawResponse);

  // Extract JSON from the response (model sometimes wraps in markdown fences)
  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[/api/fitzy] no JSON in response:", rawResponse);
    return NextResponse.json(
      { error: "Fitzy returned an unexpected format." },
      { status: 502 },
    );
  }

  let parsed: FitzyOutput;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[/api/fitzy] JSON parse failed:", rawResponse);
    return NextResponse.json(
      { error: "Fitzy returned malformed JSON." },
      { status: 502 },
    );
  }

  // Validate shape
  if (parsed.type !== "search" && parsed.type !== "chat") {
    return NextResponse.json({ error: "Unexpected response type from Fitzy." }, { status: 502 });
  }

  return NextResponse.json(parsed);
}
