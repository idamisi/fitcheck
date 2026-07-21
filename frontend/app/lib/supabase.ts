import { createBrowserClient } from "@supabase/ssr";

// ─── Browser client ───────────────────────────────────────────────────────────
// Use this in Client Components ("use client").
// createBrowserClient is safe to call on every render — it returns a singleton.

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
