import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { LogIn, User } from "lucide-react";
import TopBar from "@/components/shell/TopBar";
import BottomNav from "@/components/shell/BottomNav";
import { AuthProvider, useAuth } from "@/components/auth/AuthContext";

// Pages that use the app shell (bottom nav + top bar)
const SHELL_PAGES = ["home", "leagueslist", "loggame", "inbox", "profile"];
// Sub-pages that belong to a shell tab and should also show the nav
// Note: approvals and decks are now redirect shims — still show shell so the redirect renders cleanly
const SHELL_SUB_PAGES = ["leagues", "dashboard", "approvals", "decks"];
// Pages that render without the shell (standalone) — /login is system-managed, not listed here
const NO_SHELL_PAGES = ["register"];

function usesShell(pageName) {
  if (!pageName) return false;
  const lower = pageName.toLowerCase();
  if (NO_SHELL_PAGES.includes(lower)) return false;
  return SHELL_PAGES.includes(lower) || SHELL_SUB_PAGES.includes(lower);
}

const CSS_VARS = `
  :root {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 6%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 6%;
    --popover-foreground: 0 0% 98%;
    --primary: 263 70% 50%;
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
    --ring: 263 70% 50%;
  }
  .safe-area-pb { padding-bottom: env(safe-area-inset-bottom, 0px); }
`;

function AuthActionSlot() {
  const { isGuest, currentUser, authLoading } = useAuth();
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
    <Link to={createPageUrl("Profile")} className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center hover:bg-violet-500/20 transition-colors">
      <User className="w-4 h-4 text-violet-400" />
    </Link>
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