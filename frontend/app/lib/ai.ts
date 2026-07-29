import OpenAI from "openai";

// ─── Shared AI model call ─────────────────────────────────────────────────────
// Single place for client setup. Both /api/fit and /api/search import this.
// To swap provider/model, change only this file.

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type CallOptions = {
  temperature?: number;
  max_tokens?: number;
};

async function callOnce(
  client: OpenAI,
  prompt: string,
  opts: Required<CallOptions>,
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "google/gemma-4-31B-it:novita",
    messages: [{ role: "user", content: prompt }],
    max_tokens: opts.max_tokens,
    temperature: opts.temperature,
  });
  const content = completion.choices[0]?.message?.content ?? "";
  if (!content) throw new Error("Model returned an empty response.");
  return content;
}

export async function callAIModel(
  prompt: string,
  { temperature = 0, max_tokens = 700 }: CallOptions = {},
): Promise<string> {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN is not set in environment.");

  const client = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: token,
  });

  const opts: Required<CallOptions> = { temperature, max_tokens };

  try {
    return await callOnce(client, prompt, opts);
  } catch (e) {
    const err = e as Error & { status?: number };
    // Single automatic retry only on 429 (rate limit), after a short back-off.
    if (err.status === 429) {
      await sleep(2500);
      return await callOnce(client, prompt, opts);
    }
    throw err;
  }
}
