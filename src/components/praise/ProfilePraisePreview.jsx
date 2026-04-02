/**
 * ProfilePraisePreview — compact 3-tile praise preview for profile pages.
 * Shows the top 3 praise types by count. Zero-count types shown as muted filler tiles.
 * Includes a "See all" entry point to the full Praises screen.
 *
 * Props:
 *   profileId  — the profile whose praises to show
 *   userId     — used to build the Praises screen link (?userId=...)
 *   isOwn      — true if showing the current user's own profile
 */
import React, { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { PRAISE_TYPES, PRAISE_META, getPlayerPraiseSummary } from "@/components/services/praiseService";
import { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";

/**
 * Pick the top 3 praise types to show in the preview.
 * Sort by count descending; break ties by fixed PRAISE_TYPES order.
 * Fill remaining slots with zero-count entries.
 */
function getTop3(summary) {
  const entries = PRAISE_TYPES.map((key, idx) => ({
    key,
    count: summary?.[key] ?? 0,
    order: idx,
  }));
  entries.sort((a, b) => b.count - a.count || a.order - b.order);
  return entries.slice(0, 3);
}

function PraiseTile({ praiseKey, count }) {
  const meta = PRAISE_META[praiseKey];
  const active = count > 0;

  return (
    <div
      className="flex-1 flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 border transition-all"
      style={{
        backgroundColor: active
          ? "rgba(var(--ds-primary-rgb),0.07)"
          : "rgba(255,255,255,0.025)",
        borderColor: active
          ? "rgba(var(--ds-primary-rgb),0.22)"
          : "rgba(255,255,255,0.06)",
      }}
    >
      <img
        src={PRAISE_ICONS[praiseKey]}
        alt={meta.label}
        className="w-9 h-9 object-contain flex-shrink-0"
        style={{ opacity: active ? 1 : 0.3 }}
      />
      <p
        className="text-[10px] font-semibold text-center leading-tight"
        style={{ color: active ? "var(--ds-primary-text)" : "#4b5563" }}
      >
        {meta.label}
      </p>
      <p
        className="text-xs font-bold leading-none"
        style={{ color: active ? "#f5f7fa" : "#374151" }}
      >
        {active ? count : "—"}
      </p>
    </div>
  );
}

export default function ProfilePraisePreview({ profileId, userId, isOwn }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) { setLoading(false); return; }
    setLoading(true);
    getPlayerPraiseSummary(profileId)
      .then((s) => setSummary(s))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [profileId]);

  const praisesRoute = userId
    ? `${createPageUrl("Praises")}?userId=${userId}`
    : createPageUrl("Praises");

  const top3 = getTop3(summary);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-white font-semibold text-base">Praises</h2>
        <button
          onClick={() => navigate(praisesRoute)}
          className="flex items-center gap-0.5 text-xs transition-colors hover:opacity-80"
          style={{ color: "var(--ds-primary-text)" }}
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tiles */}
      {loading ? (
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-1 rounded-xl h-24 animate-pulse"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          {top3.map(({ key, count }) => (
            <PraiseTile key={key} praiseKey={key} count={count} />
          ))}
        </div>
      )}
    </div>
  );
}