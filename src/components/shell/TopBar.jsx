import React from "react";
import { Sparkles } from "lucide-react";

const pageTitles = {
  home: "Home",
  leagueslist: "Leagues",
  loggame: "Log Game",
  inbox: "Inbox",
  profile: "Profile",
  leagues: "Leagues",
  dashboard: "Dashboard",
  decks: "Decks",
  approvals: "Approvals",
  leaguedetails: "League",
  profiledecks: "My Decks",
};

export default function TopBar({ currentPageName, actionSlot }) {
  const title = pageTitles[currentPageName?.toLowerCase()] ?? currentPageName ?? "MTG Tracker";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/60 h-14 flex items-center px-4">
      <div className="flex items-center gap-2 flex-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <h1 className="text-white font-semibold text-base">{title}</h1>
      </div>
      {/* Reserved slot for future actions (auth buttons, icons, etc.) */}
      <div className="flex items-center gap-2">
        {actionSlot ?? null}
      </div>
    </header>
  );
}