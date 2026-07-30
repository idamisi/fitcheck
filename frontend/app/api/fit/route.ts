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
      : "  (no garment measurements available — skip numeric comparisons)";

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

  const fitBlock = isShoe
    ? `The selected item is a shoe. Do NOT write fit comparison language — shoes have no comparable body measurement.
Set "fitDescription" to null in your JSON response.`
    : `Compare the garment data to the user's body measurements.
If exact cm measurements are available, state exact differences in centimetres.
If only size/dimension text is available, use it to give a practical sizing observation.
Write purely factual, descriptive sentences. Do NOT use evaluative words like "good", "bad", "too small", "too big", or "fits well".
Example (with measurements): "The chest measurement is 4 cm larger than yours. Shoulder width is within 1 cm."
Example (with size text): "This item is available in waist sizes 26W–54W. Based on your waist of ${userM.waist} cm, the closest size is approximately [relevant size]."

User body measurements:
  height: ${userM.height} cm
  shoulderWidth: ${userM.shoulderWidth} cm
  chest: ${userM.chest} cm
  waist: ${userM.waist} cm
  hip: ${userM.hip} cm
  inseam: ${userM.inseam} cm

Selected garment measurements/sizes:
${garmentLines}

Put your factual comparison in the "fitDescription" field.`;

  return `You are a factual clothing fit and styling assistant. You must respond with ONLY a JSON object — no prose, no markdown fences, no text before or after the JSON.

TASK:
${fitBlock}

Recommend exactly 2 or 3 complementary catalog items that pair well with the selected item.
For each recommendation, write a pairing reason that covers ALL THREE of the following angles — do not echo the style tags back as a sentence:
  1. COLOUR: Describe the actual colour relationship (e.g. "the navy creates a clean contrast against the beige", "both are earth tones that sit in the same tonal range", "the white provides a light top to balance the heavy dark bottom").
  2. SILHOUETTE: Comment on how the two cuts interact (e.g. "the slim-cut chino balances the relaxed fit of the hoodie", "wide-leg trousers work with the cropped length of this top").
  3. FORMALITY: Confirm the formality levels align or explain how to bridge them (e.g. "both sit in the smart-casual register", "the blazer slightly dresses up what is otherwise a casual pairing").
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
  "fitDescription": "<factual comparison text, or null for shoes>",
  "recommendations": [
    { "id": "<id>", "name": "<name>", "reason": "<colour relationship + silhouette interaction + formality match>" },
    { "id": "<id>", "name": "<name>", "reason": "<colour relationship + silhouette interaction + formality match>" }
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
  const prompt = buildPrompt(
    userMeasurements,
    selectedItem,
    garmentMeasurements,
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

  // Deterministic size recommendation — computed server-side, not by the AI
  const recommendedSize = recommendSize(selectedItem, userMeasurements);

  const response: FitOutput = { ...parsed, recommendedSize };
  return NextResponse.json(response);
}
