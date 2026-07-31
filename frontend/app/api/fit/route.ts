import { NextRequest, NextResponse } from "next/server";
import { callAIModel } from "../../lib/ai";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CatalogItem = {
  id: string;
  name: string;
  category: string;
  gender?: string;
  color: string;
  styleTags: string[];
  imageUrl?: string;
  sizeChartRef?: string;
  measurements?: GarmentMeasurements;
  sizes?: string;
  price?: number;
  currency?: string;
  brand?: string;
  productUrl?: string;
};

type GarmentMeasurements = {
  shoulderWidth?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  inseam?: number;
  length?: number;
};

export type FitInput = {
  userMeasurements: {
    height: number;
    shoulderWidth: number;
    chest: number;
    waist: number;
    hip: number;
    inseam: number;
  };
  selectedItemId: string;
  catalog: CatalogItem[];
  activeFilters?: {
    category?: string;
    color?: string;
    style?: string;
  };
};

export type FitOutput = {
  fitDescription: string | null;
  recommendedSize: string | null;
  recommendations: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
};

// ─── Size chart families ──────────────────────────────────────────────────────
// Each family maps a size label to the garment's body-measurement equivalents
// (i.e. the body measurements that label is designed to fit, in centimetres).
// Category-relevant fields only — tops/outerwear use chest + shoulderWidth,
// bottoms use waist + hip + inseam, shoes use footSize (UK).

type SizeEntry = {
  label: string;           // "S" | "M" | "L" | "XL"
  measurements: GarmentMeasurements & { footSize?: number };
};

const SIZE_CHART_FAMILIES: Record<string, SizeEntry[]> = {
  // ── Men's tops / outerwear ──────────────────────────────────────────────────
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
  // ── Women's tops / outerwear ────────────────────────────────────────────────
  womens_tops_regular: [
    { label: "S",  measurements: { shoulderWidth: 38, chest:  86 } },
    { label: "M",  measurements: { shoulderWidth: 40, chest:  94 } },
    { label: "L",  measurements: { shoulderWidth: 42, chest: 102 } },
    { label: "XL", measurements: { shoulderWidth: 44, chest: 110 } },
  ],
  // ── Men's bottoms ───────────────────────────────────────────────────────────
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
  // ── Women's bottoms ─────────────────────────────────────────────────────────
  womens_bottoms_regular: [
    { label: "S",  measurements: { waist:  68, hip:  92, inseam: 78 } },
    { label: "M",  measurements: { waist:  76, hip: 100, inseam: 79 } },
    { label: "L",  measurements: { waist:  84, hip: 108, inseam: 80 } },
    { label: "XL", measurements: { waist:  92, hip: 116, inseam: 80 } },
  ],
};

// ─── Size recommendation ──────────────────────────────────────────────────────
// Returns the closest available size label, or null if no chart/sizes data
// is available. "Available" means the size must appear in item.sizes (when
// present); otherwise all entries in the family are considered available.

function parseSizesField(sizes: string | undefined): Set<string> | null {
  if (!sizes) return null;
  // Normalise to upper-case and extract size tokens like S, M, L, XL, XXL …
  const tokens = sizes.toUpperCase().match(/\bX{0,3}[SML]\b|\bX{1,3}L\b/g);
  return tokens ? new Set(tokens) : null;
}

function recommendSize(
  item: CatalogItem,
  userM: FitInput["userMeasurements"],
): string | null {
  const chart = item.sizeChartRef ? SIZE_CHART_FAMILIES[item.sizeChartRef] : null;
  if (!chart || chart.length === 0) return null;

  // Determine which size labels are actually offered by this specific item.
  // If item.sizes is absent, treat all chart entries as available.
  const availableSet = parseSizesField(item.sizes);
  const available = availableSet
    ? chart.filter((e) => availableSet.has(e.label.toUpperCase()))
    : chart;

  if (available.length === 0) return null;

  const cat = item.category.toLowerCase();

  // Select which measurement keys to compare based on category.
  type MKey = "chest" | "shoulderWidth" | "waist" | "hip" | "inseam";
  const keys: MKey[] =
    cat === "top" || cat === "outerwear"
      ? ["chest", "shoulderWidth"]
      : cat === "bottom"
        ? ["waist", "hip", "inseam"]
        : []; // shoe — no body measurement comparison

  if (keys.length === 0) return null;

  // Score each available entry by sum of squared differences on relevant keys.
  let best: SizeEntry | null = null;
  let bestScore = Infinity;

  for (const entry of available) {
    let score = 0;
    let counted = 0;
    for (const k of keys) {
      const garmentVal = entry.measurements[k];
      const userVal = userM[k as keyof typeof userM] as number | undefined;
      if (garmentVal == null || !userVal) continue;
      const diff = garmentVal - userVal;
      score += diff * diff;
      counted++;
    }
    // Skip entries where we had no usable data
    if (counted === 0) continue;
    if (score < bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best ? best.label : null;
}

function resolveItemMeasurements(item: CatalogItem): GarmentMeasurements {
  if (item.measurements && Object.keys(item.measurements).length > 0) {
    return item.measurements;
  }
  // Fall back to the medium-size entry from the family as a representative garment measurement
  const family = item.sizeChartRef ? SIZE_CHART_FAMILIES[item.sizeChartRef] : null;
  if (family) {
    const mid = family[Math.floor(family.length / 2)];
    if (mid) return mid.measurements;
  }
  return {};
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  userM: FitInput["userMeasurements"],
  item: CatalogItem,
  garmentM: GarmentMeasurements,
  recommendedSize: string | null,
  catalog: CatalogItem[],
  activeFilters: FitInput["activeFilters"],
): string {
  const isShoe = item.category.toLowerCase() === "shoe";

  // Build garment measurement block — prefer resolved chart data, fall back to sizes string
  const chartLines = Object.entries(garmentM)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `  ${k}: ${v} cm`)
    .join("\n");

  const garmentLines = chartLines
    ? chartLines
    : item.sizes
      ? `  Available sizes/dimensions: ${item.sizes}`
      : "  (no garment measurements available — use general garment-type conventions)";

  const filterNote =
    activeFilters && Object.values(activeFilters).some(Boolean)
      ? `Active filters the user has applied: ${JSON.stringify(activeFilters)}. Only recommend items that match ALL active filters.`
      : "No active filters — recommend freely from the catalog.";

  const catalogSummary = catalog
    .filter((c) => c.id !== item.id)
    .slice(0, 40)
    .map(
      (c) =>
        `id: ${c.id} | name: ${c.name} | category: ${c.category} | color: ${c.color} | style: ${c.styleTags.join(", ")}`,
    )
    .join("\n");

  const sizeContext = recommendedSize
    ? `The server has already determined that size ${recommendedSize} is the closest match for this user's measurements against this item's size chart.`
    : `No size chart is available for this item.`;

  const fitBlock = isShoe
    ? `The selected item is a shoe. Do NOT write fit comparison language — shoes have no comparable body measurement.
Set "fitDescription" to null in your JSON response.`
    : (() => {
        const hasMeasurements = chartLines.length > 0;
        const hasSizesText = !!item.sizes;

        if (hasMeasurements) {
          return `SIZE & FIT ANALYSIS — write a single concise paragraph (2–4 sentences) in "fitDescription":

${sizeContext} Explain WHY that size is the best pick by describing the actual fit tradeoff in practical terms.
Be specific about the closest measurements: state exact cm differences for the key dimensions (chest, shoulder, waist, hip, or inseam — whichever apply to this garment type).
Then give the user one actionable nuance: e.g. "If you prefer a looser fit through the chest, size up to L" or "M will sit close to the body — true to size for this cut."

Do NOT use evaluative verdicts like "fits perfectly", "too tight", or "too big".
Stay descriptive: compare numbers, then reason about what that means in practice.

User body measurements:
  height: ${userM.height} cm | shoulderWidth: ${userM.shoulderWidth} cm | chest: ${userM.chest} cm
  waist: ${userM.waist} cm | hip: ${userM.hip} cm | inseam: ${userM.inseam} cm

Selected item's size chart data (medium/representative size):
${garmentLines}`;
        } else if (hasSizesText) {
          return `SIZE & FIT ANALYSIS — write a single concise paragraph (2–4 sentences) in "fitDescription":

No cm chart data is available for this item, but size options are: ${item.sizes}.
${sizeContext}
Based on general ${item.category} sizing conventions and the user's measurements (chest: ${userM.chest} cm, waist: ${userM.waist} cm, shoulder: ${userM.shoulderWidth} cm, inseam: ${userM.inseam} cm), reason through which size is most appropriate.
State your best size recommendation clearly, then give one practical tradeoff (e.g. size up if they prefer more room in the chest, stay at recommended size for a closer fit).`;
        } else {
          return `SIZE & FIT ANALYSIS — write a single concise paragraph (2–3 sentences) in "fitDescription":

No size chart or size data is available for this item. Use general ${item.category} sizing conventions.
Based on the user's measurements (chest: ${userM.chest} cm, shoulder: ${userM.shoulderWidth} cm, waist: ${userM.waist} cm), give your best reasoned size recommendation, clearly stating it's an estimate based on garment-type conventions.`;
        }
      })();

  return `You are a sharp, direct clothing fit and styling expert. You must respond with ONLY a JSON object — no prose, no markdown fences, no text before or after the JSON.

TASK — TWO PARTS:

PART 1 — FIT ANALYSIS:
${fitBlock}

PART 2 — STYLING RECOMMENDATIONS:
Recommend exactly 2 or 3 complementary catalog items that pair well with the selected item.
For each recommendation, write ONE flowing sentence that naturally covers all three angles — do not use labels or bullet points:
  • COLOUR: Describe the actual colour relationship with specificity. Don't just name tones — say what effect the pairing creates (e.g. "the raw-denim blue pulls the warmth out of the beige", "navy and black are both cool-dark and risk reading as a single block unless the textures contrast").
  • SILHOUETTE: How do the cuts interact? (e.g. "the slim chino cuts through the visual weight of the hoodie", "wide-leg trousers paired with this cropped top create a balanced proportion").
  • FORMALITY: Do the registers align, or does one item dress the other up/down? Be precise (e.g. "both land in the smart-casual band", "the blazer nudges this otherwise casual pairing a half-step up").
${filterNote}

Selected item:
  name: ${item.name}
  category: ${item.category}
  color: ${item.color}
  style tags: ${item.styleTags.join(", ")}

Available catalog items for recommendations:
${catalogSummary}

Respond with ONLY this exact JSON shape:
{
  "fitDescription": "<concise size & fit paragraph, or null for shoes>",
  "recommendations": [
    { "id": "<id>", "name": "<name>", "reason": "<one flowing sentence: colour effect + silhouette interaction + formality alignment>" },
    { "id": "<id>", "name": "<name>", "reason": "<one flowing sentence: colour effect + silhouette interaction + formality alignment>" }
  ]
}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: FitInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { userMeasurements, selectedItemId, catalog, activeFilters } = body;

  const selectedItem = catalog.find((c) => c.id === selectedItemId);
  if (!selectedItem) {
    return NextResponse.json(
      { error: `Item id "${selectedItemId}" not found in the provided catalog.` },
      { status: 400 },
    );
  }

  const garmentMeasurements = resolveItemMeasurements(selectedItem);
  // Compute size recommendation before building the prompt so the AI can reason about it
  const recommendedSize = recommendSize(selectedItem, userMeasurements);
  const prompt = buildPrompt(
    userMeasurements,
    selectedItem,
    garmentMeasurements,
    recommendedSize,
    catalog,
    activeFilters,
  );

  let rawResponse: string;
  try {
    rawResponse = await callAIModel(prompt);
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("[/api/fit] model call failed:", err.message);

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

  // Strip markdown fences if the model wraps the JSON in ```json ... ```
  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[/api/fit] model did not return valid JSON. Raw:", rawResponse);
    return NextResponse.json(
      { error: "AI service returned an unexpected response format." },
      { status: 502 },
    );
  }

  let parsed: Omit<FitOutput, "recommendedSize">;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[/api/fit] JSON parse failed. Raw:", rawResponse);
    return NextResponse.json(
      { error: "AI service returned malformed JSON." },
      { status: 502 },
    );
  }

  // recommendedSize already computed above — reuse it
  const response: FitOutput = { ...parsed, recommendedSize };
  return NextResponse.json(response);
}
