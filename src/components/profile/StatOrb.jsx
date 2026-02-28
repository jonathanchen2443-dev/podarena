import React from "react";

/**
 * StatOrb — glowing circular stat display.
 * Props: value (string|number), label (string), color ("violet"|"emerald"|"amber"|"sky")
 */
const GLOW_STYLES = {
  violet: {
    ring: "from-violet-500/60 via-violet-400/20 to-transparent",
    inner: "bg-violet-500/10 border-violet-500/30",
    text: "text-violet-100",
    glow: "shadow-[0_0_18px_2px_rgba(139,92,246,0.35)]",
  },
  emerald: {
    ring: "from-emerald-500/60 via-emerald-400/20 to-transparent",
    inner: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-100",
    glow: "shadow-[0_0_18px_2px_rgba(16,185,129,0.35)]",
  },
  amber: {
    ring: "from-amber-500/60 via-amber-400/20 to-transparent",
    inner: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-100",
    glow: "shadow-[0_0_18px_2px_rgba(245,158,11,0.35)]",
  },
  sky: {
    ring: "from-sky-500/60 via-sky-400/20 to-transparent",
    inner: "bg-sky-500/10 border-sky-500/30",
    text: "text-sky-100",
    glow: "shadow-[0_0_18px_2px_rgba(14,165,233,0.35)]",
  },
};

export default function StatOrb({ value, label, color = "violet" }) {
  const s = GLOW_STYLES[color] || GLOW_STYLES.violet;
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Outer glow ring using inline style for radial gradient */}
      <div className="relative w-16 h-16 rounded-full flex items-center justify-center">
        {/* Blurred glow backdrop */}
        <div
          className="absolute inset-0 rounded-full blur-md opacity-60"
          style={{ background: `radial-gradient(circle, var(--orb-color, rgba(139,92,246,0.5)) 0%, transparent 70%)` }}
        />
        {/* Inner circle */}
        <div className={`relative w-14 h-14 rounded-full border ${s.inner} ${s.glow} flex items-center justify-center`}>
          <span className={`font-bold text-base leading-none ${s.text}`}>{value}</span>
        </div>
      </div>
      <span className="text-gray-500 text-[10px] font-medium uppercase tracking-wider leading-none">{label}</span>
    </div>
  );
}