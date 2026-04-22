/**
 * WizardExitConfirm — shown when user taps X during the wizard.
 * "Are you sure?" confirmation before discarding progress.
 */
import React from "react";
import { AlertTriangle } from "lucide-react";

export default function WizardExitConfirm({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: "#161a20", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        <div className="px-6 pt-6 pb-8 space-y-5">
          {/* Icon + text */}
          <div className="flex flex-col items-center text-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="space-y-1">
              <p className="text-white font-bold text-base">Leave game log?</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your progress won't be saved. This game log will be discarded.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-2xl text-gray-400 hover:text-white text-sm font-semibold py-3 transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Keep Logging
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-2xl text-white text-sm font-semibold py-3 transition-colors"
              style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.30)" }}
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}