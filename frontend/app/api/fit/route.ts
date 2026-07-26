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
  recommendations: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
};

// ─── Size chart resolution ────────────────────────────────────────────────────
// Placeholder entries — replace/extend when real catalog JSON is ready.
// Items in the catalog can also carry measurements directly (no sizeChartRef needed).

const SIZE_CHARTS: Record<string, GarmentMeasurements> = {
  "size-chart-top-xs":    { shoulderWidth: 38, chest: 88,  waist: 74,  length: 68 },
  "size-chart-top-s":     { shoulderWidth: 40, chest: 94,  waist: 80,  length: 70 },
  "size-chart-top-m":     { shoulderWidth: 44, chest: 102, waist: 88,  length: 72 },
  "size-chart-top-l":     { shoulderWidth: 47, chest: 110, waist: 96,  length: 74 },
  "size-chart-top-xl":    { shoulderWidth: 50, chest: 118, waist: 104, length: 76 },
  "size-chart-bottom-xs": { waist: 68, hip: 90,  inseam: 74 },
  "size-chart-bottom-s":  { waist: 76, hip: 98,  inseam: 76 },
  "size-chart-bottom-m":  { waist: 84, hip: 106, inseam: 78 },
  "size-chart-bottom-l":  { waist: 92, hip: 114, inseam: 79 },
  "size-chart-bottom-xl": { waist: 100, hip: 122, inseam: 80 },
};

function resolveItemMeasurements(item: CatalogItem): GarmentMeasurements {
  if (item.measurements && Object.keys(item.measurements).length > 0) {
    return item.measurements;
  }
  if (item.sizeChartRef && SIZE_CHARTS[item.sizeChartRef]) {
    return SIZE_CHARTS[item.sizeChartRef];
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

  let parsed: FitOutput;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[/api/fit] JSON parse failed. Raw:", rawResponse);
    return NextResponse.json(
      { error: "AI service returned malformed JSON." },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed);
}
