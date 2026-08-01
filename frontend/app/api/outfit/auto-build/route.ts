import { NextRequest, NextResponse } from "next/server";
import catalog, { type CatalogItem } from "../../../data/catalog";
import { callAIModel } from "../../../lib/ai";
import { createServerSupabaseClient } from "../../../lib/supabase-server";

type OutfitSlot = "top" | "bottom" | "outerwear" | "shoe";

type AutoBuildInput = {
  anchor: {
    category: OutfitSlot;
    color: string;
    styleTags: string[];
    description?: string;
  };
  emptySlots: OutfitSlot[];
};

type AutoBuildOutput = { itemIds: string[] };

const SLOTS: OutfitSlot[] = ["top", "bottom", "outerwear", "shoe"];

export async function POST(req: NextRequest) {
  let body: AutoBuildInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { anchor, emptySlots } = body;
  if (!anchor || !SLOTS.includes(anchor.category) || !Array.isArray(emptySlots)) {
    return NextResponse.json({ error: "A valid anchor and empty slots are required." }, { status: 400 });
  }

  const requestedSlots = [...new Set(emptySlots)].filter((slot): slot is OutfitSlot => SLOTS.includes(slot));
  if (requestedSlots.length === 0) return NextResponse.json({ itemIds: [] });

  // Cap each category just as the existing outfit-fit route caps swap choices:
  // the model chooses only from real, manageable catalog candidates.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("gender").eq("id", user.id).maybeSingle()
    : { data: null };
  const gender = profile?.gender === "men" || profile?.gender === "women" ? profile.gender : null;
  const candidates = requestedSlots.flatMap((slot) =>
    catalog.filter((item) => item.category === slot && (!gender || item.gender === gender)).slice(0, 16),
  );

  const candidateLines = candidates
    .map((item) => `id:${item.id} | ${item.category} | ${item.name} | ${item.color} | ${item.styleTags.join(", ")}`)
    .join("\n");

  const description = anchor.description ? `\nDescription: ${anchor.description}` : "";
  const prompt = `You are Fitzy, a precise personal stylist. Build complementary additions around one anchor item.

ANCHOR:
Category: ${anchor.category}
Color: ${anchor.color}
Style tags: ${anchor.styleTags.join(", ")}${description}

Fill exactly one item for each requested empty slot: ${requestedSlots.join(", ")}.
Choose items that complement the anchor's color and style; do not choose the anchor category.
You may ONLY use IDs from the catalog candidates below. Return ONLY valid JSON:
{ "itemIds": ["one ID per requested slot"] }

CATALOG CANDIDATES:
${candidateLines}`;

  let raw: string;
  try {
    raw = await callAIModel(prompt, { temperature: 0.3, max_tokens: 300 });
  } catch (error) {
    const err = error as Error & { status?: number };
    console.error("[/api/outfit/auto-build] model call failed:", err.message);
    return NextResponse.json(
      { error: err.status === 429 ? "Too many requests — please wait a moment and try again." : "Fitzy is unavailable — please try again shortly." },
      { status: err.status === 429 ? 429 : 502 },
    );
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({ error: "Fitzy returned an unexpected response." }, { status: 502 });

  let parsed: AutoBuildOutput;
  try {
    parsed = JSON.parse(match[0]) as AutoBuildOutput;
  } catch {
    return NextResponse.json({ error: "Fitzy returned malformed recommendations." }, { status: 502 });
  }

  if (!Array.isArray(parsed.itemIds)) {
    return NextResponse.json({ error: "Fitzy returned incomplete recommendations." }, { status: 502 });
  }

  const selected: CatalogItem[] = [];
  for (const slot of requestedSlots) {
    const item = parsed.itemIds
      .map((id) => candidates.find((candidate) => candidate.id === id))
      .find((candidate) => candidate?.category === slot);
    if (item && !selected.some((selectedItem) => selectedItem.id === item.id)) selected.push(item);
  }

  if (selected.length !== requestedSlots.length) {
    return NextResponse.json({ error: "Fitzy returned incomplete recommendations. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ items: selected });
}
