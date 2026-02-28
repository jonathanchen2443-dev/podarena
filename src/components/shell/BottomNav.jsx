import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, PlusCircle, Home, Bell, User, LayoutGrid } from "lucide-react";
import { ROUTES } from "@/components/utils/routes";
import { getSettings, DEFAULT_NAV_CONFIG } from "@/components/services/appSettingsService";

// Safe icon whitelist
const ICON_MAP = {
  Users,
  PlusCircle,
  Home,
  Bell,
  User,
  LayoutGrid,
};

// Route key -> href
const ROUTE_MAP = {
  LEAGUES:  ROUTES.LEAGUES,
  LOG_GAME: ROUTES.LOG_GAME,
  HOME:     ROUTES.HOME,
  INBOX:    ROUTES.INBOX,
  PROFILE:  ROUTES.PROFILE,
};

function buildTabs(config) {
  if (!config || !Array.isArray(config) || config.length === 0) {
    return DEFAULT_NAV_CONFIG
      .filter((t) => t.enabled)
      .map((t) => ({ label: t.label, icon: ICON_MAP[t.icon] || Home, href: ROUTE_MAP[t.routeKey] }))
      .filter((t) => t.href);
  }
  return config
    .filter((t) => t.enabled)
    .map((t) => ({ label: t.label, icon: ICON_MAP[t.icon] || Home, href: ROUTE_MAP[t.routeKey] }))
    .filter((t) => t.href);
}

export default function BottomNav() {
  const location = useLocation();
  const [tabs, setTabs] = useState(() => buildTabs(DEFAULT_NAV_CONFIG));

  useEffect(() => {
    getSettings().then((s) => {
      if (s?.bottom_nav_config) setTabs(buildTabs(s.bottom_nav_config));
    }).catch(() => {});
  }, []);

  const isActive = (tab) => location.pathname.toLowerCase().startsWith(tab.href.toLowerCase());

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-xl border-t border-gray-800/60 safe-area-pb">
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group"
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-violet-500" />
              )}
              <Icon
                className={`w-5 h-5 transition-colors ${active ? "text-violet-400" : "text-gray-500 group-hover:text-gray-300"}`}
              />
              <span className={`text-[10px] font-medium transition-colors ${active ? "text-violet-400" : "text-gray-500 group-hover:text-gray-300"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}