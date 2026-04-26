import React from "react";
import ManaPip from "./ManaPip";

// Colors that map directly to ManaPip symbols
const COLOR_SYMBOLS = new Set(["W", "U", "B", "R", "G", "C"]);

/**
 * Parse a Scryfall mana_cost string like "{2}{W}{U}{B/R}" into an ordered
 * list of tokens for rendering. Each token is either:
 *   { type: "pip",     symbol: "W" }   — maps to ManaPip
 *   { type: "generic", value: "3" }    — numeric / X / Y / Z
 *   { type: "text",    value: "/" }    — fallback plain text
 */
function parseManaString(raw) {
  if (!raw) return [];
  const tokens = [];
  // Extract braces content: {X}, {2/W}, {W/U}, etc.
  const bracketRe = /\{([^}]+)\}/g;
  let match;
  while ((match = bracketRe.exec(raw)) !== null) {
    const inner = match[1].toUpperCase();

    if (COLOR_SYMBOLS.has(inner)) {
      // Pure color pip
      tokens.push({ type: "pip", symbol: inner });
    } else if (/^\d+$/.test(inner) || inner === "X" || inner === "Y" || inner === "Z") {
      // Generic / variable cost
      tokens.push({ type: "generic", value: inner });
    } else if (inner.includes("/")) {
      // Hybrid or Phyrexian — show the first half if it's a color, else fallback to text
      const parts = inner.split("/");
      const first = parts[0];
      if (COLOR_SYMBOLS.has(first)) {
        tokens.push({ type: "pip", symbol: first });
      } else {
        tokens.push({ type: "text", value: `{${match[1]}}` });
      }
    } else {
      // Unknown — plain text fallback
      tokens.push({ type: "text", value: `{${match[1]}}` });
    }
  }
  return tokens;
}

/**
 * ManaCost — renders a Scryfall mana_cost string as mana pips / generic badges.
 *
 * Props:
 *   cost  – Scryfall mana_cost string, e.g. "{2}{W}{U}" or null
 *   size  – pip size in px (default 13)
 *   gap   – gap between symbols in px (default 1)
 */
export default function ManaCost({ cost, size = 13, gap = 1 }) {
  const tokens = parseManaString(cost);
  if (tokens.length === 0) return null;

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap, flexShrink: 0 }}
      role="img"
      aria-label={cost ? cost.replace(/[{}]/g, "") : ""}
    >
      {tokens.map((tok, i) => {
        if (tok.type === "pip") {
          return <ManaPip key={i} symbol={tok.symbol} size={size} />;
        }
        if (tok.type === "generic") {
          return (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: size,
                height: size,
                borderRadius: "50%",
                background: "#6b7280",
                color: "#fff",
                fontSize: size * 0.6,
                fontWeight: 700,
                fontFamily: "monospace",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {tok.value}
            </span>
          );
        }
        // text fallback — tiny monospace
        return (
          <span
            key={i}
            style={{
              fontSize: size * 0.7,
              color: "#9ca3af",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {tok.value.replace(/[{}]/g, "")}
          </span>
        );
      })}
    </span>
  );
}