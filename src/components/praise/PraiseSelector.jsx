/**
 * PraiseSelector — shared Props section for Log Game and Review/Approve flows.
 *
 * Props:
 *   participants      — array of { profileId, display_name } — all participants in the game
 *   currentProfileId  — the current user's own profile ID (excluded from receiver list)
 *   selectedReceiver  — profileId of chosen receiver (or null)
 *   selectedPraise    — praise_type key (or null)
 *   onReceiverChange  — (profileId | null) => void
 *   onPraiseChange    — (praiseKey | null) => void
 */
import React, { useState } from "react";
import { HelpCircle, User } from "lucide-react";
import { PRAISE_TYPES, PRAISE_META } from "@/components/services/praiseService";
import PraiseHelpModal, { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";

function formatName(name) {
  if (!name) return "Player";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ── Receiver pill (reused from WizardStep3Props pattern) ──────────────────────
function ReceiverPill({ profile, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-all flex-shrink-0"
      style={
        selected
          ? {
              background: "rgba(var(--ds-primary-rgb),0.22)",
              border: "2px solid rgba(var(--ds-primary-rgb),0.70)",
              boxShadow: "0 0 14px rgba(var(--ds-primary-rgb),0.30)",
            }
          : {
              background: "rgba(255,255,255,0.05)",
              border: "1.5px solid rgba(255,255,255,0.10)",
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

// ── Praise type grid ──────────────────────────────────────────────────────────
function PraiseTypeGrid({ value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PRAISE_TYPES.map((key) => {
        const meta = PRAISE_META[key];
        const isSelected = value === key;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(isSelected ? null : key)}
            className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 border transition-all"
            style={{
              backgroundColor: isSelected ? "rgba(var(--ds-primary-rgb),0.16)" : "rgba(255,255,255,0.03)",
              borderColor: isSelected ? "rgba(var(--ds-primary-rgb),0.55)" : "rgba(255,255,255,0.08)",
              boxShadow: isSelected ? "0 0 14px rgba(var(--ds-primary-rgb),0.22)" : "none",
              transform: isSelected ? "scale(1.04)" : "scale(1)",
              opacity: disabled ? 0.35 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <img
              src={PRAISE_ICONS[key]}
              alt={meta.label}
              className="w-8 h-8 object-contain"
            />
            <span
              className="text-[10px] font-semibold text-center leading-tight"
              style={{ color: isSelected ? "var(--ds-primary-text)" : "#9ca3af" }}
            >
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Award summary banner ──────────────────────────────────────────────────────
function AwardSummary({ praiseKey, receiverName }) {
  const meta = PRAISE_META[praiseKey];
  return (
    <div
      className="rounded-2xl p-3 flex items-center gap-3"
      style={{
        background: "linear-gradient(135deg, rgba(var(--ds-primary-rgb),0.12) 0%, rgba(var(--ds-primary-rgb),0.06) 100%)",
        border: "1px solid rgba(var(--ds-primary-rgb),0.35)",
        boxShadow: "0 0 20px rgba(var(--ds-primary-rgb),0.10)",
      }}
    >
      <img src={PRAISE_ICONS[praiseKey]} alt={meta.label} className="w-12 h-12 object-contain flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-0.5">Awarding</p>
        <p className="text-white font-extrabold text-sm leading-tight">{meta.label}</p>
        {receiverName && (
          <p className="text-xs mt-0.5" style={{ color: "var(--ds-primary-text)" }}>
            to {formatName(receiverName)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PraiseSelector({
  participants,
  currentProfileId,
  selectedReceiver,
  selectedPraise,
  onReceiverChange,
  onPraiseChange,
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  // Only other participants (not self)
  const receiverOptions = (participants || []).filter((p) => p.profileId !== currentProfileId);
  const receiverName = receiverOptions.find((o) => o.profileId === selectedReceiver)?.display_name || null;

  function handlePillClick(profileId) {
    if (selectedReceiver === profileId) {
      onReceiverChange(null);
      onPraiseChange(null);
    } else {
      onReceiverChange(profileId);
      onPraiseChange(null); // reset prop when switching receiver
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Who stood out?</p>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-800 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Receiver pills — always visible */}
      {receiverOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {receiverOptions.map((p) => (
            <ReceiverPill
              key={p.profileId}
              profile={p}
              selected={selectedReceiver === p.profileId}
              onClick={() => handlePillClick(p.profileId)}
            />
          ))}
        </div>
      ) : (
        <p className="text-gray-700 text-xs italic">No other participants to award.</p>
      )}

      {/* Props grid — always visible; disabled until player selected */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-2">
          Choose a prop{!selectedReceiver && <span className="normal-case font-normal text-gray-700 ml-1">(select a player first)</span>}
        </p>
        <PraiseTypeGrid
          value={selectedPraise}
          onChange={onPraiseChange}
          disabled={!selectedReceiver}
        />
      </div>

      {/* Award summary when both selected */}
      {selectedReceiver && selectedPraise && (
        <AwardSummary praiseKey={selectedPraise} receiverName={receiverName} />
      )}

      {helpOpen && <PraiseHelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}