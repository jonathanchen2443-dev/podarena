import React from "react";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6995f1fed0849cf726dfe04d/bea8c705b_LogoBlack.jpg";

export default function TopBar({ currentPageName, actionSlot }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/60 h-14 flex items-center px-4">
      <div className="flex items-center gap-2 flex-1">
        <img
          src={LOGO_URL}
          alt="PodArena logo"
          className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
        />
        <h1 className="text-white font-semibold text-base">PodArena</h1>
      </div>
      <div className="flex items-center gap-2">
        {actionSlot ?? null}
      </div>
    </header>
  );
}