"use client";

import Link from "next/link";

export default function CatalogPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: "#FAFAF8" }}>
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 rounded"
        style={{ color: "#2B3A55" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#1A1A1A")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#2B3A55")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </Link>
      <p className="text-base" style={{ color: "#2B3A55" }}>Catalog coming soon.</p>
    </main>
  );
}
