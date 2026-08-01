"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase";
import AccountDropdown from "../../../components/AccountDropdown";
import type { AnalyzeOutput } from "../../../api/wardrobe/analyze/route";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB — feature-specific limit
const MAX_SIDE_PX    = 1024;            // longest edge after client-side resize
const JPEG_QUALITY   = 0.8;

const CATEGORIES = ["top", "bottom", "outerwear", "shoe"] as const;
type Category = (typeof CATEGORIES)[number];

const ALL_TAGS = ["casual", "classic", "formal", "smart-casual", "sporty", "streetwear"] as const;
type Tag = (typeof ALL_TAGS)[number];

// ─── Image helpers ────────────────────────────────────────────────────────────

/** Resize to ≤ MAX_SIDE_PX on the longest edge, then encode as JPEG blob. */
function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_SIDE_PX || h > MAX_SIDE_PX) {
        if (w >= h) { h = Math.round((h / w) * MAX_SIDE_PX); w = MAX_SIDE_PX; }
        else        { w = Math.round((w / h) * MAX_SIDE_PX); h = MAX_SIDE_PX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Canvas toBlob returned null")),
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

/** Cerebras vision accepts inline image data, not remote image URLs. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("Could not encode image"));
    reader.onerror = () => reject(new Error("Could not encode image"));
    reader.readAsDataURL(blob);
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Stage = "pick" | "uploading" | "confirm" | "saving" | "done";

export default function WardrobeUploadPage() {
  const router  = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userId,       setUserId]       = useState<string | null>(null);
  const [stage,        setStage]        = useState<Stage>("pick");

  // pick stage
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [fileName,     setFileName]     = useState<string | null>(null);
  const [fileError,    setFileError]    = useState<string | null>(null);

  // uploading / error
  const [uploadError,  setUploadError]  = useState<string | null>(null);
  const [savedUrl,     setSavedUrl]     = useState<string | null>(null);

  // confirm stage — editable fields
  const [category,    setCategory]    = useState<Category>("top");
  const [color,       setColor]       = useState("");
  const [styleTags,   setStyleTags]   = useState<Tag[]>([]);
  const [description, setDescription] = useState("");
  const [location,    setLocation]    = useState("");
  const [tagInput,    setTagInput]    = useState<Tag | "">("");

  useEffect(() => {
    supabase.auth.getUser().then((result: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      const u = result.data.user;
      if (!u) router.replace("/");
      else setUserId(u.id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File selection ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setFileError("Image too large, please choose a smaller photo (max 5 MB).");
      e.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFileError("Please choose an image file.");
      e.target.value = "";
      return;
    }

    try {
      const blob = await resizeImage(file);
      const url  = URL.createObjectURL(blob);
      setSelectedBlob(blob);
      setPreviewUrl(url);
      setFileName(file.name);
    } catch {
      setFileError("Could not process the image. Please try a different file.");
    }
  }

  // ── Submit (upload + analyze) ───────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBlob || !userId) return;

    setStage("uploading");
    setUploadError(null);

    // Cerebras does not fetch remote URLs, so the AI receives the resized image
    // inline. The Storage public URL below is still used for the saved item.
    let analysisImageUrl: string;
    try {
      analysisImageUrl = await blobToDataUrl(selectedBlob);
    } catch {
      setUploadError("Could not process the image. Please try a different file.");
      setStage("pick");
      return;
    }

    // 1. Upload to Supabase Storage
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error: storageErr } = await supabase.storage
      .from("wardrobe-photos")
      .upload(path, selectedBlob, { contentType: "image/jpeg", upsert: false });

    if (storageErr) {
      console.error("[wardrobe/upload] storage error:", storageErr.message);
      setUploadError("Upload failed — please try again.");
      setStage("pick");
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("wardrobe-photos")
      .getPublicUrl(path);

    setSavedUrl(publicUrl);

    // 2. Analyze
    let analysis: AnalyzeOutput;
    try {
      const res = await fetch("/api/wardrobe/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: analysisImageUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Analysis failed");
      }
      analysis = await res.json() as AnalyzeOutput;
    } catch (e) {
      const msg = (e as Error).message;
      setUploadError(msg || "Analysis failed — please try again.");
      setStage("pick");
      return;
    }

    // 3. Seed editable fields with AI result
    setCategory(analysis.category);
    setColor(analysis.color);
    setStyleTags(analysis.styleTags.filter((t: string): t is Tag => (ALL_TAGS as readonly string[]).includes(t)));
    setDescription(analysis.description);
    setStage("confirm");
  }

  // ── Save confirmed item ─────────────────────────────────────────────────────

  async function handleSave() {
    if (!savedUrl || !userId) return;
    setStage("saving");

    const { error } = await supabase.from("wardrobe_items").insert({
      user_id:     userId,
      image_url:   savedUrl,
      category,
      color:       color.trim(),
      style_tags:  styleTags,
      description: description.trim(),
      location:    location.trim(),
    });

    if (error) {
      console.error("[wardrobe/upload] insert error:", error.message);
      setUploadError("Could not save item — please try again.");
      setStage("confirm");
      return;
    }

    setStage("done");
  }

  function handleDiscard() {
    // Clean up preview object URLs
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedBlob(null);
    setFileName(null);
    setStage("pick");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addTag(tag: Tag) {
    if (!styleTags.includes(tag)) setStyleTags((prev) => [...prev, tag]);
    setTagInput("");
  }

  function removeTag(tag: Tag) {
    setStyleTags((prev) => prev.filter((t) => t !== tag));
  }

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/home");
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="app-refresh"
      style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}
    >
      {/* Nav */}
      <nav
        style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "1rem clamp(1rem, 4vw, 3rem)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1.5 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(event) => (event.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(event) => (event.currentTarget.style.color = "var(--text-muted)")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
        <AccountDropdown />
      </nav>

      {/* Body */}
      <div
        style={{
          maxWidth: "540px",
          margin: "0 auto",
          padding: "clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 3rem)",
        }}
      >
        <h1
          className="app-page-title"
          style={{
            fontFamily: "var(--font-heading)", color: "var(--text)",
            fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
            fontWeight: 700, letterSpacing: "-0.02em",
            lineHeight: 1.2, margin: "0 0 0.375rem",
          }}
        >
          Add to wardrobe
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem", marginBottom: "2rem" }}>
          Upload a photo and Fitzy will identify the item for you.
        </p>

        {/* ── Done screen ──────────────────────────────────────────────────── */}
        {stage === "done" && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "2rem",
              textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem",
            }}
          >
            <span style={{ fontSize: "2rem" }}>✓</span>
            <p style={{ fontWeight: 600, fontSize: "1.0625rem", margin: 0 }}>Item saved to your wardrobe.</p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => { setStage("pick"); setPreviewUrl(null); setSelectedBlob(null); setFileName(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                style={secondaryBtn}
              >
                Add another
              </button>
              <button onClick={() => router.push("/home")} style={primaryBtn}>
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── Pick + upload form ────────────────────────────────────────────── */}
        {(stage === "pick" || stage === "uploading") && (
          <form onSubmit={handleSubmit}>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "clamp(1.25rem, 3vw, 2rem)",
                display: "flex", flexDirection: "column", gap: "1.25rem",
              }}
            >
              {/* File input */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem", fontWeight: 600,
                    marginBottom: "0.5rem",
                    color: "var(--text)",
                  }}
                >
                  Photo
                </label>
                <input
                  ref={fileInputRef}
                  id="wardrobe-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={stage === "uploading"}
                  className="sr-only"
                />
                <label
                  htmlFor="wardrobe-photo"
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-sm font-semibold transition-opacity focus-within:ring-2"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--text)",
                    background: "var(--bg)",
                    borderColor: "var(--border)",
                    opacity: stage === "uploading" ? 0.55 : 1,
                    cursor: stage === "uploading" ? "not-allowed" : "pointer",
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    Choose file
                  </span>
                  <span className="max-w-[55%] truncate text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {fileName ?? "No file selected"}
                  </span>
                </label>
                {fileError && (
                  <p style={{ color: "var(--danger)", fontSize: "0.8125rem", marginTop: "0.375rem" }}>
                    {fileError}
                  </p>
                )}
              </div>

              {/* Preview */}
              {previewUrl && (
                <div
                  style={{
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    display: "flex", justifyContent: "center",
                    maxHeight: "320px",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview of selected garment"
                    style={{ maxHeight: "320px", maxWidth: "100%", objectFit: "contain" }}
                  />
                </div>
              )}

              {/* Upload error */}
              {uploadError && (
                <p style={{ color: "var(--danger)", fontSize: "0.8125rem", margin: 0 }}>
                  {uploadError}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!selectedBlob || stage === "uploading"}
                style={{
                  ...primaryBtn,
                  opacity: (!selectedBlob || stage === "uploading") ? 0.4 : 1,
                  cursor: (!selectedBlob || stage === "uploading") ? "not-allowed" : "pointer",
                }}
              >
                {stage === "uploading" ? "Analysing…" : "Analyse photo"}
              </button>
            </div>
          </form>
        )}

        {/* ── Confirm / edit screen ─────────────────────────────────────────── */}
        {(stage === "confirm" || stage === "saving") && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "clamp(1.25rem, 3vw, 2rem)",
              display: "flex", flexDirection: "column", gap: "1.5rem",
            }}
          >
            {/* Preview thumbnail */}
            {previewUrl && (
              <div
                style={{
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  display: "flex", justifyContent: "center",
                  maxHeight: "240px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Uploaded garment"
                  style={{ maxHeight: "240px", maxWidth: "100%", objectFit: "contain" }}
                />
              </div>
            )}

            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: 0 }}>
              Review and edit the details Fitzy identified, then save.
            </p>

            {/* Category */}
            <div>
              <label style={labelStyle}>Item type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                disabled={stage === "saving"}
                style={inputStyle}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div>
              <label style={labelStyle}>Primary color</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={stage === "saving"}
                placeholder="e.g. navy blue"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>

            {/* Style tags */}
            <div>
              <label style={labelStyle}>Style tags</label>
              {/* Current tags as removable chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.5rem" }}>
                {styleTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "0.25rem",
                      padding: "0.25rem 0.625rem",
                      fontSize: "0.8125rem", fontWeight: 500,
                      background: "var(--accent-soft)", color: "var(--text)",
                      border: "1px solid var(--accent)",
                      borderRadius: "999px",
                    }}
                  >
                    {tag}
                    {stage !== "saving" && (
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        style={{
                          background: "none", border: "none", padding: 0,
                          cursor: "pointer", lineHeight: 1, fontSize: "0.875rem",
                          color: "var(--text-muted)",
                        }}
                        aria-label={`Remove ${tag}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {/* Add tag dropdown */}
              {stage !== "saving" && (
                <select
                  value={tagInput}
                  onChange={(e) => { if (e.target.value) addTag(e.target.value as Tag); }}
                  style={{ ...inputStyle, color: tagInput ? "var(--text)" : "var(--text-muted)" }}
                >
                  <option value="">+ Add a tag…</option>
                  {ALL_TAGS.filter((t) => !styleTags.includes(t)).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Location */}
            <div>
              <label style={labelStyle}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={stage === "saving"}
                placeholder="e.g. Home, Suitcase, Country 2…"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={stage === "saving"}
                rows={3}
                placeholder="One-sentence description of the item"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>

            {/* Save error */}
            {uploadError && stage === "confirm" && (
              <p style={{ color: "var(--danger)", fontSize: "0.8125rem", margin: 0 }}>
                {uploadError}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={stage === "saving"}
                style={{ ...secondaryBtn, opacity: stage === "saving" ? 0.4 : 1, cursor: stage === "saving" ? "not-allowed" : "pointer" }}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={stage === "saving" || !color.trim() || !description.trim()}
                style={{
                  ...primaryBtn,
                  opacity: (stage === "saving" || !color.trim() || !description.trim()) ? 0.4 : 1,
                  cursor: (stage === "saving" || !color.trim() || !description.trim()) ? "not-allowed" : "pointer",
                }}
              >
                {stage === "saving" ? "Saving…" : "Save to wardrobe"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared style objects ──────────────────────────────────────────────────────

const primaryBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.6875rem 1.25rem",
  fontSize: "0.9375rem", fontWeight: 600,
  background: "var(--accent)", color: "var(--accent-text)",
  border: "1.5px solid var(--accent)",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "opacity 0.15s",
};

const secondaryBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.6875rem 1.25rem",
  fontSize: "0.9375rem", fontWeight: 500,
  background: "var(--surface)", color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "border-color 0.15s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.875rem", fontWeight: 600,
  marginBottom: "0.375rem",
  color: "var(--text)",
};

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%",
  padding: "0.5625rem 0.75rem",
  fontSize: "0.875rem",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
};
