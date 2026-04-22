/**
 * Step 1 — Game Setup
 * Corrected: no mode description text, compact count selector, clean layout.
 */
import React from "react";
import { Layers } from "lucide-react";
import PodSearchPicker from "@/components/loggame/PodSearchPicker";

function FieldLabel({ children }) {
  return (
    <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-2">{children}</p>
  );
}

function PodChip({ pod, locked, onClear }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
      >
        <Layers className="w-4 h-4 text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{pod.pod_name}</p>
        <p className="text-xs font-mono text-violet-400/60">{pod.pod_code}</p>
      </div>
      {locked ? (
        <span className="text-[10px] text-gray-600 px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.05)" }}>Locked</span>
      ) : (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 px-1"
        >
          Change
        </button>
      )}
    </div>
  );
}

export default function WizardStep1Setup({
  mode,
  lockedPodMode,
  pod,
  podLoading,
  authUserId,
  profileId,
  participantCount,
  playedAt,
  notes,
  onModeSwitch,
  onPodSelected,
  onClearPod,
  onParticipantCountChange,
  onPlayedAtChange,
  onNotesChange,
}) {
  return (
    <div className="space-y-5 pt-2">

      {/* Game Type — labels only, no description text */}
      {!lockedPodMode && (
        <div>
          <FieldLabel>Game Type</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {["Casual", "POD"].map((label) => {
              const val = label.toLowerCase();
              const active = mode === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onModeSwitch(val)}
                  className="rounded-xl py-3.5 text-sm font-bold transition-all"
                  style={
                    active
                      ? {
                          backgroundColor: "rgba(var(--ds-primary-rgb),0.12)",
                          border: "1px solid rgb(var(--ds-primary-rgb))",
                          color: "var(--ds-primary-text)",
                        }
                      : {
                          backgroundColor: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#6b7280",
                        }
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* POD selection */}
      {mode === "pod" && (
        <div>
          <FieldLabel>POD</FieldLabel>
          {podLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
              Loading POD…
            </div>
          ) : pod ? (
            <PodChip pod={pod} locked={lockedPodMode} onClear={onClearPod} />
          ) : (
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
              <PodSearchPicker
                authUserId={authUserId}
                profileId={profileId}
                onSelect={onPodSelected}
              />
            </div>
          )}
        </div>
      )}

      {/* Format — Commander, locked */}
      <div>
        <FieldLabel>Format</FieldLabel>
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="text-sm font-semibold text-white">Commander</span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
            style={{ background: "rgba(255,255,255,0.06)", color: "#6b7280" }}
          >
            Only format
          </span>
        </div>
      </div>

      {/* Participant count — compact horizontal scroll */}
      <div>
        <FieldLabel>Number of Players</FieldLabel>
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onParticipantCountChange(n)}
              className="flex-shrink-0 w-11 h-11 rounded-xl text-sm font-bold transition-all"
              style={
                participantCount === n
                  ? {
                      backgroundColor: "rgba(var(--ds-primary-rgb),0.15)",
                      border: "1px solid rgba(var(--ds-primary-rgb),0.4)",
                      color: "var(--ds-primary-text)",
                    }
                  : {
                      backgroundColor: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#6b7280",
                    }
              }
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Date & time */}
      <div>
        <FieldLabel>Date &amp; Time</FieldLabel>
        <input
          type="datetime-local"
          value={playedAt}
          onChange={(e) => onPlayedAtChange(e.target.value)}
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))]"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            colorScheme: "dark",
          }}
        />
      </div>

      {/* Notes */}
      <div>
        <FieldLabel>Notes <span className="normal-case font-normal text-gray-700">(optional)</span></FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          placeholder="Anything worth remembering…"
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] resize-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        />
      </div>

    </div>
  );
}