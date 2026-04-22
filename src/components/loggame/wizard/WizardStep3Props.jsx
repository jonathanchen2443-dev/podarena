/**
 * Step 3 — Props (optional praise)
 * Reuses PraiseSelector wholesale. Adds "one prop total" note and Skip hint.
 */
import React from "react";
import PraiseSelector from "@/components/praise/PraiseSelector";

export default function WizardStep3Props({
  participants,
  currentProfileId,
  praiseReceiver,
  praiseType,
  onReceiverChange,
  onPraiseChange,
}) {
  return (
    <div className="space-y-4">

      {/* Intro text */}
      <div className="rounded-2xl p-4 space-y-1" style={{ background: "rgba(255,255,255,0.03)" }}>
        <p className="text-white font-semibold text-sm">Give credit where it's due</p>
        <p className="text-gray-500 text-xs leading-relaxed">
          Did someone play exceptionally? Award them one prop. Totally optional — you can skip this step.
        </p>
      </div>

      {/* Praise selector — full existing component */}
      <PraiseSelector
        participants={participants}
        currentProfileId={currentProfileId}
        selectedReceiver={praiseReceiver}
        selectedPraise={praiseType}
        onReceiverChange={onReceiverChange}
        onPraiseChange={onPraiseChange}
      />

      {/* Rule note */}
      <p className="text-center text-gray-700 text-xs px-4">
        Each player can award one prop per game.
      </p>

    </div>
  );
}