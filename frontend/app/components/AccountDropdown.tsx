"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";

export default function AccountDropdown() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load the signed-in user's email once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click — deferred by one tick so the toggle click
  // doesn't immediately re-close the menu.
  useEffect(() => {
    if (!open) return;
    let id: ReturnType<typeof setTimeout>;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    id = setTimeout(() => document.addEventListener("click", handleOutside), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", handleOutside);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await supabase.auth.signOut();
    router.replace("/");
  }

  // Not signed in or email not yet loaded — render nothing
  if (!email) return null;

  const displayLabel = email.includes("@") ? email.split("@")[0] : email;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium rounded focus:outline-none focus-visible:ring-2 transition-colors"
        style={{ color: "#2B3A55" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#2B3A55")}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="max-w-[120px] truncate">{displayLabel}</span>
        {/* chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border shadow-sm z-50 overflow-hidden"
          style={{ background: "#fff", borderColor: "#E5E7EB" }}
        >
          {[
            { label: "Saved Items",  href: "/saved" },
            { label: "Measurements", href: "/account/measurements" },
          ].map(({ label, href }) => (
            <button
              key={href}
              onClick={() => { setOpen(false); router.push(href); }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors focus:outline-none"
              style={{ color: "#1A1A1A" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F7F8FA")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              {label}
            </button>
          ))}

          <div style={{ height: 1, background: "#E5E7EB" }} />

          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-sm transition-colors focus:outline-none"
            style={{ color: "#B91C1C" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF2F2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
