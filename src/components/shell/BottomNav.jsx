import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, PlusCircle, Home, Bell, User, LayoutGrid, Layers, Network } from "lucide-react";
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
  Layers,
  Network,
};

// Normalize legacy LEAGUES routeKey to PODS
function normalizePODsTab(tab) {
  if (tab.routeKey === "LEAGUES") {
    return { ...tab, label: "PODS", icon: "Network", routeKey: "PODS" };
  }
  return tab;
}

// Route key -> href
const ROUTE_MAP = {
  PODS:     ROUTES.MY_PODS,

  LOG_GAME: ROUTES.LOG_GAME,
  HOME:     ROUTES.HOME,
  INBOX:    ROUTES.INBOX,
  PROFILE:  ROUTES.PROFILE,
};

function buildTabs(config) {
  const source = (config && Array.isArray(config) && config.length > 0) ? config : DEFAULT_NAV_CONFIG;
  return source
    .filter((t) => t.enabled)
    .map(normalizePODsTab)
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

  const POD_PATHS = ["/mypods", "/allpods", "/explorepods", "/pod", "/createpod", "/pods"];
  const isActive = (tab) => {
    const path = location.pathname.toLowerCase();
    const tabHref = tab.href.toLowerCase();
    // All POD-related pages highlight the PODS tab
    const isPodsTab = POD_PATHS.some((p) => tabHref.includes(p.replace("/", "")));
    if (isPodsTab && POD_PATHS.some((p) => path.startsWith(p))) return true;
    return path.startsWith(tabHref);
  };

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
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ds-accent-bg" style={{ backgroundColor: "rgb(var(--ds-primary-rgb))" }} />
              )}
              <Icon
                className={`w-5 h-5 transition-colors ${active ? "ds-nav-active" : "text-gray-500 group-hover:text-gray-300"}`}
                style={active ? { color: "var(--ds-primary-text)" } : undefined}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${active ? "" : "text-gray-500 group-hover:text-gray-300"}`}
                style={active ? { color: "var(--ds-primary-text)" } : undefined}
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