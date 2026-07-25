// ─── Authenticated shell layout ───────────────────────────────────────────────
// Wraps every authenticated route (/measure, /avatar, /catalog, /saved,
// /account/measurements, /home) with a plain pass-through.
// The (auth) route group has no effect on URLs.
//
// AccountDropdown is NOT injected here — each page mounts it where it belongs:
//   - /home   → built into the page's own nav
//   - all others → fixed top-right overlay injected per-page

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
