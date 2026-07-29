"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";

export default function AccountDropdown() {
  const router = useRouter();
  const supabase = createClient();
  // display_name from profiles table; null until loaded; false = loaded but absent
  const [displayName, setDisplayName] = useState<string | null | false>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setDisplayName(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      setDisplayName(profile?.display_name ?? false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Still loading — render nothing to avoid flash
  if (displayName === null) return null;

  const displayLabel = displayName || "Account";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium rounded-lg focus:outline-none focus-visible:ring-2 transition-[transform,border-color] duration-150 ease-out active:scale-[0.97] px-3 py-1.5"
        style={{ color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)" }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="max-w-[120px] truncate">{displayLabel}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border z-50 overflow-hidden transition-[transform,opacity] duration-150 ease-out starting:opacity-0 starting:scale-95 motion-reduce:transition-none motion-reduce:starting:opacity-100 motion-reduce:starting:scale-100"
          style={{ background: "var(--surface)", borderColor: "var(--border)", transformOrigin: "top right" }}
        >
          {[
            { label: "Saved Items",   href: "/saved" },
            { label: "Measurements",  href: "/account/measurements" },
          ].map(({ label, href }) => (
            <button
              key={href}
              onClick={() => { setOpen(false); router.push(href); }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors focus:outline-none"
              style={{ color: "var(--text)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              {label}
            </button>
          ))}

          <div style={{ height: 1, background: "var(--border)" }} />

          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-sm transition-colors focus:outline-none"
            style={{ color: "var(--danger)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
