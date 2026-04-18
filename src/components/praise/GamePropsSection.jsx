/**
 * GamePropsSection — displays "Props from this game" for a fully-approved game.
 * Only renders when game.status === "approved" and there are visible praises.
 * Participants prop is the assembled game participants array (shape: { userId, display_name }).
 */
import React, { useState, useEffect } from "react";
import { PRAISE_META, getGamePraises } from "@/components/services/praiseService";
import { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";

function formatShortName(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export default function GamePropsSection({ game, callerAuthUserId, callerProfileId }) {
  const [praises, setPraises] = useState([]);
  const [loading, setLoading] = useState(true);

  const isApproved = game?.status === "approved";

  useEffect(() => {
    if (!isApproved || !game?.id || !callerAuthUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getGamePraises(game.id, callerAuthUserId, callerProfileId)
      .then((rows) => setPraises(rows || []))
      .catch(() => setPraises([]))
      .finally(() => setLoading(false));
  }, [game?.id, isApproved, callerAuthUserId, callerProfileId]);

  // Only render for approved games with praises
  if (!isApproved || loading || praises.length === 0) return null;

  // Build display name map from participants (assembled game uses `userId` as profile key)
  const nameMap = {};
  (game.participants || []).forEach((p) => {
    const id = p.userId || p.profileId || p.participant_profile_id;
    if (id) nameMap[id] = p.display_name || "?";
  });

  return (
    <div className="space-y-2">
      {/* Section header */}
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold px-1">
        Props from this game
      </p>

      <div className="space-y-1.5">
        {praises.map((praise) => {
          const meta = PRAISE_META[praise.praise_type];
          if (!meta) return null;

          const giverName = formatShortName(nameMap[praise.giver_profile_id] || "?");
          const receiverName = formatShortName(nameMap[praise.receiver_profile_id] || "?");

          return (
            <div
              key={praise.id || `${praise.giver_profile_id}-${praise.praise_type}`}
              className="flex items-center gap-3 px-3 py-2 rounded-xl border"
              style={{
                backgroundColor: "rgba(255,255,255,0.025)",
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              {/* Social event: giver → receiver */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-gray-300 text-xs font-semibold truncate">{giverName}</span>
                  <span className="text-gray-400 text-base font-bold leading-none">→</span>
                  <span className="text-white text-xs font-semibold truncate">{receiverName}</span>
                </div>
                <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--ds-primary-text)", opacity: 0.9 }}>
                  {meta.label}
                </p>
              </div>

              {/* Praise icon — right side, 30% bigger (w-8 → w-[42px]) */}
              <img
                src={PRAISE_ICONS[praise.praise_type]}
                alt={meta.label}
                className="w-[42px] h-[42px] object-contain flex-shrink-0"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}