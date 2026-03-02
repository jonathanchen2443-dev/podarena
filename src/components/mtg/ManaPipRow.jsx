import React from "react";
import ManaPip from "./ManaPip";

const COLOR_ORDER = ["W", "U", "B", "R", "G", "C"];

/**
 * ManaPipRow - renders a row of mana pips
 * Props:
 *   colors  – array like ["U","R"] OR string "UR" OR null/undefined
 *   size    – pip size in px (default 16)
 *   gap     – gap between pips in px (default 3)
 */
export default function ManaPipRow({ colors, size = 17, gap = 2 }) {
  // Normalize to array of unique, ordered symbols
  let arr = [];
  if (!colors) {
    arr = [];
  } else if (typeof colors === "string") {
    arr = colors.split("").filter(Boolean);
  } else {
    arr = [...colors];
  }

  // Unique + ordered
  const seen = new Set();
  const ordered = COLOR_ORDER.filter((c) => {
    if (arr.includes(c) && !seen.has(c)) { seen.add(c); return true; }
    return false;
  });

  // Colorless fallback
  const final = ordered.length > 0 ? ordered : ["C"];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap }} role="group" aria-label="Color identity">
      {final.map((c) => <ManaPip key={c} symbol={c} size={size} />)}
    </span>
  );
}