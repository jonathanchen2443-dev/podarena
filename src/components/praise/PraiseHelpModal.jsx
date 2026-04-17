import React from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";
import { PRAISE_TYPES, PRAISE_META } from "@/components/services/praiseService";

const PRAISE_ICONS = {
  on_fire:              "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/bcfb284bb_On_fire.png",
  no_mercy:             "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/26b105ccb_No_mercy.png",
  puppet_master:        "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/a0ffdf0db_Puppet_master.png",
  fortress:             "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/60c8665c1_Fortress.png",
  clutch:               "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/5fb248b84_Clutch.png",
  crowned_commander:    "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/42bb0d9b4_Crowned_commander.png",
  should_have_been_you: "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/6238d049b_Shouldhavebeenyou.png",
  troublemaker:         "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/71445cbb8_Troublemaker.png",
  knockout:             "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/18bddc492_Knockout.png",
  phoenix:              "https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/2aa4fb9b2_Phoenix.png",
};

export { PRAISE_ICONS };

export default function PraiseHelpModal({ onClose }) {
  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-sm bg-gray-950 border border-gray-800 rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800/60">
          <div>
            <p className="text-white font-semibold text-sm">What are Props?</p>
            <p className="text-gray-500 text-xs mt-0.5">Give credit where it's due — totally optional.</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors flex-shrink-0 ml-3"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {PRAISE_TYPES.map((key) => {
            const meta = PRAISE_META[key];
            return (
              <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-900/60 border border-gray-800/40">
                <img
                  src={PRAISE_ICONS[key]}
                  alt={meta.label}
                  className="w-9 h-9 object-contain flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold leading-none">{meta.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-snug">{meta.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const root = document.getElementById("modal-root");
  return root ? ReactDOM.createPortal(modal, root) : modal;
}