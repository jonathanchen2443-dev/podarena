/**
 * Praises — full praise collection screen.
 * Tile-based 2-column grid layout. Per-tile ? help popover.
 * Shows all praise types; zero-count tiles rendered muted.
 *
 * Accessible for:
 *   - own profile: no ?userId param (uses currentUser.id)
 *   - public profile: ?userId=<profileId>
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, X } from "lucide-react";
import ReactDOM from "react-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { ROUTES } from "@/components/utils/routes";
import { PRAISE_TYPES, PRAISE_META, getPlayerPraiseSummary } from "@/components/services/praiseService";
import { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";
import { getPublicProfile } from "@/components/services/profileService.jsx";
import { LoadingState } from "@/components/shell/PageStates";

// ── Per-tile help modal ───────────────────────────────────────────────────────

function PraiseHelpSheet({ praiseKey, onClose }) {
  const meta = PRAISE_META[praiseKey];
  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-xs bg-gray-950 border border-gray-800 rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>
        <div className="flex items-center gap-4 px-5 py-4">
          <img
            src={PRAISE_ICONS[praiseKey]}
            alt={meta.label}
            className="w-12 h-12 object-contain flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">{meta.label}</p>
            <p className="text-gray-400 text-xs mt-1 leading-snug">{meta.description}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors flex-shrink-0 self-start"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
  const root = document.getElementById("modal-root");
  return root ? ReactDOM.createPortal(modal, root) : modal;
}

// ── Praise tile ───────────────────────────────────────────────────────────────

function PraiseTile({ praiseKey, count, onHelp }) {
  const meta = PRAISE_META[praiseKey];
  const active = count > 0;

  return (
    <div
      className="relative flex flex-col items-center gap-2.5 rounded-2xl border pt-4 pb-3 px-2 transition-all"
      style={{
        backgroundColor: active
          ? "rgba(var(--ds-primary-rgb),0.07)"
          : "rgba(255,255,255,0.025)",
        borderColor: active
          ? "rgba(var(--ds-primary-rgb),0.22)"
          : "rgba(255,255,255,0.05)",
      }}
    >
      {/* ? help trigger — top-right corner */}
      <button
        onClick={(e) => { e.stopPropagation(); onHelp(praiseKey); }}
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
        style={{ color: active ? "rgba(var(--ds-primary-rgb),0.5)" : "#374151" }}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {/* Icon */}
      <img
        src={PRAISE_ICONS[praiseKey]}
        alt={meta.label}
        className="w-14 h-14 object-contain"
        style={{ opacity: active ? 1 : 0.2 }}
      />

      {/* Name */}
      <p
        className="text-[11px] font-semibold text-center leading-tight px-1"
        style={{ color: active ? "var(--ds-primary-text)" : "#374151" }}
      >
        {meta.label}
      </p>

      {/* Count */}
      <div
        className="rounded-lg px-2.5 py-0.5 min-w-[32px] flex items-center justify-center"
        style={{
          backgroundColor: active
            ? "rgba(var(--ds-primary-rgb),0.15)"
            : "rgba(255,255,255,0.04)",
        }}
      >
        <span
          className="text-xs font-bold tabular-nums"
          style={{ color: active ? "#f5f7fa" : "#1f2937" }}
        >
          {active ? count : "—"}
        </span>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Praises() {
  const navigate = useNavigate();
  const { currentUser, authLoading } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const queryUserId = urlParams.get("userId");

  const [profileId, setProfileId] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [helpKey, setHelpKey] = useState(null); // which praise tile's help is open

  useEffect(() => {
    if (authLoading) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, queryUserId, currentUser?.id]);

  async function loadData() {
    setLoading(true);
    try {
      if (queryUserId) {
        const p = await getPublicProfile(queryUserId);
        setProfileId(p.id);
        setDisplayName(p.display_name);
        const s = await getPlayerPraiseSummary(p.id);
        setSummary(s);
      } else if (currentUser?.id) {
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
    <div className="space-y-5 pt-2">
      {/* Back */}
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div>
        <div className="flex items-end gap-3">
          <h1 className="text-white font-bold text-xl leading-none">
            {isOwnProfile ? "My Props" : `${displayName || "Player"}'s Props`}
          </h1>
          {total > 0 && (
            <span className="text-xs font-semibold pb-0.5" style={{ color: "var(--ds-primary-text)" }}>
              {total} total
            </span>
          )}
        </div>
        {total === 0 && (
          <p className="text-gray-600 text-xs mt-1">
            {isOwnProfile ? "No props received yet. Keep playing!" : "No props received yet."}
          </p>
        )}
      </div>

      {/* Praise tile grid — 2 columns, scales to any number of praise types */}
      <div className="grid grid-cols-2 gap-3">
        {PRAISE_TYPES.map((key) => (
          <PraiseTile
            key={key}
            praiseKey={key}
            count={summary?.[key] ?? 0}
            onHelp={setHelpKey}
          />
        ))}
      </div>

      {/* Per-tile help sheet */}
      {helpKey && (
        <PraiseHelpSheet praiseKey={helpKey} onClose={() => setHelpKey(null)} />
      )}
    </div>
  );
}