import React, { useState } from "react";

/**
 * SetIcon — renders a Scryfall set SVG icon with fallback to set_code text.
 *
 * Props:
 *   setSvgUri  – string | null  (URL to the SVG set symbol)
 *   setCode    – string | null  (e.g. "neo", "cmm")
 *   size       – number         (px, default 14)
 *   className  – string
 */
export default function SetIcon({ setSvgUri, setCode, size = 14, className = "" }) {
  const [failed, setFailed] = useState(false);

  const showSvg = setSvgUri && !failed;

  if (showSvg) {
    return (
      <span
        className={`inline-flex items-center justify-center flex-shrink-0 rounded-full ${className}`}
        style={{
          width: size + 4,
          height: size + 4,
          background: "rgba(255,255,255,0.08)",
          padding: 2,
        }}
        title={setCode || undefined}
      >
        <img
          src={setSvgUri}
          alt={setCode ? `${setCode} set icon` : "set icon"}
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            // Most Scryfall set SVGs are black — invert + adjust brightness for dark bg
            filter: "invert(1) brightness(0.75)",
            display: "block",
          }}
          onError={() => setFailed(true)}
          draggable={false}
          loading="lazy"
        />
      </span>
    );
  }

  // Fallback: text set code
  if (setCode) {
    return (
      <span
        className={`inline-flex items-center flex-shrink-0 font-mono uppercase text-gray-500 ${className}`}
        style={{ fontSize: size - 2, lineHeight: 1 }}
        title={setCode}
      >
        {setCode}
      </span>
    );
  }

  // Nothing to show
  return null;
}