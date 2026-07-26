"use client";

import { Measurements } from "./MeasurementForm";
import type { OutfitState } from "../lib/outfit-context";

// ─── defaults ────────────────────────────────────────────────────────────────
const DEFAULT: Required<Measurements> = {
  height: 170,
  shoulderWidth: 42,
  chest: 90,
  waist: 75,
  hip: 95,
  inseam: 80,
};

// ─── SVG canvas ──────────────────────────────────────────────────────────────
export const VB_W = 280;
export const VB_H = 420;
export const CX   = VB_W / 2;

// ─── helpers ─────────────────────────────────────────────────────────────────

function resolve(val: number, def: number): number {
  return val > 0 ? val : def;
}

const SVG_HALF_WIDTH_SCALE = 50 / (DEFAULT.chest / 2);

function toHalfW(cm: number, defaultCm: number): number {
  return (resolve(cm, defaultCm) / 2) * SVG_HALF_WIDTH_SCALE;
}

// ─── geometry export ─────────────────────────────────────────────────────────

export type AvatarGeometry = {
  hs:         number;   // height scale factor
  SHOULDER_Y: number;
  CHEST_Y:    number;
  WAIST_Y:    number;
  HIP_Y:      number;
  ANKLE_Y:    number;
  ARM_TOP_Y:  number;
  ARM_BOT_Y:  number;
  ARM_TOP_HW: number;
  ARM_BOT_HW: number;
  shoulderHW: number;
  chestHW:    number;
  waistHW:    number;
  hipHW:      number;
};

export function computeGeometry(measurements: Measurements): AvatarGeometry {
  const h      = resolve(measurements.height, DEFAULT.height);
  const inseam = resolve(measurements.inseam, DEFAULT.inseam);
  const hs     = h / DEFAULT.height;

  const shoulderHW = toHalfW(measurements.shoulderWidth, DEFAULT.shoulderWidth);
  const chestHW    = toHalfW(measurements.chest,         DEFAULT.chest);
  const waistHW    = toHalfW(measurements.waist,         DEFAULT.waist);
  const hipHW      = toHalfW(measurements.hip,           DEFAULT.hip);

  const HEAD_TOP   = 10 * hs;
  const HEAD_H     = 46 * hs;
  const NECK_BOT   = HEAD_TOP + HEAD_H + 16 * hs;
  const SHOULDER_Y = NECK_BOT;
  const CHEST_Y    = SHOULDER_Y + 28 * hs;
  const WAIST_Y    = SHOULDER_Y + 88 * hs;
  const HIP_Y      = WAIST_Y    + 40 * hs;

  const inseamRatio = inseam / DEFAULT.inseam;
  const LEG_H       = 155 * hs * inseamRatio;
  const ANKLE_Y     = HIP_Y + LEG_H;

  const ARM_TOP_Y  = SHOULDER_Y + 6 * hs;
  const ARM_BOT_Y  = HIP_Y + 10 * hs;
  const ARM_TOP_HW = 14 * hs;
  const ARM_BOT_HW = 9  * hs;

  return {
    hs, SHOULDER_Y, CHEST_Y, WAIST_Y, HIP_Y, ANKLE_Y,
    ARM_TOP_Y, ARM_BOT_Y, ARM_TOP_HW, ARM_BOT_HW,
    shoulderHW, chestHW, waistHW, hipHW,
  };
}

// ─── colour helper ───────────────────────────────────────────────────────────

const COLOR_MAP: [RegExp, string][] = [
  [/black/i,                       "#1a1a1a"],
  [/white|cream|ivory|off.white/i, "#f5f0e8"],
  [/navy|dark.blue/i,              "#1e3a5f"],
  [/blue|denim|wash/i,             "#4a7fc1"],
  [/light.blue|ice.blue/i,         "#8fb7ff"],
  [/olive/i,                       "#6b7c45"],
  [/dark.green/i,                  "#1e4d2b"],
  [/sage.green|green/i,            "#4a7c5b"],
  [/beige|tan|khaki/i,             "#c8b89a"],
  [/brown|chocolate/i,             "#7c5c3a"],
  [/gray|grey/i,                   "#9ca3af"],
  [/red/i,                         "#c0392b"],
  [/orange/i,                      "#e07b39"],
  [/pink/i,                        "#e8a0b0"],
  [/yellow/i,                      "#d4a82a"],
  [/purple|violet/i,               "#7c5cd8"],
];

export function catalogColorToCSS(colorStr: string): string {
  for (const [re, css] of COLOR_MAP) {
    if (re.test(colorStr)) return css;
  }
  return "#9ca3af";
}

// ─── garment overlay paths ───────────────────────────────────────────────────
//
// Each garment is ONE closed SVG path so it reads as a single piece of fabric.
//
// Coordinate system (default measurements, VB_W=280, CX=140):
//   shoulderHW ≈ 23   chestHW ≈ 50   waistHW ≈ 42   hipHW ≈ 53
//   SHOULDER_Y ≈ 72   WAIST_Y ≈ 160  HIP_Y ≈ 200    ANKLE_Y ≈ 355
//   ARM_TOP_Y  ≈ 78   ARM_BOT_Y ≈ 210
//   Left arm pivot: CX - shoulderHW - 4 ≈ 113
//   Right arm pivot: CX + shoulderHW + 4 ≈ 167
//
// ── T-SHIRT path (traced counter-clockwise starting at left neck) ────────────
//
//   Neck notch (center-top, ~16px wide)
//   → across shoulder to left sleeve cap
//   → outer sleeve edge down to elbow (ARM_TOP_Y + ~42% of arm length)
//   → sleeve hem (horizontal, ~18px wide)
//   → inner sleeve edge back up to armpit
//   → body left side: shoulder→chest→waist→hem
//   → hem across bottom (HIP_Y)
//   → body right side (mirrored)
//   → right inner sleeve, sleeve hem, outer sleeve back up
//   → across right shoulder back to neck
//
// ── OUTERWEAR path ────────────────────────────────────────────────────────────
//   Same as shirt but:
//   - sleeves reach wrist (ARM_BOT_Y)
//   - body hem is HIP_Y + 18px (longer, like a jacket)
//   - shoulder pads 6px wider each side
//   - lapel V-notch at neck
//
// ── BOTTOM path ───────────────────────────────────────────────────────────────
//   Waistband rect (HIP_Y - 12 → HIP_Y) full hip width
//   Two separate leg shapes joined at crotch, each following the avatar's
//   leg silhouette + 3px outward padding.

export type GarmentBounds = { x: number; y: number; w: number; h: number };

export function buildGarmentPaths(g: AvatarGeometry): {
  shirtPath:     string;
  outerwearPath: string;
  waistbandPts:  string;
  leftLegPts:    string;
  rightLegPts:   string;
  shirtBounds:     GarmentBounds;
  outerwearBounds: GarmentBounds;
  bottomBounds:    GarmentBounds;
} {
  const cx = CX;
  const {
    hs, SHOULDER_Y, CHEST_Y, WAIST_Y, HIP_Y, ANKLE_Y,
    ARM_TOP_Y, ARM_BOT_Y, ARM_TOP_HW, ARM_BOT_HW,
    shoulderHW, chestHW, waistHW, hipHW,
  } = g;

  // ── arm geometry ────────────────────────────────────────────────────────────
  const lAX = cx - shoulderHW - 4;   // left arm centre-line x
  const rAX = cx + shoulderHW + 4;   // right arm centre-line x

  // T-shirt sleeve hem at ~elbow (42% down the arm length)
  const tSleeveHemY = ARM_TOP_Y + (ARM_BOT_Y - ARM_TOP_Y) * 0.42;
  // Sleeve width at elbow: interpolate between ARM_TOP_HW and ARM_BOT_HW
  const tSleeveHW   = ARM_TOP_HW * 0.58 + ARM_BOT_HW * 0.42; // ≈ 11.9

  // Outerwear sleeve hem at wrist
  const oSleeveHemY = ARM_BOT_Y;
  const oSleeveHW   = ARM_BOT_HW;                            // ≈ 9

  // Outerwear shoulder: 6px wider each side
  const oPad = 6;
  const oLAX = lAX - oPad;
  const oRAX = rAX + oPad;
  // Outerwear body hem: jacket falls ~18px below hip
  const oHemY = HIP_Y + 18 * hs;

  // ── neck notch ─────────────────────────────────────────────────────────────
  // The neck opening is a shallow V between the two shoulder points.
  // We place it 8px below SHOULDER_Y so the collar sits naturally.
  const neckW  = 14;    // half-width of neck opening
  const neckDY = 10;    // how deep the V dips below shoulder

  // ── T-SHIRT ─────────────────────────────────────────────────────────────────
  // Start: left neck edge, go clockwise around the whole garment.
  //
  // Left shoulder → left sleeve:
  //   outer sleeve outer edge: from (lAX, ARM_TOP_Y) to (lAX - tSleeveHW, tSleeveHemY)
  //   sleeve hem across:       (lAX - tSleeveHW, tSleeveHemY) → (lAX + tSleeveHW, tSleeveHemY)
  //   inner sleeve back up:    (lAX + tSleeveHW, tSleeveHemY) → armpit at (cx - shoulderHW, SHOULDER_Y)
  // Body left side (shoulder→waist→hip):
  //   (cx - shoulderHW, SHOULDER_Y) → ... bezier ... → (cx - hipHW, HIP_Y)
  // Hem across: (cx - hipHW, HIP_Y) → (cx + hipHW, HIP_Y)
  // Body right side (mirrored):
  //   (cx + hipHW, HIP_Y) → ... → (cx + shoulderHW, SHOULDER_Y)
  // Right sleeve (mirrored):
  // Across back to right neck, dip to neck V, back to left neck.

  const shirtPath = [
    // start: left neck-shoulder junction
    `M ${cx - neckW} ${SHOULDER_Y + neckDY}`,
    // neck V dip to centre
    `L ${cx} ${SHOULDER_Y + neckDY + 6}`,
    // right neck-shoulder junction
    `L ${cx + neckW} ${SHOULDER_Y + neckDY}`,
    // across right shoulder to right sleeve cap
    `L ${rAX} ${ARM_TOP_Y}`,
    // outer right sleeve edge down to elbow hem
    `L ${rAX + tSleeveHW} ${tSleeveHemY}`,
    // sleeve hem across (right sleeve bottom)
    `L ${rAX - tSleeveHW} ${tSleeveHemY}`,
    // inner right sleeve back up to armpit / right shoulder
    `L ${cx + shoulderHW} ${SHOULDER_Y}`,
    // body right side: shoulder → chest → waist → hip (bezier curves)
    `C ${cx + chestHW} ${CHEST_Y}, ${cx + chestHW} ${CHEST_Y}, ${cx + chestHW} ${CHEST_Y}`,
    `C ${cx + chestHW} ${WAIST_Y}, ${cx + waistHW} ${WAIST_Y}, ${cx + waistHW} ${WAIST_Y}`,
    `C ${cx + waistHW} ${HIP_Y},   ${cx + hipHW}   ${HIP_Y},   ${cx + hipHW}   ${HIP_Y}`,
    // hem across bottom
    `L ${cx - hipHW} ${HIP_Y}`,
    // body left side: hip → waist → chest → shoulder (bezier curves)
    `C ${cx - hipHW}   ${HIP_Y},   ${cx - waistHW} ${HIP_Y},   ${cx - waistHW} ${WAIST_Y}`,
    `C ${cx - waistHW} ${WAIST_Y}, ${cx - chestHW} ${WAIST_Y}, ${cx - chestHW} ${CHEST_Y}`,
    `C ${cx - chestHW} ${CHEST_Y}, ${cx - shoulderHW} ${CHEST_Y}, ${cx - shoulderHW} ${SHOULDER_Y}`,
    // left armpit → inner left sleeve edge down to elbow hem
    `L ${lAX - tSleeveHW} ${tSleeveHemY}`,
    // sleeve hem across (left sleeve bottom)
    `L ${lAX + tSleeveHW} ${tSleeveHemY}`,
    // outer left sleeve edge back up to shoulder cap
    `L ${lAX} ${ARM_TOP_Y}`,
    // across left shoulder back to start
    `L ${cx - neckW} ${SHOULDER_Y + neckDY}`,
    "Z",
  ].join(" ");

  // ── OUTERWEAR ────────────────────────────────────────────────────────────────
  // Like the shirt but longer sleeves, wider shoulders, jacket hem, lapel notch.
  const lapelDY = 18; // lapel V goes deeper

  const outerwearPath = [
    // left lapel edge
    `M ${cx - neckW - 2} ${SHOULDER_Y + lapelDY}`,
    // lapel V
    `L ${cx} ${SHOULDER_Y + lapelDY + 10}`,
    // right lapel edge
    `L ${cx + neckW + 2} ${SHOULDER_Y + lapelDY}`,
    // across right shoulder (wider)
    `L ${oRAX} ${ARM_TOP_Y}`,
    // outer right sleeve down to wrist
    `L ${oRAX + oSleeveHW + 4} ${oSleeveHemY}`,
    // sleeve hem (right wrist)
    `L ${oRAX - oSleeveHW} ${oSleeveHemY}`,
    // inner right sleeve back up to armpit
    `L ${cx + shoulderHW + oPad} ${SHOULDER_Y}`,
    // body right side (slightly wider)
    `C ${cx + chestHW + oPad} ${CHEST_Y}, ${cx + chestHW + oPad} ${CHEST_Y}, ${cx + chestHW + oPad} ${CHEST_Y}`,
    `C ${cx + chestHW + oPad} ${WAIST_Y}, ${cx + waistHW + oPad} ${WAIST_Y}, ${cx + waistHW + oPad} ${WAIST_Y}`,
    `C ${cx + waistHW + oPad} ${oHemY},   ${cx + hipHW + oPad}   ${oHemY},   ${cx + hipHW + oPad}   ${oHemY}`,
    // jacket hem
    `L ${cx - hipHW - oPad} ${oHemY}`,
    // body left side
    `C ${cx - hipHW - oPad}   ${oHemY},   ${cx - waistHW - oPad} ${oHemY},   ${cx - waistHW - oPad} ${WAIST_Y}`,
    `C ${cx - waistHW - oPad} ${WAIST_Y}, ${cx - chestHW - oPad} ${WAIST_Y}, ${cx - chestHW - oPad} ${CHEST_Y}`,
    `C ${cx - chestHW - oPad} ${CHEST_Y}, ${cx - shoulderHW - oPad} ${CHEST_Y}, ${cx - shoulderHW - oPad} ${SHOULDER_Y}`,
    // left armpit → inner left sleeve
    `L ${oLAX + oSleeveHW} ${oSleeveHemY}`,
    // sleeve hem (left wrist)
    `L ${oLAX - oSleeveHW - 4} ${oSleeveHemY}`,
    // outer left sleeve back up to shoulder
    `L ${oLAX} ${ARM_TOP_Y}`,
    // across left shoulder to start
    `L ${cx - neckW - 2} ${SHOULDER_Y + lapelDY}`,
    "Z",
  ].join(" ");

  // ── BOTTOM (TROUSERS) ───────────────────────────────────────────────────────
  // Waistband: rect across full hip width, 12px tall, sitting at HIP_Y - 12
  const wbY    = HIP_Y - 12 * hs;
  const wbH    = 12 * hs;

  const waistbandPts = [
    `${cx - hipHW},${wbY}`,
    `${cx + hipHW},${wbY}`,
    `${cx + hipHW},${wbY + wbH}`,
    `${cx - hipHW},${wbY + wbH}`,
  ].join(" ");

  // Two leg shapes. Each follows the avatar's leg path (THIGH→KNEE→ANKLE)
  // with +3px outward padding, plus crotch gusset so legs join at top.
  //
  // Avatar leg geometry (from Avatar.tsx):
  //   THIGH_HW  = hipHW * 0.38
  //   KNEE_HW   = THIGH_HW * 0.75
  //   ANKLE_HW  = KNEE_HW * 0.6
  //   leftLegX  = cx - hipHW * 0.5
  //   rightLegX = cx + hipHW * 0.5
  //   leg half-height = LH = ANKLE_Y - HIP_Y

  const LH       = ANKLE_Y - HIP_Y;
  const THIGH_HW = hipHW * 0.38;
  const KNEE_HW  = THIGH_HW * 0.75;
  const ANKLE_HW = KNEE_HW  * 0.6;
  const pad      = 3;   // outward padding to sit just outside the avatar skin

  const lLX = cx - hipHW * 0.5;
  // Left leg: outer = cx-hipHW side, inner = toward centre
  // Outer points widen by pad, inner crotch closes to centre line
  const leftLegPts = [
    // top-left (outer hip)
    `${cx - hipHW - pad},${HIP_Y}`,
    // crotch centre at top — slight Y dip for crotch gusset
    `${cx - pad},${HIP_Y + LH * 0.06}`,
    // inner leg down to ankle-inner
    `${lLX + ANKLE_HW + pad},${ANKLE_Y}`,
    // ankle hem across
    `${lLX - ANKLE_HW - pad},${ANKLE_Y}`,
    // outer leg up via knee to thigh
    `${lLX - KNEE_HW - pad},${HIP_Y + LH * 0.5}`,
  ].join(" ");

  const rLX = cx + hipHW * 0.5;
  const rightLegPts = [
    // crotch centre
    `${cx + pad},${HIP_Y + LH * 0.06}`,
    // top-right (outer hip)
    `${cx + hipHW + pad},${HIP_Y}`,
    // outer leg down via knee to ankle-outer
    `${rLX + KNEE_HW + pad},${HIP_Y + LH * 0.5}`,
    // ankle hem across
    `${rLX + ANKLE_HW + pad},${ANKLE_Y}`,
    `${rLX - ANKLE_HW - pad},${ANKLE_Y}`,
    // inner leg back up
  ].join(" ");

  // ── bounding boxes ──────────────────────────────────────────────────────────
  // shirt: spans from outer left sleeve edge to outer right, top is ARM_TOP_Y
  const shirtL = lAX - tSleeveHW;
  const shirtR = rAX + tSleeveHW;
  const shirtBounds: GarmentBounds = {
    x: shirtL,
    y: ARM_TOP_Y,
    w: shirtR - shirtL,
    h: HIP_Y - ARM_TOP_Y,
  };

  // outerwear: wider sleeves, longer hem
  const outerL = oLAX - oSleeveHW - 4;
  const outerR = oRAX + oSleeveHW + 4;
  const outerwearBounds: GarmentBounds = {
    x: outerL,
    y: ARM_TOP_Y,
    w: outerR - outerL,
    h: oHemY - ARM_TOP_Y,
  };

  // bottom: waistband top → ankle bottom, full hip width + pad
  const bottomBounds: GarmentBounds = {
    x: cx - hipHW - pad,
    y: wbY,
    w: (hipHW + pad) * 2,
    h: ANKLE_Y - wbY,
  };

  return {
    shirtPath, outerwearPath, waistbandPts, leftLegPts, rightLegPts,
    shirtBounds, outerwearBounds, bottomBounds,
  };
}

// ─── overlay components ───────────────────────────────────────────────────────

export function GarmentOverlays({
  g, outfit, clipPrefix = "avatar",
}: {
  g: AvatarGeometry;
  outfit: OutfitState | null | undefined;
  clipPrefix?: string;
}) {
  if (!outfit) return null;
  const {
    shirtPath, outerwearPath, waistbandPts, leftLegPts, rightLegPts,
    shirtBounds, outerwearBounds, bottomBounds,
  } = buildGarmentPaths(g);

  const p = clipPrefix; // short alias for IDs

  return (
    <>
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

      {/* bottom first (behind top) */}
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

      {/* top over bottom */}
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
            opacity={0.78} stroke={catalogColorToCSS(outfit.top.color)}
            strokeWidth="0.5" strokeLinejoin="round" />
        )
      )}

      {/* outerwear over top */}
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
            opacity={0.72} stroke={catalogColorToCSS(outfit.outerwear.color)}
            strokeWidth="0.5" strokeLinejoin="round" />
        )
      )}
    </>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

type Props = {
  measurements: Measurements;
  outfit?: OutfitState | null;
};

export default function Avatar({ measurements, outfit }: Props) {
  const h      = resolve(measurements.height, DEFAULT.height);
  const inseam = resolve(measurements.inseam, DEFAULT.inseam);
  const hs     = h / DEFAULT.height;

  const shoulderHW = toHalfW(measurements.shoulderWidth, DEFAULT.shoulderWidth);
  const chestHW    = toHalfW(measurements.chest,         DEFAULT.chest);
  const waistHW    = toHalfW(measurements.waist,         DEFAULT.waist);
  const hipHW      = toHalfW(measurements.hip,           DEFAULT.hip);

  const HEAD_TOP   = 10 * hs;
  const HEAD_H     = 46 * hs;
  const HEAD_R     = HEAD_H / 2;
  const HEAD_CY    = HEAD_TOP + HEAD_R;

  const NECK_TOP   = HEAD_TOP + HEAD_H;
  const NECK_BOT   = NECK_TOP + 16 * hs;
  const NECK_HW    = 10;

  const SHOULDER_Y = NECK_BOT;
  const CHEST_Y    = SHOULDER_Y + 28 * hs;
  const WAIST_Y    = SHOULDER_Y + 88 * hs;
  const HIP_Y      = WAIST_Y    + 40 * hs;

  const inseamRatio = inseam / DEFAULT.inseam;
  const LEG_H       = 155 * hs * inseamRatio;
  const ANKLE_Y     = HIP_Y + LEG_H;
  const FOOT_BOT    = ANKLE_Y + 10 * hs;

  const THIGH_HW   = hipHW * 0.38;
  const KNEE_HW    = THIGH_HW * 0.75;
  const ANKLE_HW   = KNEE_HW  * 0.6;
  const FOOT_HW    = ANKLE_HW * 1.4;
  const FOOT_TOE_X = FOOT_HW  * 1.6;

  const ARM_TOP_HW = 14 * hs;
  const ARM_BOT_HW = 9  * hs;
  const ARM_BOT_Y  = HIP_Y + 10 * hs;
  const ARM_TOP_Y  = SHOULDER_Y + 6 * hs;

  const torsoPath = [
    `M ${CX - shoulderHW} ${SHOULDER_Y}`,
    `C ${CX - shoulderHW} ${CHEST_Y}, ${CX - chestHW} ${CHEST_Y}, ${CX - chestHW} ${CHEST_Y}`,
    `C ${CX - chestHW} ${WAIST_Y}, ${CX - waistHW} ${WAIST_Y}, ${CX - waistHW} ${WAIST_Y}`,
    `C ${CX - waistHW} ${HIP_Y}, ${CX - hipHW} ${HIP_Y}, ${CX - hipHW} ${HIP_Y}`,
    `L ${CX + hipHW} ${HIP_Y}`,
    `C ${CX + hipHW} ${HIP_Y}, ${CX + waistHW} ${HIP_Y}, ${CX + waistHW} ${WAIST_Y}`,
    `C ${CX + waistHW} ${WAIST_Y}, ${CX + chestHW} ${WAIST_Y}, ${CX + chestHW} ${CHEST_Y}`,
    `C ${CX + chestHW} ${CHEST_Y}, ${CX + shoulderHW} ${CHEST_Y}, ${CX + shoulderHW} ${SHOULDER_Y}`,
    "Z",
  ].join(" ");

  const leftLegX    = CX - hipHW * 0.5;
  const leftLegPath = [
    `M ${leftLegX - THIGH_HW} ${HIP_Y}`,
    `L ${leftLegX - KNEE_HW}  ${HIP_Y + LEG_H * 0.5}`,
    `L ${leftLegX - ANKLE_HW} ${ANKLE_Y}`,
    `L ${leftLegX - ANKLE_HW} ${FOOT_BOT}`,
    `L ${leftLegX + FOOT_TOE_X} ${FOOT_BOT}`,
    `L ${leftLegX + FOOT_HW}  ${ANKLE_Y}`,
    `L ${leftLegX + KNEE_HW}  ${HIP_Y + LEG_H * 0.5}`,
    `L ${leftLegX + THIGH_HW} ${HIP_Y}`,
    "Z",
  ].join(" ");

  const rightLegX    = CX + hipHW * 0.5;
  const rightLegPath = [
    `M ${rightLegX - THIGH_HW} ${HIP_Y}`,
    `L ${rightLegX - KNEE_HW}  ${HIP_Y + LEG_H * 0.5}`,
    `L ${rightLegX - ANKLE_HW} ${ANKLE_Y}`,
    `L ${rightLegX - ANKLE_HW} ${FOOT_BOT}`,
    `L ${rightLegX + FOOT_TOE_X} ${FOOT_BOT}`,
    `L ${rightLegX + FOOT_HW}  ${ANKLE_Y}`,
    `L ${rightLegX + KNEE_HW}  ${HIP_Y + LEG_H * 0.5}`,
    `L ${rightLegX + THIGH_HW} ${HIP_Y}`,
    "Z",
  ].join(" ");

  const leftArmX    = CX - shoulderHW - 4;
  const leftArmPath = [
    `M ${leftArmX} ${ARM_TOP_Y}`,
    `C ${leftArmX - ARM_TOP_HW} ${ARM_TOP_Y}, ${leftArmX - ARM_TOP_HW} ${ARM_TOP_Y + 20 * hs}, ${leftArmX - ARM_BOT_HW} ${ARM_BOT_Y}`,
    `L ${leftArmX + ARM_BOT_HW * 0.5} ${ARM_BOT_Y}`,
    `C ${leftArmX + ARM_TOP_HW * 0.3} ${ARM_TOP_Y + 20 * hs}, ${leftArmX + ARM_TOP_HW * 0.3} ${ARM_TOP_Y}, ${leftArmX} ${ARM_TOP_Y}`,
    "Z",
  ].join(" ");

  const rightArmX    = CX + shoulderHW + 4;
  const rightArmPath = [
    `M ${rightArmX} ${ARM_TOP_Y}`,
    `C ${rightArmX + ARM_TOP_HW} ${ARM_TOP_Y}, ${rightArmX + ARM_TOP_HW} ${ARM_TOP_Y + 20 * hs}, ${rightArmX + ARM_BOT_HW} ${ARM_BOT_Y}`,
    `L ${rightArmX - ARM_BOT_HW * 0.5} ${ARM_BOT_Y}`,
    `C ${rightArmX - ARM_TOP_HW * 0.3} ${ARM_TOP_Y + 20 * hs}, ${rightArmX - ARM_TOP_HW * 0.3} ${ARM_TOP_Y}, ${rightArmX} ${ARM_TOP_Y}`,
    "Z",
  ].join(" ");

  const geo: AvatarGeometry = {
    hs, SHOULDER_Y, CHEST_Y, WAIST_Y, HIP_Y, ANKLE_Y,
    ARM_TOP_Y, ARM_BOT_Y, ARM_TOP_HW, ARM_BOT_HW,
    shoulderHW, chestHW, waistHW, hipHW,
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width={VB_W}
        height={VB_H}
        aria-label="Body silhouette"
      >
        {/* ── Head ── */}
        <ellipse cx={CX} cy={HEAD_CY} rx={HEAD_R * 0.78} ry={HEAD_R}
          fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />

        {/* ── Neck ── */}
        <rect x={CX - NECK_HW} y={NECK_TOP} width={NECK_HW * 2} height={NECK_BOT - NECK_TOP}
          fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />

        {/* ── Arms (behind torso) ── */}
        <path d={leftArmPath}  fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={rightArmPath} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />

        {/* ── Torso ── */}
        <path d={torsoPath} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />

        {/* ── Legs ── */}
        <path d={leftLegPath}  fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={rightLegPath} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />

        {/* ── Anchor lines ── */}
        <line x1={CX - shoulderHW} y1={SHOULDER_Y} x2={CX + shoulderHW} y2={SHOULDER_Y}
          stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
        <line x1={CX - waistHW} y1={WAIST_Y} x2={CX + waistHW} y2={WAIST_Y}
          stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
        <line x1={CX - hipHW} y1={HIP_Y} x2={CX + hipHW} y2={HIP_Y}
          stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />

        {/* ── Garment overlays ── */}
        <GarmentOverlays g={geo} outfit={outfit} />
      </svg>
    </div>
  );
}
