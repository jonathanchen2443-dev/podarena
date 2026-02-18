import React from "react";
import TopBar from "@/components/shell/TopBar";
import BottomNav from "@/components/shell/BottomNav";

// Pages that use the app shell (bottom nav + top bar)
const SHELL_PAGES = ["home", "leagueslist", "loggame", "inbox", "profile"];
// Sub-pages that belong to a shell tab and should also show the nav
const SHELL_SUB_PAGES = ["leagues", "dashboard", "decks", "approvals"];

function usesShell(pageName) {
  if (!pageName) return false;
  const lower = pageName.toLowerCase();
  return SHELL_PAGES.includes(lower) || SHELL_SUB_PAGES.includes(lower);
}

export default function Layout({ children, currentPageName }) {
  const shell = usesShell(currentPageName);

  if (!shell) {
    // Legacy pages (or pages that opt out): render with old top nav behavior
    return (
      <div className="min-h-screen bg-gray-950">
        <style>{`
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
        `}</style>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <style>{`
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
        /* Safe area padding for notched devices */
        .safe-area-pb {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>

      {/* Top Bar */}
      <TopBar currentPageName={currentPageName} />

      {/* Page content: padded for top bar (56px) + bottom nav (64px) */}
      <main className="pt-14 pb-20 px-4 max-w-lg mx-auto min-h-screen">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Global modal portal target — ready for future modal overlays */}
      <div id="modal-root" />
    </div>
  );
}