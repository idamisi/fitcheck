import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ─── Server client ────────────────────────────────────────────────────────────
// Use this in Server Components, Route Handlers, and Server Actions.
// Must be called inside a request context (cookies() requires it).

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can throw in Server Components — middleware handles
            // the actual session refresh so this is safe to swallow here.
          }
        },
      },
    },
  );
}
