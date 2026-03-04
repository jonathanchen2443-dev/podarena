import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { LogIn, User, Bell } from "lucide-react";
import { ROUTES } from "@/components/utils/routes";
import { onInboxUpdated } from "@/components/services/inboxBus";
import { listMyPendingApprovals } from "@/components/services/gameService";
import TopBar from "@/components/shell/TopBar";
import BottomNav from "@/components/shell/BottomNav";
import { AuthProvider, useAuth } from "@/components/auth/AuthContext";
import { Toaster } from "@/components/ui/sonner";

// Pages that use the app shell (bottom nav + top bar)
const SHELL_PAGES = ["home", "dashboard", "leagueslist", "loggame", "inbox", "profile"];
// Sub-pages that belong to a shell tab and should also show the nav
// Note: approvals and decks are redirect shims — kept so they render inside the shell cleanly
const SHELL_SUB_PAGES = ["leagues", "dashboard", "approvals", "decks", "profiledecks", "leaguedetails", "userprofile", "createleague", "founder"];
// Pages that render without the shell (standalone) — /login is system-managed, not listed here
const NO_SHELL_PAGES = ["register"];

function usesShell(pageName) {
  if (!pageName) return false;
  const lower = pageName.toLowerCase();
  if (NO_SHELL_PAGES.includes(lower)) return false;
  return SHELL_PAGES.includes(lower) || SHELL_SUB_PAGES.includes(lower);
}

// ── THEME SWITCH ─────────────────────────────────────────────────────────────
// To revert to legacy violet theme: change THEME_MODE to "legacy"
// File: Layout.js
const THEME_MODE = "v2"; // "v2" = Blue primary (#5C7CFA) | "legacy" = Violet primary (#7C3AED)

const THEME_TOKENS = {
  legacy: {
    // Primary action: Violet #7C3AED
    "--ds-primary":          "124 58 237",   // #7C3AED
    "--ds-primary-h":        "263",
    "--ds-primary-s":        "70%",
    "--ds-primary-l":        "50%",
    "--ds-primary-muted-bg": "124 58 237 / 0.10",
    "--ds-primary-muted-bd": "124 58 237 / 0.20",
    "--ds-primary-text":     "167 139 250",  // violet-400
    "--ds-primary-hover":    "109 40 217",   // violet-700
  },
  v2: {
    // Primary action: Blue #5C7CFA
    "--ds-primary":          "92 124 250",   // #5C7CFA
    "--ds-primary-h":        "227",
    "--ds-primary-s":        "93%",
    "--ds-primary-l":        "67%",
    "--ds-primary-muted-bg": "92 124 250 / 0.10",
    "--ds-primary-muted-bd": "92 124 250 / 0.20",
    "--ds-primary-text":     "129 158 252",  // blue-400 equivalent
    "--ds-primary-hover":    "67 103 248",   // slightly darker blue
  },
};

const tokens = THEME_TOKENS[THEME_MODE] || THEME_TOKENS.v2;

const CSS_VARS = `
  :root {
    /* ── Design system tokens ─────────────────────── */
    /* Background layers */
    --ds-bg:       #0F1115;
    --ds-surface:  #161A20;
    --ds-elevated: #1E232B;
    --ds-border:   #2A2F38;

    /* Text hierarchy */
    --ds-text-primary:   #F5F7FA;
    --ds-text-secondary: #A0A8B4;
    --ds-text-tertiary:  #7E8794;

    /* Semantic */
    --ds-success: #2F9E44;
    --ds-danger:  #E03131;

    /* Primary action — controlled by THEME_MODE above */
    --ds-primary-rgb:      ${tokens["--ds-primary"]};
    --ds-primary-muted-bg: ${tokens["--ds-primary-muted-bg"]};
    --ds-primary-muted-bd: ${tokens["--ds-primary-muted-bd"]};
    --ds-primary-text:     ${tokens["--ds-primary-text"]};
    --ds-primary-btn:      rgb(${tokens["--ds-primary"]});
    --ds-primary-btn-hover:${tokens["--ds-primary-hover"]};

    /* Shadcn/Tailwind overrides */
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 6%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 6%;
    --popover-foreground: 0 0% 98%;
    --primary: ${tokens["--ds-primary-h"]} ${tokens["--ds-primary-s"]} ${tokens["--ds-primary-l"]};
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: ${tokens["--ds-primary-h"]} ${tokens["--ds-primary-s"]} ${tokens["--ds-primary-l"]};
  }

  /* ── Utility classes driven by design tokens ─── */
  .ds-btn-primary {
    background-color: var(--ds-primary-btn) !important;
    color: #fff !important;
  }
  .ds-btn-primary:hover {
    background-color: rgb(${tokens["--ds-primary-hover"]}) !important;
  }
  .ds-accent-text  { color: rgb(var(--ds-primary-rgb)) !important; }
  .ds-accent-bg    { background-color: rgb(var(--ds-primary-muted-bg)) !important; }
  .ds-accent-bd    { border-color: rgb(var(--ds-primary-muted-bd)) !important; }
  .ds-nav-active   { color: var(--ds-primary-text) !important; }

  .safe-area-pb { padding-bottom: env(safe-area-inset-bottom, 0px); }
`;

function AuthActionSlot() {
  const { isGuest, currentUser, authLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (isGuest || !currentUser) return;
    try {
      const [notifs, approvals] = await Promise.all([
        base44.entities.Notification.filter(
          { recipient_user_id: currentUser.id },
          "-created_date",
          100
        ),
        listMyPendingApprovals({ isGuest, currentUser, isAuthenticated: true }),
      ]);
      const unreadNotifs = notifs.filter((n) => !n.read_at).length;
      // Pending approvals are always "unread" (need action)
      const count = unreadNotifs + approvals.length;
      console.log("unreadCount", count, "notifs", notifs.length, "approvals", approvals.length);
      setUnreadCount(count);
    } catch (_) {}
  }, [isGuest, currentUser]);

  useEffect(() => {
    if (isGuest || !currentUser) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    // Re-fetch whenever Inbox marks read or deletes
    const unsub = onInboxUpdated(fetchUnread);
    return () => { clearInterval(interval); unsub(); };
  }, [isGuest, currentUser, fetchUnread]);

  if (authLoading) return null;

  if (isGuest) {
    return (
      <button
        onClick={() => base44.auth.redirectToLogin()}
        className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-800/50"
      >
        <LogIn className="w-4 h-4" />
        <span className="text-xs font-medium">Login</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Inbox icon with unread badge */}
      <Link
        to={ROUTES.INBOX}
        className="relative w-8 h-8 rounded-full flex items-center justify-center transition-colors ds-accent-bg ds-accent-bd border cursor-pointer"
      >
        <Bell className="w-4 h-4 pointer-events-none" style={{ color: "var(--ds-primary-text)" }} />
        {unreadCount > 0 && (
          <span
            className="pointer-events-none absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center px-0.5 leading-none"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
      {/* Profile icon */}
      <Link to={ROUTES.PROFILE} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors ds-accent-bg ds-accent-bd border">
        <User className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />
      </Link>
    </div>
  );
}

function AppShell({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <style>{CSS_VARS}</style>
      <TopBar currentPageName={currentPageName} actionSlot={<AuthActionSlot />} />
      <main className="pt-14 pb-20 px-4 max-w-lg mx-auto min-h-screen">
        {children}
      </main>
      <BottomNav />
      <div id="modal-root" />
      <Toaster position="bottom-center" richColors />
    </div>
  );
}

function StandaloneShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <style>{CSS_VARS}</style>
      {children}
      {/* modal-root available even on standalone pages */}
      <div id="modal-root" />
      <Toaster position="bottom-center" richColors />
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const shell = usesShell(currentPageName);
  const standalone = NO_SHELL_PAGES.includes(currentPageName?.toLowerCase());

  return (
    <AuthProvider>
      {shell ? (
        <AppShell currentPageName={currentPageName}>{children}</AppShell>
      ) : standalone ? (
        <StandaloneShell>{children}</StandaloneShell>
      ) : (
        // Legacy pages with no shell
        <div className="min-h-screen bg-gray-950">
          <style>{CSS_VARS}</style>
          {children}
        </div>
      )}
    </AuthProvider>
  );
}