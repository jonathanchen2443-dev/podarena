/**
 * Step 3 — Props (corrected)
 *
 * - Pill-based receiver selection (no dropdown)
 * - Props grid visible immediately
 * - Prominent summary when both selected
 * - Skip is a real button (not weak text)
 */
import React, { useState } from "react";
import { HelpCircle, User } from "lucide-react";
import { PRAISE_TYPES, PRAISE_META } from "@/components/services/praiseService";
import { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";
import PraiseHelpModal from "@/components/praise/PraiseHelpModal";

function formatName(name) {
  if (!name) return "Player";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ── Receiver pill ─────────────────────────────────────────────────────────────
function ReceiverPill({ profile, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-all flex-shrink-0"
      style={
        selected
          ? {
              background: "rgba(var(--ds-primary-rgb),0.18)",
              border: "1px solid rgba(var(--ds-primary-rgb),0.50)",
            }
          : {
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
            }
      }
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.1)" }}>
          <User className="w-3 h-3 text-gray-500" />
        </div>
      )}
      <span
        className="text-xs font-semibold leading-none whitespace-nowrap"
        style={{ color: selected ? "var(--ds-primary-text)" : "#9ca3af" }}
      >
        {formatName(profile.display_name)}
      </span>
    </button>
  );
}

// ── Prop tile ─────────────────────────────────────────────────────────────────
function PropTile({ praiseKey, selected, disabled, onClick }) {
  const meta = PRAISE_META[praiseKey];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 border transition-all"
      style={{
        backgroundColor: selected ? "rgba(var(--ds-primary-rgb),0.14)" : "rgba(255,255,255,0.03)",
        borderColor: selected ? "rgba(var(--ds-primary-rgb),0.45)" : "rgba(255,255,255,0.08)",
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: selected ? "0 0 14px rgba(var(--ds-primary-rgb),0.2)" : "none",
        transform: selected ? "scale(1.03)" : "scale(1)",
      }}
    >
      <img src={PRAISE_ICONS[praiseKey]} alt={meta.label} className="w-8 h-8 object-contain" />
      <span
        className="text-[10px] font-semibold text-center leading-tight"
        style={{ color: selected ? "var(--ds-primary-text)" : "#9ca3af" }}
      >
        {meta.label}
      </span>
    </button>
  );
}

// ── Award summary — prominent ─────────────────────────────────────────────────
function AwardSummary({ praiseKey, receiverName }) {
  const meta = PRAISE_META[praiseKey];
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{
        background: "linear-gradient(135deg, rgba(var(--ds-primary-rgb),0.12) 0%, rgba(var(--ds-primary-rgb),0.06) 100%)",
        border: "1px solid rgba(var(--ds-primary-rgb),0.35)",
        boxShadow: "0 0 24px rgba(var(--ds-primary-rgb),0.12)",
      }}
    >
      <img
        src={PRAISE_ICONS[praiseKey]}
        alt={meta.label}
        className="w-14 h-14 object-contain flex-shrink-0"
      />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-0.5">Awarding</p>
        <p className="text-white font-extrabold text-base leading-tight">{meta.label}</p>
        {receiverName && (
          <p className="text-sm mt-0.5" style={{ color: "var(--ds-primary-text)" }}>
            to {formatName(receiverName)}
          </p>
        )}
        <p className="text-gray-600 text-[11px] mt-1 leading-snug max-w-[200px]">{meta.description}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WizardStep3Props({
  participants,
  currentProfileId,
  praiseReceiver,
  praiseType,
  onReceiverChange,
  onPraiseChange,
  onSkip,
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  // Only non-self participants
  const receiverOptions = (participants || []).filter((p) => p.profileId !== currentProfileId);
  const selectedReceiverProfile = receiverOptions.find((p) => p.profileId === praiseReceiver) || null;

  function handlePillClick(profileId) {
    if (praiseReceiver === profileId) {
      // Deselect
      onReceiverChange(null);
      onPraiseChange(null);
    } else {
      onReceiverChange(profileId);
      onPraiseChange(null); // reset prop when switching receiver
    }
  }

  function handlePropClick(key) {
    onPraiseChange(praiseType === key ? null : key);
  }

  return (
    <div className="space-y-5 pt-2">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white font-semibold text-sm">Give Props</p>
          <p className="text-gray-500 text-xs mt-0.5">Optional — award one player for standout play.</p>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-800 transition-colors flex-shrink-0 mt-0.5"
        >
          <HelpCircle className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* ── Receiver pills ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-2">
          Who stood out?
        </p>
        {receiverOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {receiverOptions.map((p) => (
              <ReceiverPill
                key={p.profileId}
                profile={p}
                selected={praiseReceiver === p.profileId}
                onClick={() => handlePillClick(p.profileId)}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-700 text-xs italic">No other participants to award.</p>
        )}
      </div>

      {/* ── Props grid — always visible ────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-2">
          Choose a prop {!praiseReceiver && <span className="normal-case font-normal text-gray-700">(select a player first)</span>}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PRAISE_TYPES.map((key) => (
            <PropTile
              key={key}
              praiseKey={key}
              selected={praiseType === key}
              disabled={!praiseReceiver}
              onClick={() => handlePropClick(key)}
            />
          ))}
        </div>
      </div>

      {/* ── Award summary — shown when both selected ───────────────────────── */}
      {praiseReceiver && praiseType && (
        <AwardSummary
          praiseKey={praiseType}
          receiverName={selectedReceiverProfile?.display_name || null}
        />
      )}

      {/* ── Rule note ─────────────────────────────────────────────────────── */}
      <p className="text-center text-gray-700 text-[11px]">
        Each player can award one prop per game.
      </p>

      {/* ── Skip button — real button, equal weight ────────────────────────── */}
      <button
        type="button"
        onClick={onSkip}
        className="w-full rounded-2xl text-sm font-semibold py-3 transition-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          color: "#9ca3af",
        }}
      >
        Skip Props
      </button>

      {helpOpen && <PraiseHelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}