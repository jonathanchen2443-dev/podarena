/**
 * WizardIntroModal — shown on first visit to the Log Game wizard.
 * "Don't show again" persists to profile.hide_log_game_intro via updateMe.
 */
import React, { useState } from "react";
import { Swords } from "lucide-react";

export default function WizardIntroModal({ onDismiss }) {
  const [dontShow, setDontShow] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: "#161a20", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Icon */}
        <div className="flex justify-center pt-6 pb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(var(--ds-primary-rgb),0.15)", border: "1px solid rgba(var(--ds-primary-rgb),0.30)" }}
          >
            <Swords className="w-7 h-7" style={{ color: "rgb(var(--ds-primary-rgb))" }} />
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="text-center space-y-1.5">
            <p className="text-white font-bold text-lg">Log a Game</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Record a match in 4 quick steps: set up the game, add players and results, award a prop, then review and submit.
            </p>
            <p className="text-gray-500 text-xs leading-relaxed">
              Other players will get a review request. The game counts once everyone approves.
            </p>
          </div>

          {/* Don't show again */}
          <button
            type="button"
            onClick={() => setDontShow((v) => !v)}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div
              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: dontShow ? "rgb(var(--ds-primary-rgb))" : "rgba(255,255,255,0.06)",
                border: dontShow ? "none" : "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {dontShow && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-400">Don't show this again</span>
          </button>

          {/* CTA */}
          <button
            type="button"
            onClick={() => onDismiss(dontShow)}
            className="w-full rounded-2xl text-white text-sm font-bold py-3 transition-all ds-btn-primary"
            style={{ height: "50px" }}
          >
            Start Logging
          </button>
        </div>
      </div>
    </div>
  );
}