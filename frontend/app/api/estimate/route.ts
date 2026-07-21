import { NextRequest, NextResponse } from "next/server";
import { callAIModel } from "../../lib/ai";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EstimateInput = {
  height: number;         // cm — user-provided exact value
  weight: number;         // kg
  usualTopSize: string;   // XS | S | M | L | XL
  usualBottomSize: string;
  usualShoeSize: string;
  fitComment: string;     // optional free text
};

export type EstimateOutput = {
  shoulderWidth: number;
  chest: number;
  waist: number;
  hip: number;
  inseam: number;
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(input: EstimateInput): string {
  const fitNote = input.fitComment.trim()
    ? `The user also notes: "${input.fitComment.trim()}"`
    : "No additional fit notes provided.";

  return `You are a clothing measurement estimator. You must respond with ONLY a JSON object — no prose, no markdown fences, no text before or after the JSON.

TASK:
Estimate this person's body measurements in centimetres based on the information below.
These are ESTIMATES — return reasonable, plausible values even if you cannot be certain.
Do NOT refuse to answer. Do NOT return null or omit any field.

INPUTS:
  Height: ${input.height} cm  (exact — use this as an anchor, do not re-estimate it)
  Weight: ${input.weight} kg
  Usual top size: ${input.usualTopSize}
  Usual bottom size: ${input.usualBottomSize}
  Usual shoe size (US): ${input.usualShoeSize}
  ${fitNote}

WHAT TO ESTIMATE (all values in cm, integers or one decimal place):
  shoulderWidth — shoulder point to shoulder point across the back
  chest         — circumference at the widest point of the chest
  waist         — circumference at the natural waist (where trousers typically sit)
  hip           — circumference at the widest point of the hips/seat
  inseam        — crotch to ankle, inside leg

GUIDELINES:
- Use height and weight together to judge overall body proportions before applying size adjustments.
- Use the clothing sizes to refine: e.g. an M top on a 180 cm person implies different chest/shoulder values than M on a 160 cm person.
- Apply fitComment as a directional nudge: "runs loose on me" → estimate slightly narrower than the size label implies; "always too short" → nudge inseam upward.
- Shoe size does not affect body measurement estimates — ignore it for these fields.

Respond with ONLY this exact JSON shape:
{
  "shoulderWidth": <number>,
  "chest": <number>,
  "waist": <number>,
  "hip": <number>,
  "inseam": <number>
}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: EstimateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { height, weight, usualTopSize, usualBottomSize, usualShoeSize, fitComment } = body;

  if (!height || !weight) {
    return NextResponse.json(
      { error: "height and weight are required." },
      { status: 400 },
    );
  }

  const prompt = buildPrompt({ height, weight, usualTopSize, usualBottomSize, usualShoeSize, fitComment });

  console.log("[/api/estimate] prompt sent to model:\n", prompt);

  let rawResponse: string;
  try {
    rawResponse = await callAIModel(prompt);
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("[/api/estimate] model call failed:", err.message);

    if (err.status === 429) {
      return NextResponse.json(
        { error: "Too many requests — please wait a moment and try again." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Estimate service unavailable — please try again or enter your measurements manually." },
      { status: 502 },
    );
  }

  console.log("[/api/estimate] raw model response:\n", rawResponse);

  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[/api/estimate] model did not return valid JSON. Raw:", rawResponse);
    return NextResponse.json(
      { error: "Estimate service returned an unexpected response format." },
      { status: 502 },
    );
  }

  let parsed: EstimateOutput;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[/api/estimate] JSON parse failed. Raw:", rawResponse);
    return NextResponse.json(
      { error: "Estimate service returned malformed JSON." },
      { status: 502 },
    );
  }

  // Sanity-check: all five fields must be positive numbers
  const fields: (keyof EstimateOutput)[] = ["shoulderWidth", "chest", "waist", "hip", "inseam"];
  for (const f of fields) {
    if (typeof parsed[f] !== "number" || parsed[f] <= 0) {
      console.error(`[/api/estimate] missing or invalid field "${f}". Parsed:`, parsed);
      return NextResponse.json(
        { error: "Estimate service returned an incomplete response." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(parsed);
}
