import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CatalogItem = {
  id: string;
  name: string;
  category: string;
  color: string;
  styleTags: string[];
  sizeChartRef?: string;
  measurements?: GarmentMeasurements;
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

  const garmentLines =
    Object.entries(garmentM)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `  ${k}: ${v} cm`)
      .join("\n") || "  (no garment measurements available)";

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
    : `Compare the garment measurements to the user's body measurements.
Write purely factual, descriptive sentences. State exact differences in centimetres.
Do NOT use words like "good", "bad", "too small", "too big", "fits well", or any evaluative judgment.
Example of correct style: "This item's chest measurement is 4 cm larger than yours. The shoulder width matches your measurement closely."

User body measurements:
  height: ${userM.height} cm
  shoulderWidth: ${userM.shoulderWidth} cm
  chest: ${userM.chest} cm
  waist: ${userM.waist} cm
  hip: ${userM.hip} cm
  inseam: ${userM.inseam} cm

Selected garment measurements:
${garmentLines}

Put your factual comparison in the "fitDescription" field.`;

  return `You are a factual clothing fit assistant. You must respond with ONLY a JSON object — no prose, no markdown fences, no text before or after the JSON.

TASK:
${fitBlock}

Recommend exactly 2 or 3 complementary catalog items that pair well with the selected item.
Base recommendations on COLOR and STYLE compatibility with the selected item.
Explain concretely why each pairing works (colour contrast, style match, etc.).
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
    { "id": "<id>", "name": "<name>", "reason": "<why it pairs well>" },
    { "id": "<id>", "name": "<name>", "reason": "<why it pairs well>" }
  ]
}`;
}

// ─── AI model call (isolated — swap internals here to change provider) ────────

async function callAIModel(prompt: string): Promise<string> {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN is not set in environment.");

  const client = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: token,
  });

  const completion = await client.chat.completions.create({
    model: "google/gemma-4-31B-it:novita",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 700,
    temperature: 0,
  });

  const content = completion.choices[0]?.message?.content ?? "";
  if (!content) throw new Error("Model returned an empty response.");
  return content;
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
