import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ─── Model ────────────────────────────────────────────────────────────────────
// Intentionally separate from /api/fit and /api/search which use :novita.
// Only :cerebras supports image input for google/gemma-4-31B-it.

const VISION_MODEL = "google/gemma-4-31B-it:cerebras";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnalyzeInput = {
  imageUrl: string;
};

export type AnalyzeOutput = {
  category: "top" | "bottom" | "outerwear" | "shoe";
  color: string;
  styleTags: string[];
  description: string;
};

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a garment classification assistant. The user will provide an image of a clothing item or accessory. Analyse the image and respond with ONLY a JSON object — no prose, no markdown fences, no text before or after the JSON.

Return exactly this shape:
{
  "category": "<top|bottom|outerwear|shoe>",
  "color": "<primary color as a short plain-English phrase, e.g. 'navy blue' or 'off-white'>",
  "styleTags": ["<tag1>", "<tag2>"],
  "description": "<one concise sentence describing the item>"
}

Rules:
- category must be one of: top, bottom, outerwear, shoe
- styleTags must be 2 or 3 tags chosen only from: casual, classic, formal, smart-casual, sporty, streetwear
- description must be one sentence, max 20 words
- Respond with ONLY valid JSON`;

const RETRY_SUFFIX =
  "\n\nIMPORTANT: Your previous response was not valid JSON. Respond with ONLY the JSON object, nothing else.";

// ─── Helper ───────────────────────────────────────────────────────────────────

function extractJson(raw: string): AnalyzeOutput | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Partial<AnalyzeOutput>;
    // Validate required fields and enum values
    const validCategories = ["top", "bottom", "outerwear", "shoe"];
    const validTags = ["casual", "classic", "formal", "smart-casual", "sporty", "streetwear"];
    if (
      !parsed.category ||
      !validCategories.includes(parsed.category) ||
      typeof parsed.color !== "string" ||
      !parsed.color.trim() ||
      !Array.isArray(parsed.styleTags) ||
      parsed.styleTags.length < 1 ||
      typeof parsed.description !== "string" ||
      !parsed.description.trim()
    ) {
      return null;
    }
    // Filter tags to only known vocab
    const filteredTags = parsed.styleTags.filter((t) => validTags.includes(t));
    return {
      category: parsed.category,
      color: parsed.color.trim(),
      styleTags: filteredTags.length > 0 ? filteredTags : ["casual"],
      description: parsed.description.trim(),
    };
  } catch {
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: AnalyzeInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { imageUrl } = body;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl is required." }, { status: 400 });
  }

  // Cerebras accepts inline image data; it does not fetch remote image URLs.
  // Keep accepting HTTP(S) too so the endpoint remains useful with providers
  // that support remote images.
  const isImageDataUri = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(imageUrl);
  const isHttpUrl = (() => {
    try {
      const url = new URL(imageUrl);
      return ["http:", "https:"].includes(url.protocol);
    } catch {
      return false;
    }
  })();

  if (!isImageDataUri && !isHttpUrl) {
    return NextResponse.json({ error: "imageUrl must be an image data URI or a valid http/https URL." }, { status: 400 });
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    console.error("[/api/wardrobe/analyze] HF_TOKEN not set");
    return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
  }

  const client = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: token,
  });

  // ── First attempt ────────────────────────────────────────────────────────────
  let raw: string;
  try {
    const completion = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: SYSTEM_PROMPT },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0,
    });
    raw = completion.choices[0]?.message?.content ?? "";
    if (!raw) throw new Error("Model returned an empty response.");
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("[/api/wardrobe/analyze] first attempt failed:", err.message);

    if (err.status === 400) {
      return NextResponse.json(
        { error: "The image could not be processed. Please try a different photo." },
        { status: 400 },
      );
    }
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

  // ── Try to parse first response ──────────────────────────────────────────────
  let result = extractJson(raw);
  if (result) {
    return NextResponse.json(result);
  }

  // ── Retry once with stricter JSON-only instruction ───────────────────────────
  try {
    const retry = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: SYSTEM_PROMPT + RETRY_SUFFIX },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0,
    });
    const retryRaw = retry.choices[0]?.message?.content ?? "";
    result = extractJson(retryRaw);
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("[/api/wardrobe/analyze] retry attempt failed:", err.message);
    // Fall through to the parse-failure error below
  }

  if (!result) {
    console.error("[/api/wardrobe/analyze] could not extract valid JSON after retry. Raw:", raw);
    return NextResponse.json(
      { error: "AI service returned an unexpected response — please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}
