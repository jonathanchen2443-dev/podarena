/**
 * Praises — full praise collection screen.
 * Shows all 6 praise types with total counts for a player.
 * Accessible for:
 *   - own profile: no ?userId param (uses currentUser.id)
 *   - public profile: ?userId=<profileId>
 *
 * Praise counts come from the backend via getPlayerPraiseSummary (no direct client scans).
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { ROUTES } from "@/components/utils/routes";
import { PRAISE_TYPES, PRAISE_META, getPlayerPraiseSummary } from "@/components/services/praiseService";
import { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";
import { getPublicProfile } from "@/components/services/profileService.jsx";
import { LoadingState } from "@/components/shell/PageStates";

function PraiseCard({ praiseKey, count }) {
  const meta = PRAISE_META[praiseKey];
  const active = count > 0;

  return (
    <div
      className="flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-all"
      style={{
        backgroundColor: active
          ? "rgba(var(--ds-primary-rgb),0.07)"
          : "rgba(255,255,255,0.025)",
        borderColor: active
          ? "rgba(var(--ds-primary-rgb),0.22)"
          : "rgba(255,255,255,0.05)",
      }}
    >
      {/* Icon */}
      <img
        src={PRAISE_ICONS[praiseKey]}
        alt={meta.label}
        className="w-11 h-11 object-contain flex-shrink-0"
        style={{ opacity: active ? 1 : 0.25 }}
      />

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold leading-none"
          style={{ color: active ? "#f5f7fa" : "#374151" }}
        >
          {meta.label}
        </p>
        <p
          className="text-xs mt-1 leading-snug"
          style={{ color: active ? "#9ca3af" : "#1f2937" }}
        >
          {meta.description}
        </p>
      </div>

      {/* Count badge */}
      <div
        className="flex-shrink-0 min-w-[36px] h-9 flex items-center justify-center rounded-xl px-2"
        style={{
          backgroundColor: active
            ? "rgba(var(--ds-primary-rgb),0.15)"
            : "rgba(255,255,255,0.04)",
        }}
      >
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: active ? "var(--ds-primary-text)" : "#374151" }}
        >
          {active ? count : "—"}
        </span>
      </div>
    </div>
  );
}

export default function Praises() {
  const navigate = useNavigate();
  const { currentUser, authLoading } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const queryUserId = urlParams.get("userId"); // may be a profileId or absent (own profile)

  const [profileId, setProfileId] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, queryUserId, currentUser?.id]);

  async function loadData() {
    setLoading(true);
    try {
      if (queryUserId) {
        // Public profile path — resolve the profile by its record ID
        const p = await getPublicProfile(queryUserId);
        setProfileId(p.id);
        setDisplayName(p.display_name);
        const s = await getPlayerPraiseSummary(p.id);
        setSummary(s);
      } else if (currentUser?.id) {
        // Own profile path
        setProfileId(currentUser.id);
        setDisplayName(currentUser.display_name);
        const s = await getPlayerPraiseSummary(currentUser.id);
        setSummary(s);
      }
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate(ROUTES.PROFILE);
  }

  if (authLoading || loading) return <LoadingState message="Loading praises…" />;

  const isOwnProfile = !queryUserId || (currentUser && currentUser.id === profileId);
  const total = summary?.total ?? 0;

  return (
    <div className="space-y-5 pb-10">
      {/* Back nav */}
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div>
        <p className="text-xs text-gray-600 uppercase tracking-wider font-medium">
          {isOwnProfile ? "My Praises" : `${displayName || "Player"}'s Praises`}
        </p>
        <div className="flex items-end gap-3 mt-1">
          <h1 className="text-white font-bold text-xl leading-none">Props</h1>
          {total > 0 && (
            <span
              className="text-xs font-semibold pb-0.5"
              style={{ color: "var(--ds-primary-text)" }}
            >
              {total} total
            </span>
          )}
        </div>
        {total === 0 && (
          <p className="text-gray-600 text-xs mt-1">
            {isOwnProfile
              ? "No praises received yet. Keep playing!"
              : "No praises received yet."}
          </p>
        )}
      </div>

      {/* All 6 praise types */}
      <div className="space-y-2">
        {PRAISE_TYPES.map((key) => (
          <PraiseCard key={key} praiseKey={key} count={summary?.[key] ?? 0} />
        ))}
      </div>
    </div>
  );
}