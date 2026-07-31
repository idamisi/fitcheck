import { NextRequest, NextResponse } from "next/server";
import catalog, { type CatalogItem } from "../../../data/catalog";
import { callAIModel } from "../../../lib/ai";

type SuggestInput = {
  category: "top" | "bottom" | "outerwear" | "shoe";
  color: string;
  styleTags: string[];
  description?: string;
};

type SuggestOutput = { itemIds: string[] };

const CATEGORIES = ["top", "bottom", "outerwear", "shoe"] as const;

export async function POST(req: NextRequest) {
  let body: SuggestInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!CATEGORIES.includes(body.category) || !body.color || !Array.isArray(body.styleTags)) {
    return NextResponse.json({ error: "A valid wardrobe item is required." }, { status: 400 });
  }

  // Give Fitzy a balanced, real-catalog candidate set across categories other
  // than the owned item. This follows the ID-constrained recommendation pattern
  // used by outfit review and auto-build routes.
  const candidates = catalog.filter((item) => item.category !== body.category).slice(0, 48);
  const candidateLines = candidates
    .map((item) => `id:${item.id} | ${item.category} | ${item.name} | ${item.color} | ${item.styleTags.join(", ")}`)
    .join("\n");
  const description = body.description?.trim() ? `\nDescription: ${body.description.trim()}` : "";

  const prompt = `You are Fitzy, a precise personal stylist. Suggest 2 or 3 purchasable catalog items that complement this clothing item the user already owns.

USER'S OWN WARDROBE ITEM (already owned, not for sale):
Category: ${body.category}
Color: ${body.color}
Style tags: ${body.styleTags.join(", ")}${description}

Choose pieces with complementary color, proportion, and style. Do not return the same category as the owned item. You may ONLY choose IDs from the catalog below.
Respond ONLY with valid JSON: { "itemIds": ["id1", "id2"] }

CATALOG ITEMS (purchasable):
${candidateLines}`;

  let raw: string;
  try {
    raw = await callAIModel(prompt, { temperature: 0.3, max_tokens: 220 });
  } catch (error) {
    const err = error as Error & { status?: number };
    console.error("[/api/wardrobe/suggest] model call failed:", err.message);
    return NextResponse.json(
      { error: err.status === 429 ? "Too many requests — please wait a moment and try again." : "Fitzy is unavailable — please try again shortly." },
      { status: err.status === 429 ? 429 : 502 },
    );
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({ error: "Fitzy returned an unexpected response." }, { status: 502 });

  let parsed: SuggestOutput;
  try {
    parsed = JSON.parse(match[0]) as SuggestOutput;
  } catch {
    return NextResponse.json({ error: "Fitzy returned malformed suggestions." }, { status: 502 });
  }

  const items: CatalogItem[] = [...new Set(parsed.itemIds ?? [])]
    .map((id) => candidates.find((item) => item.id === id))
    .filter((item): item is CatalogItem => item !== undefined)
    .slice(0, 3);

  if (items.length < 2) {
    return NextResponse.json({ error: "Fitzy returned incomplete suggestions. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ items });
}
