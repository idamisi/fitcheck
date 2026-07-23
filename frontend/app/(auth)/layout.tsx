import AccountDropdown from "../components/AccountDropdown";

// ─── Authenticated shell layout ───────────────────────────────────────────────
// Wraps every authenticated route (/measure, /avatar, /catalog, /saved,
// /account/measurements) with a persistent top bar that shows the account
// dropdown. The (auth) route group has no effect on URLs.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Persistent account bar — fixed top-right, above all page content */}
      <div
        className="fixed top-0 right-0 z-30 px-5 py-3"
        style={{ pointerEvents: "none" }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <AccountDropdown />
        </div>
      </div>
      {children}
    </>
  );
}
