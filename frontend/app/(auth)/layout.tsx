import { OutfitProvider, OutfitSelectionGuard } from "../lib/outfit-context";
import GlobalFitzyWidget from "../components/GlobalFitzyWidget";

// ─── Authenticated shell layout ───────────────────────────────────────────────
// Wraps every authenticated route with OutfitProvider so outfit state is
// shared across catalog, avatar preview, and any future page in this group.
// OutfitSelectionGuard persists here (not remounted per-page) so it can clear
// the selection on any exit from /catalog or /pick-match without the Strict
// Mode unmount-cleanup hazard a per-page effect would have.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <OutfitProvider>
      <OutfitSelectionGuard />
      {children}
      <GlobalFitzyWidget />
    </OutfitProvider>
  );
}
