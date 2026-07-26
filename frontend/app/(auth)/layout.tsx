import { OutfitProvider } from "../lib/outfit-context";

// ─── Authenticated shell layout ───────────────────────────────────────────────
// Wraps every authenticated route with OutfitProvider so outfit state is
// shared across catalog, avatar preview, and any future page in this group.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <OutfitProvider>{children}</OutfitProvider>;
}
