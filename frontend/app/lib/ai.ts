import OpenAI from "openai";

// ─── Shared AI model call ─────────────────────────────────────────────────────
// Single place for client setup. Both /api/fit and /api/search import this.
// To swap provider/model, change only this file.

export async function callAIModel(prompt: string): Promise<string> {
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
