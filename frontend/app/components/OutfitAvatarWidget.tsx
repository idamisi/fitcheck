"use client";

import { useState } from "react";
import { useOutfit } from "../lib/outfit-context";
import { VB_W, VB_H, catalogColorToCSS, buildGarmentPaths, computeGeometry } from "./Avatar";
import type { Measurements } from "./MeasurementForm";
import type { OutfitState } from "../lib/outfit-context";

// ─── constants ────────────────────────────────────────────────────────────────

const WIDGET_W = 64;
const WIDGET_H = 88;

// ─── shared SVG body renderer ─────────────────────────────────────────────────
// Renders all avatar SVG elements (no outer <svg> tag) so it can be embedded
// inside either the small widget <svg> or the large modal <svg>.

function AvatarSvgBody({
  measurements: m, outfit, clipPrefix,
}: {
  measurements: Measurements;
  outfit: OutfitState;
  clipPrefix: string;
}) {
  const g = computeGeometry(m);
  const cx = VB_W / 2;
  const { hs } = g;

  // ── silhouette paths (duplicated from Avatar.tsx to keep this self-contained) ──
  const HEAD_TOP = 10 * hs, HEAD_H = 46 * hs, HEAD_R = HEAD_H / 2;
  const HEAD_CY  = HEAD_TOP + HEAD_R;
  const NECK_TOP = HEAD_TOP + HEAD_H;
  const NECK_BOT = NECK_TOP + 16 * hs;
  const NECK_HW  = 10;
  const { SHOULDER_Y, CHEST_Y, WAIST_Y, HIP_Y, ANKLE_Y,
          ARM_TOP_Y, ARM_BOT_Y, ARM_TOP_HW, ARM_BOT_HW,
          shoulderHW, chestHW, waistHW, hipHW } = g;

  const inseamScale = m.inseam > 0 ? m.inseam / 80 : 1;
  const LEG_H    = 155 * hs * inseamScale;
  const FOOT_BOT = ANKLE_Y + 10 * hs;

  const THIGH_HW = hipHW * 0.38, KNEE_HW = THIGH_HW * 0.75;
  const ANKLE_HW = KNEE_HW * 0.6, FOOT_HW = ANKLE_HW * 1.4;
  const FOOT_TOE = FOOT_HW * 1.6;

  const torso = [
    `M ${cx-shoulderHW} ${SHOULDER_Y}`,
    `C ${cx-shoulderHW} ${CHEST_Y},  ${cx-chestHW} ${CHEST_Y},  ${cx-chestHW} ${CHEST_Y}`,
    `C ${cx-chestHW} ${WAIST_Y},     ${cx-waistHW} ${WAIST_Y},  ${cx-waistHW} ${WAIST_Y}`,
    `C ${cx-waistHW} ${HIP_Y},       ${cx-hipHW}   ${HIP_Y},    ${cx-hipHW}   ${HIP_Y}`,
    `L ${cx+hipHW}   ${HIP_Y}`,
    `C ${cx+hipHW}   ${HIP_Y},       ${cx+waistHW} ${HIP_Y},    ${cx+waistHW} ${WAIST_Y}`,
    `C ${cx+waistHW} ${WAIST_Y},     ${cx+chestHW} ${WAIST_Y},  ${cx+chestHW} ${CHEST_Y}`,
    `C ${cx+chestHW} ${CHEST_Y},     ${cx+shoulderHW} ${CHEST_Y}, ${cx+shoulderHW} ${SHOULDER_Y}`, "Z",
  ].join(" ");

  const lLX = cx - hipHW * 0.5;
  const lLeg = [
    `M ${lLX-THIGH_HW} ${HIP_Y}`,   `L ${lLX-KNEE_HW}  ${HIP_Y+LEG_H*.5}`,
    `L ${lLX-ANKLE_HW} ${ANKLE_Y}`, `L ${lLX-ANKLE_HW} ${FOOT_BOT}`,
    `L ${lLX+FOOT_TOE} ${FOOT_BOT}`,`L ${lLX+FOOT_HW}  ${ANKLE_Y}`,
    `L ${lLX+KNEE_HW}  ${HIP_Y+LEG_H*.5}`, `L ${lLX+THIGH_HW} ${HIP_Y}`, "Z",
  ].join(" ");
  const rLX = cx + hipHW * 0.5;
  const rLeg = [
    `M ${rLX-THIGH_HW} ${HIP_Y}`,   `L ${rLX-KNEE_HW}  ${HIP_Y+LEG_H*.5}`,
    `L ${rLX-ANKLE_HW} ${ANKLE_Y}`, `L ${rLX-ANKLE_HW} ${FOOT_BOT}`,
    `L ${rLX+FOOT_TOE} ${FOOT_BOT}`,`L ${rLX+FOOT_HW}  ${ANKLE_Y}`,
    `L ${rLX+KNEE_HW}  ${HIP_Y+LEG_H*.5}`, `L ${rLX+THIGH_HW} ${HIP_Y}`, "Z",
  ].join(" ");
  const lAX = cx - shoulderHW - 4;
  const lArm = [
    `M ${lAX} ${ARM_TOP_Y}`,
    `C ${lAX-ARM_TOP_HW} ${ARM_TOP_Y}, ${lAX-ARM_TOP_HW} ${ARM_TOP_Y+20*hs}, ${lAX-ARM_BOT_HW} ${ARM_BOT_Y}`,
    `L ${lAX+ARM_BOT_HW*.5} ${ARM_BOT_Y}`,
    `C ${lAX+ARM_TOP_HW*.3} ${ARM_TOP_Y+20*hs}, ${lAX+ARM_TOP_HW*.3} ${ARM_TOP_Y}, ${lAX} ${ARM_TOP_Y}`, "Z",
  ].join(" ");
  const rAX = cx + shoulderHW + 4;
  const rArm = [
    `M ${rAX} ${ARM_TOP_Y}`,
    `C ${rAX+ARM_TOP_HW} ${ARM_TOP_Y}, ${rAX+ARM_TOP_HW} ${ARM_TOP_Y+20*hs}, ${rAX+ARM_BOT_HW} ${ARM_BOT_Y}`,
    `L ${rAX-ARM_BOT_HW*.5} ${ARM_BOT_Y}`,
    `C ${rAX-ARM_TOP_HW*.3} ${ARM_TOP_Y+20*hs}, ${rAX-ARM_TOP_HW*.3} ${ARM_TOP_Y}, ${rAX} ${ARM_TOP_Y}`, "Z",
  ].join(" ");

  // ── garment overlay paths ──────────────────────────────────────────────────
  const {
    shirtPath, outerwearPath, waistbandPts, leftLegPts, rightLegPts,
    shirtBounds, outerwearBounds, bottomBounds,
  } = buildGarmentPaths(g);

  const p = clipPrefix; // short alias for clip IDs

  return (
    <>
      {/* clip path defs */}
      <defs>
        {outfit.bottom && (
          <clipPath id={`${p}-clip-bottom`}>
            <polygon points={waistbandPts} />
            <polygon points={leftLegPts} />
            <polygon points={rightLegPts} />
          </clipPath>
        )}
        {outfit.top && (
          <clipPath id={`${p}-clip-top`}>
            <path d={shirtPath} />
          </clipPath>
        )}
        {outfit.outerwear && (
          <clipPath id={`${p}-clip-outer`}>
            <path d={outerwearPath} />
          </clipPath>
        )}
      </defs>

      {/* silhouette */}
      <ellipse cx={cx} cy={HEAD_CY} rx={HEAD_R*.78} ry={HEAD_R} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x={cx-NECK_HW} y={NECK_TOP} width={NECK_HW*2} height={NECK_BOT-NECK_TOP} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
      <path d={lArm}  fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={rArm}  fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={torso} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={lLeg}  fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={rLeg}  fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />

      {/* anchor lines */}
      <line x1={cx-shoulderHW} y1={SHOULDER_Y} x2={cx+shoulderHW} y2={SHOULDER_Y} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
      <line x1={cx-waistHW}    y1={WAIST_Y}    x2={cx+waistHW}    y2={WAIST_Y}    stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
      <line x1={cx-hipHW}      y1={HIP_Y}      x2={cx+hipHW}      y2={HIP_Y}      stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />

      {/* garment overlays — bottom behind top behind outerwear */}
      {outfit.bottom && (
        outfit.bottom.imageUrl ? (
          <image
            href={outfit.bottom.imageUrl}
            x={bottomBounds.x} y={bottomBounds.y}
            width={bottomBounds.w} height={bottomBounds.h}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${p}-clip-bottom)`}
            opacity={0.92}
          />
        ) : (
          <>
            <polygon points={waistbandPts} fill={catalogColorToCSS(outfit.bottom.color)} opacity={0.85} />
            <polygon points={leftLegPts}   fill={catalogColorToCSS(outfit.bottom.color)} opacity={0.80} />
            <polygon points={rightLegPts}  fill={catalogColorToCSS(outfit.bottom.color)} opacity={0.80} />
          </>
        )
      )}
      {outfit.top && (
        outfit.top.imageUrl ? (
          <image
            href={outfit.top.imageUrl}
            x={shirtBounds.x} y={shirtBounds.y}
            width={shirtBounds.w} height={shirtBounds.h}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${p}-clip-top)`}
            opacity={0.92}
          />
        ) : (
          <path d={shirtPath} fill={catalogColorToCSS(outfit.top.color)}
            opacity={0.78} stroke={catalogColorToCSS(outfit.top.color)} strokeWidth="0.5" strokeLinejoin="round" />
        )
      )}
      {outfit.outerwear && (
        outfit.outerwear.imageUrl ? (
          <image
            href={outfit.outerwear.imageUrl}
            x={outerwearBounds.x} y={outerwearBounds.y}
            width={outerwearBounds.w} height={outerwearBounds.h}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${p}-clip-outer)`}
            opacity={0.92}
          />
        ) : (
          <path d={outerwearPath} fill={catalogColorToCSS(outfit.outerwear.color)}
            opacity={0.72} stroke={catalogColorToCSS(outfit.outerwear.color)} strokeWidth="0.5" strokeLinejoin="round" />
        )
      )}
    </>
  );
}

// ─── layer chip ───────────────────────────────────────────────────────────────

function LayerChip({ outfit, slot, onRemove }: {
  outfit: OutfitState;
  slot: "top" | "bottom" | "outerwear" | "shoe";
  onRemove: () => void;
}) {
  const item = outfit[slot];
  if (!item) return null;
  const LABEL = { top: "Top", bottom: "Bottom", outerwear: "Outer", shoe: "Shoes" };
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{LABEL[slot]}</span>
      <span className="truncate max-w-[130px]">{item.name}</span>
      <button onClick={onRemove} aria-label={`Remove ${item.name}`}
        className="flex-shrink-0 ml-0.5 hover:opacity-60 transition-opacity focus:outline-none"
        style={{ color: "var(--text-muted)" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ─── expanded modal ───────────────────────────────────────────────────────────

function OutfitModal({ measurements, outfit, onClose, onRemove }: {
  measurements: Measurements;
  outfit: OutfitState;
  onClose: () => void;
  onRemove: (slot: "top" | "bottom" | "outerwear" | "shoe") => void;
}) {
  const hasAny = !!(outfit.top || outfit.bottom || outfit.outerwear || outfit.shoe);

  return (
    // Portal-style: fixed inset-0, z-[60] so it's above everything including the widget (z-40)
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--bg)" }}
      role="dialog" aria-modal="true" aria-label="My Look">

      {/* ── header bar ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)" }}>
        <h2 className="text-base font-semibold font-heading" style={{ color: "var(--text)" }}>
          My Look
        </h2>
        <button onClick={onClose} aria-label="Close"
          className="p-2 rounded-lg focus:outline-none focus-visible:ring-2 hover:opacity-60 transition-opacity"
          style={{ color: "var(--text-muted)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        {/* avatar — centred, takes up most of the screen height */}
        <div className="flex justify-center items-center px-6 pt-6 pb-4">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            // Fill available width up to 340px, maintain aspect ratio
            style={{ width: "min(100%, 340px)", height: "auto" }}
            aria-label="Outfit preview"
          >
            <AvatarSvgBody measurements={measurements} outfit={outfit} clipPrefix="modal" />
          </svg>
        </div>

        {/* ── item chips ── */}
        <div className="px-5 pb-10">
          {hasAny ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--text-muted)" }}>
                Selected items
              </p>
              <div className="flex flex-wrap gap-2">
                <LayerChip outfit={outfit} slot="outerwear" onRemove={() => onRemove("outerwear")} />
                <LayerChip outfit={outfit} slot="top"       onRemove={() => onRemove("top")} />
                <LayerChip outfit={outfit} slot="bottom"    onRemove={() => onRemove("bottom")} />
                <LayerChip outfit={outfit} slot="shoe"      onRemove={() => onRemove("shoe")} />
              </div>
            </>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
              No items added — use &ldquo;Add to Look&rdquo; on any catalog card.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── widget ───────────────────────────────────────────────────────────────────

export default function OutfitAvatarWidget({ measurements }: { measurements: Measurements }) {
  const { outfit, toggleItem, clearOutfit } = useOutfit();
  const [open, setOpen] = useState(false);

  const count = [outfit.top, outfit.bottom, outfit.outerwear, outfit.shoe].filter(Boolean).length;
  const hasAny = count > 0;

  return (
    <>
      {/* ── collapsed widget button ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open outfit preview"
        className="fixed bottom-6 right-4 z-40 rounded-2xl shadow-lg flex flex-col items-center justify-end overflow-hidden focus:outline-none focus-visible:ring-2 transition-transform hover:scale-105 active:scale-95"
        style={{ width: WIDGET_W, height: WIDGET_H, background: "var(--surface)", border: "1.5px solid var(--border)" }}
      >
        {/* mini avatar */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`}
            style={{ width: WIDGET_W + 8, height: WIDGET_H + 8 }}
            aria-hidden="true">
            <AvatarSvgBody measurements={measurements} outfit={outfit} clipPrefix="widget" />
          </svg>
        </div>

        {/* count badge */}
        {count > 0 && (
          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold z-10"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
            {count}
          </div>
        )}

        {/* label */}
        <div className="relative z-10 w-full text-center text-[9px] font-semibold py-1"
          style={{ background: "rgba(247,245,241,0.90)", color: "var(--text)" }}>
          My Look
        </div>
      </button>

      {/* clear button — floats above widget when there are items */}
      {hasAny && !open && (
        <button onClick={clearOutfit} aria-label="Clear outfit"
          className="fixed bottom-[106px] right-4 z-40 rounded-full px-2 py-0.5 text-[9px] font-semibold shadow hover:opacity-70 transition-opacity focus:outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          Clear
        </button>
      )}

      {/* ── full-screen modal ── */}
      {open && (
        <OutfitModal
          measurements={measurements}
          outfit={outfit}
          onClose={() => setOpen(false)}
          onRemove={(slot: "top" | "bottom" | "outerwear" | "shoe") => { const item = outfit[slot]; if (item) toggleItem(item); }}
        />
      )}
    </>
  );
}
