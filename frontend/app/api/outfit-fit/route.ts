import { NextRequest, NextResponse } from "next/server";
import { callAIModel } from "../../lib/ai";

// ─── Types ────────────────────────────────────────────────────────────────────

type OutfitItem = {
  id: string;
  name: string;
  category: string;   // "top" | "bottom" | "outerwear" | "shoe"
  color: string;
  styleTags: string[];
  sizes?: string;
};

// Compact catalog entry sent from the client for swap candidate selection.
type CatalogEntry = {
  id: string;
  name: string;
  category: string;
  color: string;
  styleTags: string[];
};

export type OutfitFitInput = {
  userMeasurements: {
    height: number;
    shoulderWidth: number;
    chest: number;
    waist: number;
    hip: number;
    inseam: number;
  };
  items: OutfitItem[];        // whichever slots are filled; 1–4 items
  catalog: CatalogEntry[];    // full catalog minus the selected items, for swap selection
};

export type SuggestedSwap = {
  slot: "top" | "bottom" | "outerwear" | "shoe";
  itemId: string;
  reason: string;
};

export type OutfitFitOutput = {
  review: string;
  suggestedSwap: SuggestedSwap | null;
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  userM: OutfitFitInput["userMeasurements"],
  items: OutfitItem[],
  swapCandidates: CatalogEntry[],
): string {
  const itemLines = items.map((it) => {
    const sizeNote = it.sizes
      ? `\n    Available sizes: ${it.sizes}`
      : "";
    return (
      `  - ${it.category.toUpperCase()} [id:${it.id}]: ${it.name}\n` +
      `    Color: ${it.color} | Style tags: ${it.styleTags.join(", ")}${sizeNote}`
    );
  }).join("\n");

  // Determine which categories are present so the prompt stays honest.
  const hasTop       = items.some((i) => i.category === "top");
  const hasBottom    = items.some((i) => i.category === "bottom");
  const hasOuterwear = items.some((i) => i.category === "outerwear");
  const hasShoe      = items.some((i) => i.category === "shoe");

  const fitNote = (hasTop || hasBottom || hasOuterwear)
    ? `Where meaningfully relevant, mention a specific fit observation based on the user's measurements:
  height: ${userM.height} cm | shoulderWidth: ${userM.shoulderWidth} cm | chest: ${userM.chest} cm
  waist: ${userM.waist} cm | hip: ${userM.hip} cm | inseam: ${userM.inseam} cm
Only bring up a measurement if it actually affects how the outfit reads (e.g. a long inseam on wide-leg trousers, chest on a structured blazer).
On body fit, stay purely descriptive — state the difference in centimetres or note the size range. Do NOT say "too small", "too big", "fits well", or any other verdict about the user's body.
Do NOT comment on shoe fit.`
    : `No garment measurements are relevant here. Focus on style only.`;

  const omitNote = [
    !hasTop       && "No top is selected — do not mention a missing top.",
    !hasBottom    && "No bottom is selected — do not mention a missing bottom.",
    !hasOuterwear && "No outerwear is selected — do not mention a missing outerwear layer.",
    !hasShoe      && "No shoes are selected — do not mention missing shoes.",
  ].filter(Boolean).join(" ");

  // Build a compact list of swap candidates grouped by category for the AI to choose from.
  const candidateLines = swapCandidates
    .map((c) => `  id:${c.id} | ${c.category} | ${c.name} | ${c.color} | ${c.styleTags.join(", ")}`)
    .join("\n");

  return `You are an opinionated personal stylist with a sharp eye and a direct voice. You must respond with ONLY a JSON object — no prose, no markdown fences, no text before or after the JSON.

TASK:
Write a single outfit review (one flowing paragraph, 80–130 words) for the combination of items below.
Speak like a knowledgeable friend — confident, specific, honest. Do not hedge or give empty praise.

Your review MUST cover all three of these in one unbroken paragraph:

1. COLOR & TONE — Explain specifically WHY the palette works or where it creates tension.
   Don't just name the tones. Say what effect the combination creates, e.g. "the raw-denim blue
   pulls the warmth out of the beige" or "olive and black are both low-chroma, so the outfit
   reads as flat without anything to break the monotone." If colors clash or compete, say so directly.

2. STYLE COHESION — Assess whether the style registers across all pieces are compatible.
   If they are, explain why the combination holds together. If there is a mismatch — e.g. a
   relaxed streetwear jacket over a formal shirt — call it out plainly and explain why it creates
   friction rather than contrast.

3. CONCRETE SUGGESTION — End with one specific, actionable swap that would improve the outfit.
   Reference the actual item you're suggesting swapping OUT (use its name or color).
   The suggestion should be precise: not "try a lighter top" but "swapping the [item name] for
   something in cream or off-white would break the all-dark palette and lift the combination."

RULES:
- ONE paragraph only — no bullet points, no item-by-item breakdown, no labels like "Top:" or "Bottom:".
- Be direct about weaknesses. Avoid filler phrases like "this is a great look", "works well", "nice combination".
- ${omitNote}
- On body measurements only: stay purely descriptive (e.g. "the chest measurement is 6 cm larger than yours"). No verdicts like "too tight" or "fits perfectly".
- ${fitNote}

User's selected outfit:
${itemLines}

SWAP CANDIDATES — real catalog items you may suggest as a replacement.
If your suggestion maps to one of these, fill in "suggestedSwap". If not, set it to null.
You must ONLY use an id from this list — do not invent ids.
${candidateLines}

Respond with ONLY this exact JSON shape:
{
  "review": "<single paragraph review, 80–130 words>",
  "suggestedSwap": {
    "slot": "<the category being replaced: top | bottom | outerwear | shoe>",
    "itemId": "<id from the swap candidates list above>",
    "reason": "<one sentence: why this specific item improves the outfit>"
  }
}
OR if no swap from the list fits well:
{
  "review": "<single paragraph review, 80–130 words>",
  "suggestedSwap": null
}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: OutfitFitInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { userMeasurements, items, catalog } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "items must be a non-empty array." },
      { status: 400 },
    );
  }

  // Build swap candidates: catalog items not already selected, capped per category
  // to keep the prompt concise (max 8 per relevant slot).
  const selectedIds = new Set(items.map((i) => i.id));
  const selectedCategories = new Set(items.map((i) => i.category));
  const countPerCat: Record<string, number> = {};
  const swapCandidates: CatalogEntry[] = (catalog ?? []).filter((c) => {
    if (selectedIds.has(c.id)) return false;
    if (!selectedCategories.has(c.category)) return false;
    countPerCat[c.category] = (countPerCat[c.category] ?? 0) + 1;
    return countPerCat[c.category] <= 8;
  });

  const prompt = buildPrompt(userMeasurements, items, swapCandidates);

  let rawResponse: string;
  try {
    rawResponse = await callAIModel(prompt, { temperature: 0.7, max_tokens: 1100 });
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("[/api/outfit-fit] model call failed:", err.message);

    if (err.status === 429) {
      return NextResponse.json(
        { error: "Too many requests — please wait a moment and try again." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "AI service unavailable — please try again shortly." },
      { status: 502 },
    );
  }

  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[/api/outfit-fit] no JSON in response:", rawResponse);
    return NextResponse.json(
      { error: "AI service returned an unexpected response format." },
      { status: 502 },
    );
  }

  let parsed: OutfitFitOutput;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[/api/outfit-fit] JSON parse failed:", rawResponse);
    return NextResponse.json(
      { error: "AI service returned malformed JSON." },
      { status: 502 },
    );
  }

  if (typeof parsed.review !== "string" || !parsed.review.trim()) {
    console.error("[/api/outfit-fit] review missing or empty:", parsed);
    return NextResponse.json(
      { error: "AI service returned an incomplete response." },
      { status: 502 },
    );
  }

  // Validate suggestedSwap: null is fine; anything else must reference a real candidate id.
  if (parsed.suggestedSwap !== null && parsed.suggestedSwap !== undefined) {
    const swap = parsed.suggestedSwap;
    const validId = swapCandidates.some((c) => c.id === swap.itemId);
    if (!validId) {
      // AI hallucinated an id — drop the swap rather than surface a broken card.
      console.warn("[/api/outfit-fit] suggestedSwap itemId not in candidates, dropping:", swap.itemId);
      parsed = { ...parsed, suggestedSwap: null };
    }
  } else {
    // Normalise undefined → null so the client type is always consistent.
    parsed = { ...parsed, suggestedSwap: null };
  }

  return NextResponse.json(parsed);
}
