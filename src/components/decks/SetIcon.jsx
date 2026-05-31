import React, { useState } from "react";

/**
 * SetIcon — renders a Scryfall set SVG icon with fallback to set_code text.
 *
 * Scryfall set icons are black SVGs on transparent backgrounds.
 * We invert them so they appear light on the dark PodArena background.
 *
 * Props:
 *   setSvgUri  – string | null  (URL to the SVG set symbol from sets API)
 *   setCode    – string | null  (e.g. "neo", "cmm")
 *   size       – number         (px, default 16)
 *   className  – string
 */
export default function SetIcon({ setSvgUri, setCode, size = 16, className = "" }) {
  const [failed, setFailed] = useState(false);

  const showSvg = setSvgUri && !failed;

  if (showSvg) {
    return (
      <img
        src={setSvgUri}
        alt={setCode ? `${setCode} set icon` : "set icon"}
        width={size}
        height={size}
        className={`flex-shrink-0 inline-block ${className}`}
        style={{
          width: size,
          height: size,
          // Scryfall set SVGs are black — invert makes them white on dark bg
          filter: "invert(1) opacity(0.65)",
          display: "inline-block",
          verticalAlign: "middle",
        }}
        onError={() => setFailed(true)}
        draggable={false}
        loading="lazy"
      />
    );
  }

  // Fallback: uppercase text set code
  if (setCode) {
    return (
      <span
        className={`flex-shrink-0 font-mono uppercase text-gray-500 ${className}`}
        style={{ fontSize: Math.max(size - 4, 8), lineHeight: 1 }}
        title={setCode}
      >
        {setCode.toUpperCase()}
      </span>
    );
  }

  return null;
}