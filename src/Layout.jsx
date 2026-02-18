import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Home,
  Users,
  Shield,
  CheckCircle2,
  LogIn,
  LogOut,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { name: "Home", icon: Home, page: "Home", requiresAuth: false },
  { name: "Dashboard", icon: Sparkles, page: "Dashboard", requiresAuth: true },
  { name: "Leagues", icon: Users, page: "Leagues", requiresAuth: false },
  { name: "Decks", icon: Shield, page: "Decks", requiresAuth: true },
  { name: "Approvals", icon: CheckCircle2, page: "Approvals", requiresAuth: true },
];

export default function Layout({ children, currentPageName }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    base44.auth.isAuthenticated().then(setIsLoggedIn);
  }, []);

  const visibleNav = navItems.filter(
    (item) => !item.requiresAuth || isLoggedIn
  );

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

      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to={createPageUrl("Home")}
            className="flex items-center gap-2 text-white font-bold text-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:inline bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              MTG Tracker
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {visibleNav.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link key={item.page} to={createPageUrl(item.page)}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-lg transition-all ${
                      isActive
                        ? "bg-violet-500/10 text-violet-400"
                        : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => base44.auth.logout()}
                className="text-gray-400 hover:text-white rounded-lg"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => base44.auth.redirectToLogin()}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-gray-400"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/50 px-4 pb-4 space-y-1">
            {visibleNav.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setMobileOpen(false)}
                >
                  <Button
                    variant="ghost"
                    className={`w-full justify-start rounded-lg ${
                      isActive
                        ? "bg-violet-500/10 text-violet-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Page Content */}
      <main className="pt-16">{children}</main>
    </div>
  );
}