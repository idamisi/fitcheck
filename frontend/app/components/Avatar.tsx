"use client";

import { Measurements } from "./MeasurementForm";

// ─── defaults ────────────────────────────────────────────────────────────────
// All measurement defaults are in centimetres and represent an average adult.
const DEFAULT: Required<Measurements> = {
  height: 170,
  shoulderWidth: 42,
  chest: 90,
  waist: 75,
  hip: 95,
  inseam: 80,
};

// ─── SVG canvas ──────────────────────────────────────────────────────────────
const VB_W = 280; // viewBox width — wider to fit arms
const VB_H = 420; // viewBox height
const CX = VB_W / 2; // horizontal centre

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Resolve a measurement: if 0 (initial/empty) fall back to the default. */
function resolve(val: number, def: number): number {
  return val > 0 ? val : def;
}

/**
 * Map a real-world half-width (cm) to SVG half-width (units).
 * We treat DEFAULT.chest circumference → 50 SVG units each side as the
 * baseline, then scale other measurements proportionally.
 *
 * chest circumference ÷ π gives the "diameter" of a cylinder; we halve that
 * for the radius. But here we're working with a flat silhouette, so we simply
 * treat the measurement as a width proxy.
 */
const SVG_HALF_WIDTH_SCALE = 50 / (DEFAULT.chest / 2); // SVG units per cm

function toHalfW(cm: number, defaultCm: number): number {
  const resolved = resolve(cm, defaultCm);
  return (resolved / 2) * SVG_HALF_WIDTH_SCALE;
}

// ─── component ───────────────────────────────────────────────────────────────

type Props = {
  measurements: Measurements;
};

export default function Avatar({ measurements }: Props) {
  const h = resolve(measurements.height, DEFAULT.height);
  const inseam = resolve(measurements.inseam, DEFAULT.inseam);

  // Scale the whole figure height relative to default.
  const heightScale = h / DEFAULT.height;

  // Half-widths in SVG units
  const shoulderHW = toHalfW(measurements.shoulderWidth, DEFAULT.shoulderWidth);
  const chestHW = toHalfW(measurements.chest, DEFAULT.chest);
  const waistHW = toHalfW(measurements.waist, DEFAULT.waist);
  const hipHW = toHalfW(measurements.hip, DEFAULT.hip);

  // ── vertical landmarks (in SVG units, scaled by height) ──────────────────
  // We allocate the 400-unit canvas as follows (based on default proportions):
  //   head top  :   0
  //   chin      :  56   (head ≈ head_h)
  //   shoulder  :  72
  //   chest     :  96
  //   waist     : 148
  //   hip       : 184  ← hem line (bottom of torso / top of legs)
  //   ankle     : 370
  //   foot bot  : 380
  //
  // The torso block (shoulder→hip) is fixed in proportion; legs stretch based
  // on inseam ratio.

  const HEAD_TOP = 10 * heightScale;
  const HEAD_H = 46 * heightScale;
  const HEAD_R = HEAD_H / 2;
  const HEAD_CY = HEAD_TOP + HEAD_R;

  const NECK_TOP = HEAD_TOP + HEAD_H;
  const NECK_BOT = NECK_TOP + 16 * heightScale;
  const NECK_HW = 10; // constant — necks don't vary much in silhouette

  const SHOULDER_Y = NECK_BOT; // anchor: shoulder line
  const CHEST_Y = SHOULDER_Y + 28 * heightScale;
  const WAIST_Y = SHOULDER_Y + 88 * heightScale; // anchor: waist line
  const HIP_Y = WAIST_Y + 40 * heightScale; // anchor: hem line

  // Legs scale by inseam ratio relative to default inseam.
  const inseamRatio = inseam / DEFAULT.inseam;
  const LEG_H = 155 * heightScale * inseamRatio;
  const ANKLE_Y = HIP_Y + LEG_H;
  const FOOT_BOT = ANKLE_Y + 10 * heightScale;

  // Leg/foot widths
  const THIGH_HW = hipHW * 0.38;
  const KNEE_HW = THIGH_HW * 0.75;
  const ANKLE_HW = KNEE_HW * 0.6;
  const FOOT_HW = ANKLE_HW * 1.4;
  const FOOT_TOE_X = FOOT_HW * 1.6; // toe extends forward (right of centre)

  // Arm widths
  const ARM_TOP_HW = 14 * heightScale;
  const ARM_BOT_HW = 9 * heightScale;

  // Arm bottom Y ≈ same as HIP_Y (arms reach roughly to hip)
  const ARM_BOT_Y = HIP_Y + 10 * heightScale;
  const ARM_TOP_Y = SHOULDER_Y + 6 * heightScale;

  // ── torso path (shoulder → chest → waist → hip) ──────────────────────────
  // Uses cubic bezier curves for organic shape transitions.
  const torsoPath = [
    `M ${CX - shoulderHW} ${SHOULDER_Y}`,
    // left side: shoulder → chest → waist → hip
    `C ${CX - shoulderHW} ${CHEST_Y}, ${CX - chestHW} ${CHEST_Y}, ${CX - chestHW} ${CHEST_Y}`,
    `C ${CX - chestHW} ${WAIST_Y}, ${CX - waistHW} ${WAIST_Y}, ${CX - waistHW} ${WAIST_Y}`,
    `C ${CX - waistHW} ${HIP_Y}, ${CX - hipHW} ${HIP_Y}, ${CX - hipHW} ${HIP_Y}`,
    // bottom across hips
    `L ${CX + hipHW} ${HIP_Y}`,
    // right side: hip → waist → chest → shoulder
    `C ${CX + hipHW} ${HIP_Y}, ${CX + waistHW} ${HIP_Y}, ${CX + waistHW} ${WAIST_Y}`,
    `C ${CX + waistHW} ${WAIST_Y}, ${CX + chestHW} ${WAIST_Y}, ${CX + chestHW} ${CHEST_Y}`,
    `C ${CX + chestHW} ${CHEST_Y}, ${CX + shoulderHW} ${CHEST_Y}, ${CX + shoulderHW} ${SHOULDER_Y}`,
    "Z",
  ].join(" ");

  // ── left leg path ─────────────────────────────────────────────────────────
  const leftLegX = CX - hipHW * 0.5;
  const leftLegPath = [
    `M ${leftLegX - THIGH_HW} ${HIP_Y}`,
    `L ${leftLegX - KNEE_HW} ${HIP_Y + LEG_H * 0.5}`,
    `L ${leftLegX - ANKLE_HW} ${ANKLE_Y}`,
    `L ${leftLegX - ANKLE_HW} ${FOOT_BOT}`,
    `L ${leftLegX + FOOT_TOE_X} ${FOOT_BOT}`,
    `L ${leftLegX + FOOT_HW} ${ANKLE_Y}`,
    `L ${leftLegX + KNEE_HW} ${HIP_Y + LEG_H * 0.5}`,
    `L ${leftLegX + THIGH_HW} ${HIP_Y}`,
    "Z",
  ].join(" ");

  // ── right leg path ────────────────────────────────────────────────────────
  const rightLegX = CX + hipHW * 0.5;
  const rightLegPath = [
    `M ${rightLegX - THIGH_HW} ${HIP_Y}`,
    `L ${rightLegX - KNEE_HW} ${HIP_Y + LEG_H * 0.5}`,
    `L ${rightLegX - ANKLE_HW} ${ANKLE_Y}`,
    `L ${rightLegX - ANKLE_HW} ${FOOT_BOT}`,
    `L ${rightLegX + FOOT_TOE_X} ${FOOT_BOT}`,
    `L ${rightLegX + FOOT_HW} ${ANKLE_Y}`,
    `L ${rightLegX + KNEE_HW} ${HIP_Y + LEG_H * 0.5}`,
    `L ${rightLegX + THIGH_HW} ${HIP_Y}`,
    "Z",
  ].join(" ");

  // ── left arm path ─────────────────────────────────────────────────────────
  // Arms hang straight down from the shoulder, slightly away from the torso
  const leftArmX = CX - shoulderHW - 4;
  const leftArmPath = [
    `M ${leftArmX} ${ARM_TOP_Y}`,
    `C ${leftArmX - ARM_TOP_HW} ${ARM_TOP_Y}, ${leftArmX - ARM_TOP_HW} ${ARM_TOP_Y + 20 * heightScale}, ${leftArmX - ARM_BOT_HW} ${ARM_BOT_Y}`,
    `L ${leftArmX + ARM_BOT_HW * 0.5} ${ARM_BOT_Y}`,
    `C ${leftArmX + ARM_TOP_HW * 0.3} ${ARM_TOP_Y + 20 * heightScale}, ${leftArmX + ARM_TOP_HW * 0.3} ${ARM_TOP_Y}, ${leftArmX} ${ARM_TOP_Y}`,
    "Z",
  ].join(" ");

  // ── right arm path ────────────────────────────────────────────────────────
  const rightArmX = CX + shoulderHW + 4;
  const rightArmPath = [
    `M ${rightArmX} ${ARM_TOP_Y}`,
    `C ${rightArmX + ARM_TOP_HW} ${ARM_TOP_Y}, ${rightArmX + ARM_TOP_HW} ${ARM_TOP_Y + 20 * heightScale}, ${rightArmX + ARM_BOT_HW} ${ARM_BOT_Y}`,
    `L ${rightArmX - ARM_BOT_HW * 0.5} ${ARM_BOT_Y}`,
    `C ${rightArmX - ARM_TOP_HW * 0.3} ${ARM_TOP_Y + 20 * heightScale}, ${rightArmX - ARM_TOP_HW * 0.3} ${ARM_TOP_Y}, ${rightArmX} ${ARM_TOP_Y}`,
    "Z",
  ].join(" ");

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width={VB_W}
        height={VB_H}
        aria-label="Body silhouette"
      >
        {/* ── Head ── */}
        <ellipse
          cx={CX}
          cy={HEAD_CY}
          rx={HEAD_R * 0.78}
          ry={HEAD_R}
          fill="#d1d5db"
          stroke="#9ca3af"
          strokeWidth="1.5"
        />

        {/* ── Neck ── */}
        <rect
          x={CX - NECK_HW}
          y={NECK_TOP}
          width={NECK_HW * 2}
          height={NECK_BOT - NECK_TOP}
          fill="#d1d5db"
          stroke="#9ca3af"
          strokeWidth="1.5"
        />

        {/* ── Arms (behind torso) ── */}
        <path d={leftArmPath} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={rightArmPath} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />

        {/* ── Torso ── */}
        <path d={torsoPath} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />

        {/* ── Legs ── */}
        <path d={leftLegPath} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={rightLegPath} fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" />

        {/* ── Anchor: shoulder line ── */}
        <g id="shoulder-line" data-y={SHOULDER_Y}>
          <line
            x1={CX - shoulderHW}
            y1={SHOULDER_Y}
            x2={CX + shoulderHW}
            y2={SHOULDER_Y}
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.6"
          />
        </g>

        {/* ── Anchor: waist line ── */}
        <g id="waist-line" data-y={WAIST_Y}>
          <line
            x1={CX - waistHW}
            y1={WAIST_Y}
            x2={CX + waistHW}
            y2={WAIST_Y}
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.6"
          />
        </g>

        {/* ── Anchor: hem line ── */}
        <g id="hem-line" data-y={HIP_Y}>
          <line
            x1={CX - hipHW}
            y1={HIP_Y}
            x2={CX + hipHW}
            y2={HIP_Y}
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.6"
          />
        </g>
      </svg>

    </div>
  );
}
