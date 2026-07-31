import { NextRequest, NextResponse } from "next/server";
import { callAIModel } from "../../lib/ai";

// ─── Size chart lookup (mirrors /api/fit — server-side recommendation) ────────

type SizeEntry = { label: string; measurements: Record<string, number> };

const SIZE_CHART_FAMILIES: Record<string, SizeEntry[]> = {
  mens_tops_regular: [
    { label: "S",  measurements: { shoulderWidth: 43, chest:  94 } },
    { label: "M",  measurements: { shoulderWidth: 45, chest: 100 } },
    { label: "L",  measurements: { shoulderWidth: 47, chest: 106 } },
    { label: "XL", measurements: { shoulderWidth: 50, chest: 114 } },
  ],
  hm_mens_tops_regular: [
    { label: "S",  measurements: { shoulderWidth: 43, chest:  94 } },
    { label: "M",  measurements: { shoulderWidth: 45, chest: 100 } },
    { label: "L",  measurements: { shoulderWidth: 47, chest: 106 } },
    { label: "XL", measurements: { shoulderWidth: 50, chest: 114 } },
  ],
  womens_tops_regular: [
    { label: "S",  measurements: { shoulderWidth: 38, chest:  86 } },
    { label: "M",  measurements: { shoulderWidth: 40, chest:  94 } },
    { label: "L",  measurements: { shoulderWidth: 42, chest: 102 } },
    { label: "XL", measurements: { shoulderWidth: 44, chest: 110 } },
  ],
  mens_bottoms_regular: [
    { label: "S",  measurements: { waist:  76, hip:  96, inseam: 79 } },
    { label: "M",  measurements: { waist:  84, hip: 104, inseam: 80 } },
    { label: "L",  measurements: { waist:  92, hip: 112, inseam: 81 } },
    { label: "XL", measurements: { waist: 100, hip: 120, inseam: 81 } },
  ],
  hm_mens_bottoms_regular: [
    { label: "S",  measurements: { waist:  76, hip:  96, inseam: 79 } },
    { label: "M",  measurements: { waist:  84, hip: 104, inseam: 80 } },
    { label: "L",  measurements: { waist:  92, hip: 112, inseam: 81 } },
    { label: "XL", measurements: { waist: 100, hip: 120, inseam: 81 } },
  ],
  womens_bottoms_regular: [
    { label: "S",  measurements: { waist:  68, hip:  92, inseam: 78 } },
    { label: "M",  measurements: { waist:  76, hip: 100, inseam: 79 } },
    { label: "L",  measurements: { waist:  84, hip: 108, inseam: 80 } },
    { label: "XL", measurements: { waist:  92, hip: 116, inseam: 80 } },
  ],
};

type UserM = OutfitFitInput["userMeasurements"];

function recommendSizeForItem(item: OutfitItem, userM: UserM): string | null {
  if (!item.sizeChartRef) return null;
  const chart = SIZE_CHART_FAMILIES[item.sizeChartRef];
  if (!chart || chart.length === 0) return null;

  const cat = item.category.toLowerCase();
  const keys: string[] =
    cat === "top" || cat === "outerwear" ? ["chest", "shoulderWidth"] :
    cat === "bottom"                     ? ["waist", "hip", "inseam"] : [];
  if (keys.length === 0) return null;

  let best: SizeEntry | null = null;
  let bestScore = Infinity;
  for (const entry of chart) {
    let score = 0; let counted = 0;
    for (const k of keys) {
      const gv = entry.measurements[k];
      const uv = userM[k as keyof UserM] as number | undefined;
      if (gv == null || !uv) continue;
      score += (gv - uv) ** 2; counted++;
    }
    if (counted === 0) continue;
    if (score < bestScore) { bestScore = score; best = entry; }
  }
  return best ? best.label : null;
}

// ─── Deterministic size line builder ─────────────────────────────────────────
// Produces one SizeRecommendationLine per item, always. For garments with a
// size chart this is exact; for items with a sizes-text string it reasons from
// the text; for shoes it gives a contextual note; for items with nothing it
// gives an honest best-guess based on garment-type conventions.

function computeSizeLines(
  items: OutfitItem[],
  userM: UserM,
): SizeRecommendationLine[] {
  return items.map((item): SizeRecommendationLine => {
    const cat = item.category.toLowerCase();
    const name = item.name;

    // ── Shoes: no body measurement — note sizes available and that's it ──────
    if (cat === "shoe") {
      const sizeNote = item.sizes
        ? `available in UK sizes ${item.sizes}`
        : "no size information available — check brand website";
      return { itemName: name, size: "See sizes", rationale: sizeNote };
    }

    // ── Garments with a full size chart ──────────────────────────────────────
    const chart = item.sizeChartRef ? SIZE_CHART_FAMILIES[item.sizeChartRef] : null;
    if (chart && chart.length > 0) {
      const keys: Array<keyof UserM> = cat === "bottom"
        ? ["waist", "hip", "inseam"]
        : ["chest", "shoulderWidth"];

      // Find closest size and the next size up for comparison
      let best: SizeEntry | null = null;
      let bestScore = Infinity;
      for (const entry of chart) {
        let score = 0; let counted = 0;
        for (const k of keys) {
          const gv = (entry.measurements as Record<string, number>)[k];
          const uv = userM[k] as number | undefined;
          if (gv == null || !uv) continue;
          score += (gv - uv) ** 2; counted++;
        }
        if (counted === 0) continue;
        if (score < bestScore) { bestScore = score; best = entry; }
      }

      if (!best) {
        return { itemName: name, size: "Unable to determine", rationale: "not enough measurement data in chart" };
      }

      // Build specific rationale from key measurement diffs
      const diffs = keys
        .map((k) => {
          const gv = (best!.measurements as Record<string, number>)[k];
          const uv = userM[k] as number | undefined;
          if (gv == null || !uv) return null;
          const diff = gv - uv;
          const label = k === "shoulderWidth" ? "shoulder" : k;
          if (Math.abs(diff) <= 1) return `${label} is within 1 cm (exact match)`;
          if (diff > 0) return `${label} is ${diff} cm wider than yours`;
          return `${label} is ${Math.abs(diff)} cm narrower than yours`;
        })
        .filter(Boolean)
        .join("; ");

      // Work out if there's a next size up available
      const bestIdx = chart.findIndex((e) => e.label === best!.label);
      const nextUp = chart[bestIdx + 1];
      const sizeUpHint = nextUp
        ? `size up to ${nextUp.label} for a more relaxed fit`
        : null;

      const rationale = diffs + (sizeUpHint ? ` — ${sizeUpHint}` : "");
      return { itemName: name, size: best.label, rationale };
    }

    // ── Garments with sizes text but no chart ─────────────────────────────────
    if (item.sizes) {
      // Try to infer a size label from the sizes text using user's measurements
      const primaryM = cat === "bottom" ? userM.waist : userM.chest;
      const sizesText = item.sizes;

      // Generic convention-based guess
      let guessedSize: string;
      if (cat === "bottom") {
        if (primaryM <= 78)       guessedSize = "S (waist ~76–78 cm)";
        else if (primaryM <= 86)  guessedSize = "M (waist ~82–86 cm)";
        else if (primaryM <= 94)  guessedSize = "L (waist ~90–94 cm)";
        else                      guessedSize = "XL (waist 95+ cm)";
      } else {
        if (primaryM <= 96)       guessedSize = "S (chest ~92–96 cm)";
        else if (primaryM <= 102) guessedSize = "M (chest ~98–102 cm)";
        else if (primaryM <= 108) guessedSize = "L (chest ~104–108 cm)";
        else                      guessedSize = "XL (chest 109+ cm)";
      }
      return {
        itemName: name,
        size: guessedSize,
        rationale: `estimated from general ${cat} sizing conventions — available: ${sizesText}`,
      };
    }

    // ── No data at all: honest best-guess from conventions ────────────────────
    const primaryM = cat === "bottom" ? userM.waist : userM.chest;
    let guessedSize: string;
    if (cat === "bottom") {
      if (primaryM <= 78)       guessedSize = "S";
      else if (primaryM <= 86)  guessedSize = "M";
      else if (primaryM <= 94)  guessedSize = "L";
      else                      guessedSize = "XL";
    } else {
      if (primaryM <= 96)       guessedSize = "S";
      else if (primaryM <= 102) guessedSize = "M";
      else if (primaryM <= 108) guessedSize = "L";
      else                      guessedSize = "XL";
    }
    return {
      itemName: name,
      size: guessedSize,
      rationale: `estimated from general ${cat} sizing conventions — no size chart available for this item`,
    };
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OutfitItem = {
  id: string;
  name: string;
  category: string;   // "top" | "bottom" | "outerwear" | "shoe"
  color: string;
  styleTags: string[];
  sizes?: string;
  sizeChartRef?: string;
  recommendedSize?: string | null;  // pre-computed server-side, passed to AI for richer reasoning
  isAnchor?: boolean;
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

export type SizeRecommendationLine = {
  itemName: string;
  size: string;      // e.g. "M", "L", "Size not determinable"
  rationale: string; // e.g. "chest measures 2 cm wider than yours — true to size"
};

export type OutfitFitOutput = {
  review: string;
  suggestedSwap: SuggestedSwap | null;
  sizeRecommendations: SizeRecommendationLine[];  // one entry per non-shoe item, always populated
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  userM: OutfitFitInput["userMeasurements"],
  items: OutfitItem[],
  swapCandidates: CatalogEntry[],
): string {
  const itemLines = items.map((it) => {
    const sizeNote = it.recommendedSize
      ? `\n    Recommended size for this user: ${it.recommendedSize}` +
        (it.sizes ? ` (available: ${it.sizes})` : "")
      : it.sizes
        ? `\n    Available sizes: ${it.sizes}`
        : "";
    return (
      `  - ${it.category.toUpperCase()}${it.isAnchor ? " (ANCHOR — KEEP THIS ITEM)" : ""} [id:${it.id}]: ${it.name}\n` +
      `    Color: ${it.color} | Style tags: ${it.styleTags.join(", ")}${sizeNote}`
    );
  }).join("\n");

  // Determine which categories are present so the prompt stays honest.
  const hasTop       = items.some((i) => i.category === "top");
  const hasBottom    = items.some((i) => i.category === "bottom");
  const hasOuterwear = items.some((i) => i.category === "outerwear");
  const hasShoe      = items.some((i) => i.category === "shoe");
  const anchorItems = items.filter((item) => item.isAnchor);
  const hasSwappableItem = items.some((item) => !item.isAnchor);
  const anchorNote = anchorItems.length > 0
    ? `\nANCHOR RULE: ${anchorItems.map((item) => `${item.name} (${item.category})`).join(", ")} is the user's anchor item. Never suggest replacing, swapping, or critiquing this item as the problem. Frame recommendations around it, such as explaining what pairs well with it.\n`
    : "";

  // Size guidance is now handled as a dedicated structured field — not by the AI prose.
  // The AI review focuses only on colour, style cohesion, and the swap suggestion.

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
Write a single outfit review (one flowing paragraph, 85–140 words) for the combination of items below.
Speak like a knowledgeable friend — confident, specific, honest. Do not hedge or give empty praise.

Your review MUST cover all three of these in one unbroken paragraph:

1. COLOR & TONE — Explain specifically WHY the palette works or where it creates tension.
   Don't just name the tones. Say what effect the combination creates, e.g. "the raw-denim blue
   pulls the warmth out of the beige" or "olive and black are both low-chroma, so the outfit
   reads as flat without anything to break the monotone." If colors clash or compete, say so directly.

2. STYLE COHESION — Assess whether the formality registers and silhouette proportions across all pieces
   are compatible. If they are, explain what makes the combination hold. If there is a mismatch —
   e.g. a relaxed streetwear jacket over a formal shirt, or a heavy sole under slim tailoring —
   call it out plainly and explain why it creates friction rather than contrast.

3. SIZE & SUGGESTION — ${hasSwappableItem ? "End with one specific, actionable swap that would improve a non-anchor item in the outfit." : "There is nothing else to swap: give general styling commentary and do not propose a replacement."}
   If any item has a recommended size listed above, work it in naturally (e.g. "grabbing a M here keeps the bomber fitted at the shoulder"). If no size data exists, skip size and focus on the style suggestion.
   The suggestion must be precise: not "try a lighter top" but "swapping the [item name] for
   something in cream or off-white would break the all-dark palette and lift the combination."

RULES:
- ONE paragraph only — no bullet points, no item-by-item breakdown, no labels like "Top:" or "Bottom:".
- Be direct about weaknesses. Avoid filler phrases like "this is a great look", "works well", "nice combination".
- ${omitNote}
- ${anchorNote}
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
  const anchorCategories = new Set(items.filter((i) => i.isAnchor).map((i) => i.category));
  const countPerCat: Record<string, number> = {};
  const swapCandidates: CatalogEntry[] = (catalog ?? []).filter((c) => {
    if (selectedIds.has(c.id)) return false;
    if (!selectedCategories.has(c.category)) return false;
    // Anchors are immutable: never offer a catalog replacement for their slot.
    if (anchorCategories.has(c.category)) return false;
    countPerCat[c.category] = (countPerCat[c.category] ?? 0) + 1;
    return countPerCat[c.category] <= 8;
  });

  // Compute deterministic size lines for every item — these never go through the AI
  const sizeRecommendations = computeSizeLines(items, userMeasurements);

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
    const candidate = swapCandidates.find((c) => c.id === swap.itemId);
    const validSwap = candidate && candidate.category === swap.slot && !anchorCategories.has(swap.slot);
    if (!validSwap) {
      // AI hallucinated an id — drop the swap rather than surface a broken card.
      console.warn("[/api/outfit-fit] suggestedSwap itemId not in candidates, dropping:", swap.itemId);
      parsed = { ...parsed, suggestedSwap: null };
    }
  } else {
    // Normalise undefined → null so the client type is always consistent.
    parsed = { ...parsed, suggestedSwap: null };
  }

  // Attach the server-computed size recommendations — guaranteed to cover every item
  const response: OutfitFitOutput = { ...parsed, sizeRecommendations };
  return NextResponse.json(response);
}
