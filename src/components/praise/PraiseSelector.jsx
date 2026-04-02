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
import { HelpCircle, ChevronDown, X } from "lucide-react";
import { PRAISE_TYPES, PRAISE_META } from "@/components/services/praiseService";
import PraiseHelpModal, { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";

function formatName(name) {
  if (!name) return "Player";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ── Receiver dropdown ─────────────────────────────────────────────────────────
function ReceiverDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.profileId === value) || null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-left transition-colors"
        style={{
          backgroundColor: value ? "rgba(var(--ds-primary-rgb),0.08)" : "rgba(255,255,255,0.04)",
          borderColor: value ? "rgba(var(--ds-primary-rgb),0.30)" : "rgba(255,255,255,0.10)",
          color: value ? "#f3f4f6" : "#6b7280",
        }}
      >
        {selected?.avatar_url ? (
          <img src={selected.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0" />
        )}
        <span className="flex-1 min-w-0 truncate">
          {selected ? formatName(selected.display_name) : "Choose a player…"}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="w-2.5 h-2.5 text-gray-500" />
          </button>
        )}
        <ChevronDown
          className="flex-shrink-0 w-3 h-3 text-gray-600 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden border"
          style={{
            backgroundColor: "#1a1f2e",
            borderColor: "rgba(var(--ds-primary-rgb),0.25)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          {options.map((o) => (
            <button
              key={o.profileId}
              type="button"
              onClick={() => { onChange(o.profileId); setOpen(false); }}
              className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
              style={{ color: o.profileId === value ? "var(--ds-primary-text)" : "#e5e7eb" }}
            >
              {o.avatar_url ? (
                <img src={o.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-700 flex-shrink-0" />
              )}
              <span className="truncate">{formatName(o.display_name)}</span>
            </button>
          ))}
          {options.length === 0 && (
            <p className="text-xs text-gray-600 px-3 py-3">No other participants.</p>
          )}
        </div>
      )}
    </div>
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
              backgroundColor: isSelected ? "rgba(var(--ds-primary-rgb),0.14)" : "rgba(255,255,255,0.03)",
              borderColor: isSelected ? "rgba(var(--ds-primary-rgb),0.45)" : "rgba(255,255,255,0.08)",
              opacity: disabled ? 0.4 : 1,
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

// ── Selected praise preview ───────────────────────────────────────────────────
function PraisePreview({ praiseKey, receiverName }) {
  if (!praiseKey) return null;
  const meta = PRAISE_META[praiseKey];
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
      style={{
        backgroundColor: "rgba(var(--ds-primary-rgb),0.08)",
        borderColor: "rgba(var(--ds-primary-rgb),0.25)",
      }}
    >
      <img
        src={PRAISE_ICONS[praiseKey]}
        alt={meta.label}
        className="w-8 h-8 object-contain flex-shrink-0"
      />
      <div className="min-w-0">
        <p className="text-xs font-bold" style={{ color: "var(--ds-primary-text)" }}>
          {meta.label}
        </p>
        {receiverName && (
          <p className="text-xs text-gray-500 truncate">for {formatName(receiverName)}</p>
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
  const praiseDisabled = !selectedReceiver;

  return (
    <div
      className="rounded-2xl border overflow-visible"
      style={{
        backgroundColor: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-200">Props</span>
          <span className="text-gray-600 text-xs font-normal">(optional)</span>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-800 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Step 1 — receiver */}
        <div>
          <p className="text-xs text-gray-600 mb-1.5">Who stood out?</p>
          <ReceiverDropdown
            options={receiverOptions}
            value={selectedReceiver}
            onChange={(val) => {
              onReceiverChange(val);
              // Clear praise type if receiver is cleared
              if (!val) onPraiseChange(null);
            }}
          />
        </div>

        {/* Step 2 — praise type (only enabled when receiver is chosen) */}
        {selectedReceiver && (
          <div>
            <p className="text-xs text-gray-600 mb-1.5">Pick a badge</p>
            <PraiseTypeGrid
              value={selectedPraise}
              onChange={onPraiseChange}
              disabled={praiseDisabled}
            />
          </div>
        )}

        {/* Selected praise preview */}
        {selectedPraise && selectedReceiver && (
          <PraisePreview praiseKey={selectedPraise} receiverName={receiverName} />
        )}
      </div>

      {helpOpen && <PraiseHelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}