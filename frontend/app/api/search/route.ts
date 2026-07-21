import { NextRequest, NextResponse } from "next/server";
import { callAIModel } from "../../lib/ai";

// ─── Types ────────────────────────────────────────────────────────────────────

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  gender?: string;
  color: string;
  styleTags: string[];
};

export type SearchInput = {
  query: string;
  catalog: CatalogItem[];
  activeFilters?: {
    category?: string;
    gender?: string;
    style?: string;
  };
};

// price field is included in the schema now so the contract is stable when
// real price data is added — it will always be null until then.
export type SearchMatch = {
  id: string;
  name: string;
  reason: string;
  price: number | null;
};

export type SearchOutput = {
  matches: SearchMatch[];
  note: string | null;
};

// ─── Budget detection ─────────────────────────────────────────────────────────
// Simple heuristic — look for currency symbols or words like "budget", "cheap",
// "under $X", "less than £X", "affordable". The prompt always includes the
// no-price-data instruction; this flag just controls whether we surface a note.

function mentionsBudget(query: string): boolean {
  return /\b(budget|cheap|afford|under\s*[\$£€]|[\$£€]\d|price|cost|inexpensive|expensive)\b/i.test(
    query,
  );
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSearchPrompt(
  query: string,
  catalog: CatalogItem[],
  activeFilters: SearchInput["activeFilters"],
): string {
  const filterNote =
    activeFilters && Object.values(activeFilters).some(Boolean)
      ? `The user has also applied manual filters: ${JSON.stringify(activeFilters)}. Only return items that match ALL of these filters.`
      : "No manual filters are active — search the full catalog.";

  const catalogSummary = catalog
    .map(
      (c) =>
        `id: ${c.id} | name: ${c.name} | category: ${c.category} | gender: ${c.gender ?? "unspecified"} | color: ${c.color} | style: ${c.styleTags.join(", ")}`,
    )
    .join("\n");

  return `You are a clothing search assistant. You must respond with ONLY a JSON object — no prose, no markdown fences, no text before or after the JSON.

TASK:
The user has described what they are looking for in free text. Interpret their intent — consider style, occasion, category signals, color preferences, gender, and any vibe they describe.
Return the best matching items from the catalog, ranked by relevance. Return between 2 and 8 matches.
For each match, write a short, concrete reason explaining why it fits the user's request (1–2 sentences).

IMPORTANT — PRICE DATA:
Item prices are not currently available in this catalog. Do NOT attempt to filter or reason about price. Ignore any budget mentioned in the query entirely — match on style, category, and occasion only.

${filterNote}

User query: "${query}"

Catalog items to search:
${catalogSummary}

Respond with ONLY this exact JSON shape:
{
  "matches": [
    { "id": "<id>", "name": "<name>", "reason": "<why it matches the query>", "price": null },
    { "id": "<id>", "name": "<name>", "reason": "<why it matches the query>", "price": null }
  ]
}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: SearchInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { query, catalog, activeFilters } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "query must be a non-empty string." }, { status: 400 });
  }

  const hasBudget = mentionsBudget(query);
  const prompt = buildSearchPrompt(query.trim(), catalog, activeFilters);

  // Log the prompt so it can be inspected during development / test
  console.log("[/api/search] prompt sent to model:\n", prompt);

  let rawResponse: string;
  try {
    rawResponse = await callAIModel(prompt);
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("[/api/search] model call failed:", err.message);

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

  console.log("[/api/search] raw model response:\n", rawResponse);

  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[/api/search] model did not return valid JSON. Raw:", rawResponse);
    return NextResponse.json(
      { error: "AI service returned an unexpected response format." },
      { status: 502 },
    );
  }

  let parsed: SearchOutput;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[/api/search] JSON parse failed. Raw:", rawResponse);
    return NextResponse.json(
      { error: "AI service returned malformed JSON." },
      { status: 502 },
    );
  }

  // Attach budget note if the query mentioned price
  const result: SearchOutput = {
    matches: parsed.matches ?? [],
    note: hasBudget
      ? "Budget noted — price data isn't available yet, so matching was based on style and occasion only."
      : null,
  };

  return NextResponse.json(result);
}
