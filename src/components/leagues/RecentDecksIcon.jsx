import React from "react";

// Fixed color order for segmented display
const COLOR_ORDER = ["W", "U", "B", "R", "G"];

// Color tokens optimized for dark UI
const COLOR_MAP = {
  W: "#e8e3d5", // near-white / warm neutral
  U: "#3b82f6", // blue
  B: "#374151", // dark gray / near-black
  R: "#ef4444", // red
  G: "#22c55e", // green
};

const GRAY = "#6b7280"; // colorless / neutral gray

/**
 * Builds a CSS conic-gradient string for N equal color slices.
 * Slices appear in the fixed W→U→B→R→G order.
 */
function buildConicGradient(colors) {
  const n = colors.length;
  if (n === 0) return `conic-gradient(${GRAY} 0deg 360deg)`;
  if (n === 1) return `conic-gradient(${COLOR_MAP[colors[0]] ?? GRAY} 0deg 360deg)`;

  const sliceSize = 360 / n;
  const stops = colors.flatMap((c, i) => {
    const hex = COLOR_MAP[c] ?? GRAY;
    const start = i * sliceSize;
    const end = (i + 1) * sliceSize;
    return [`${hex} ${start}deg`, `${hex} ${end}deg`];
  });

  return `conic-gradient(${stops.join(", ")})`;
}

/**
 * RecentDecksIcon — compact circular deck color identity icon.
 *
 * Props:
 *   colors   — string[]  e.g. ["W","U"] | ["C"] | []
 *   variant  — "deck" | "colorless" | "didNotPlay"
 *   size     — number (px, default 18)
 *   title    — string (tooltip / aria-label)
 */
export default function RecentDecksIcon({
  colors = [],
  variant,
  size = 18,
  title,
}) {
  // --- Resolve what to render ---

  // 1) Explicit "did not play"
  if (variant === "didNotPlay") {
    return (
      <span
        title={title ?? "Did not play"}
        aria-label={title ?? "Did not play"}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          border: `${Math.max(2, Math.round(size * 0.12))}px solid #6b7280`,
          background: "transparent",
          flexShrink: 0,
        }}
      />
    );
  }

  // 2) Colorless shortcut
  if (variant === "colorless") {
    return (
      <span
        title={title ?? "Colorless"}
        aria-label={title ?? "Colorless"}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          background: GRAY,
          border: `${Math.max(1, Math.round(size * 0.07))}px solid rgba(255,255,255,0.15)`,
          flexShrink: 0,
        }}
      />
    );
  }

  // 3) Normalize colors array
  // Filter to only known MTG colors (exclude C and unknowns)
  const knownColors = COLOR_ORDER.filter(
    (c) => colors.includes(c)
  );

  // Colorless: empty, only ["C"], or all-unknown input
  const isColorless =
    knownColors.length === 0;

  if (isColorless) {
    return (
      <span
        title={title ?? "Colorless"}
        aria-label={title ?? "Colorless"}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          background: GRAY,
          border: `${Math.max(1, Math.round(size * 0.07))}px solid rgba(255,255,255,0.15)`,
          flexShrink: 0,
        }}
      />
    );
  }

  // 4) Segmented (or solid single-color) deck
  const gradient = buildConicGradient(knownColors);
  const borderWidth = Math.max(1, Math.round(size * 0.07));
  const defaultTitle = knownColors.join("/");

  return (
    <span
      title={title ?? defaultTitle}
      aria-label={title ?? defaultTitle}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: gradient,
        border: `${borderWidth}px solid rgba(255,255,255,0.18)`,
        flexShrink: 0,
      }}
    />
  );
}