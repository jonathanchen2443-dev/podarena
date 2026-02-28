import React from "react";

// Inline SVG icons per color symbol
function PipIcon({ symbol }) {
  switch (symbol) {
    case "W": // Sun
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="60%" height="60%">
          <circle cx="8" cy="8" r="3" />
          {[0,45,90,135,180,225,270,315].map((deg, i) => {
            const r = Math.PI * deg / 180;
            const x1 = 8 + 5.5 * Math.cos(r), y1 = 8 + 5.5 * Math.sin(r);
            const x2 = 8 + 7.2 * Math.cos(r), y2 = 8 + 7.2 * Math.sin(r);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />;
          })}
        </svg>
      );
    case "U": // Water drop
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="60%" height="60%">
          <path d="M8 2 C8 2 3 8 3 11 A5 5 0 0 0 13 11 C13 8 8 2 8 2Z" />
        </svg>
      );
    case "B": // Skull
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="60%" height="60%">
          <path d="M8 2a5 5 0 0 0-5 5c0 2 1 3.5 2.5 4.2V13h5v-1.8C12 10.5 13 9 13 7a5 5 0 0 0-5-5zm-1.5 9h-1v-1h1v1zm3 0h-1v-1h1v1z" />
        </svg>
      );
    case "R": // Flame
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="60%" height="60%">
          <path d="M8 2c0 0-4 4-4 7a4 4 0 0 0 8 0c0-1.5-1-2.5-1-2.5s0 2-2 2c0 0 1-3-1-6.5z" />
        </svg>
      );
    case "G": // Tree / leaf
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="60%" height="60%">
          <path d="M8 2 L2 11 h4 v3 h4 v-3 h4 Z" />
        </svg>
      );
    case "C": // Diamond
    default:
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="60%" height="60%">
          <path d="M8 2 L14 8 L8 14 L2 8 Z" />
        </svg>
      );
  }
}

const PIP_STYLES = {
  W: { bg: "#f9e4a0", icon: "#7a5c00", border: "#d4a800" },
  U: { bg: "#2563eb", icon: "#bfdbfe", border: "#1d4ed8" },
  B: { bg: "#1f1f2e", icon: "#c4b5fd", border: "#4c1d95" },
  R: { bg: "#dc2626", icon: "#fecaca", border: "#991b1b" },
  G: { bg: "#16a34a", icon: "#bbf7d0", border: "#14532d" },
  C: { bg: "#64748b", icon: "#e2e8f0", border: "#475569" },
};

/**
 * ManaPip - single mana symbol in a filled circle
 * Props: symbol ("W"|"U"|"B"|"R"|"G"|"C"), size (px, default 18)
 */
export default function ManaPip({ symbol = "C", size = 18 }) {
  const s = PIP_STYLES[symbol] || PIP_STYLES["C"];
  return (
    <span
      aria-label={`Mana symbol ${symbol}`}
      role="img"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: s.bg,
        color: s.icon,
        border: `1.5px solid ${s.border}`,
        flexShrink: 0,
      }}
    >
      <PipIcon symbol={symbol} />
    </span>
  );
}