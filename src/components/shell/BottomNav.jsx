import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, PlusCircle, Home, Bell, User } from "lucide-react";

const tabs = [
  { label: "Leagues", icon: Users, page: "LeaguesList", root: "/leagues-list" },
  { label: "Log Game", icon: PlusCircle, page: "LogGame", root: "/log-game" },
  { label: "Home", icon: Home, page: "Home", root: "/home" },
  { label: "Inbox", icon: Bell, page: "Inbox", root: "/inbox" },
  { label: "Profile", icon: User, page: "Profile", root: "/profile" },
];

export default function BottomNav() {
  const location = useLocation();

  const isActive = (tab) => {
    const url = createPageUrl(tab.page).toLowerCase();
    return location.pathname.toLowerCase().startsWith(url);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-xl border-t border-gray-800/60 safe-area-pb">
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.page}
              to={createPageUrl(tab.page)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group"
              onClick={(e) => {
                // If already on this tab's root, do nothing extra (link handles it)
              }}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-violet-500" />
              )}
              <tab.icon
                className={`w-5 h-5 transition-colors ${
                  active ? "text-violet-400" : "text-gray-500 group-hover:text-gray-300"
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  active ? "text-violet-400" : "text-gray-500 group-hover:text-gray-300"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}