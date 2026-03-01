import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, LogIn, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { isFounder } from "@/components/services/founderService";
import { ensureSettings, getSettings, invalidateSettingsCache, INITIAL_FOUNDER_USER_IDS } from "@/components/services/appSettingsService";
import { base44 } from "@/api/base44Client";
import FoundersSection from "@/components/founder/FoundersSection";
import NavBuilderSection from "@/components/founder/NavBuilderSection";
import FeatureFlagsSection from "@/components/founder/FeatureFlagsSection";
import DevSeederSection from "@/components/founder/DevSeederSection";
import OverviewSection from "@/components/founder/OverviewSection";
import EntityBrowserSection from "@/components/founder/EntityBrowserSection";
import LeagueOverridesSection from "@/components/founder/LeagueOverridesSection";
import NotificationSenderSection from "@/components/founder/NotificationSenderSection";
import ConfigEditorSection from "@/components/founder/ConfigEditorSection";
import QAHealthSection from "@/components/founder/QAHealthSection";

const TABS = [
  { key: "overview",    label: "Overview" },
  { key: "founders",    label: "Founders" },
  { key: "nav",         label: "Navigation" },
  { key: "flags",       label: "Flags" },
  { key: "browser",     label: "Browser" },
  { key: "leagues",     label: "Leagues" },
  { key: "notifs",      label: "Notifs" },
  { key: "config",      label: "Config" },
  { key: "qa",          label: "QA" },
  { key: "seeder",      label: "Seeder" },
];

export default function Founder() {
  const auth = useAuth();
  const { isGuest, authLoading } = auth;

  const [checking, setChecking] = useState(true);
  const [founder, setFounder] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const load = useCallback(async () => {
    if (authLoading || isGuest) { setChecking(false); return; }
    try {
      // Only bootstrap if this user is an initial founder — lockdown
      if (INITIAL_FOUNDER_USER_IDS.includes(auth.currentUser?.id)) {
        await ensureSettings(auth);
      }
      const s = await getSettings();
      if (!s && !INITIAL_FOUNDER_USER_IDS.includes(auth.currentUser?.id)) {
        setSettingsError(true);
        setChecking(false);
        return;
      }
      const ok = await isFounder(auth);
      setFounder(ok);
      setSettings(s);
    } catch (e) {
      setFounder(false);
    } finally {
      setChecking(false);
    }
  }, [authLoading, isGuest, auth]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    invalidateSettingsCache();
    const s = await getSettings();
    setSettings(s);
    const ok = await isFounder(auth);
    setFounder(ok);
  }

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--ds-primary-text)" }} />
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center gap-5">
        <div className="w-14 h-14 rounded-2xl ds-accent-bg ds-accent-bd border flex items-center justify-center">
          <LogIn className="w-7 h-7" style={{ color: "var(--ds-primary-text)" }} />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Sign in required</h2>
          <p className="text-gray-400 text-sm mt-1">You need to be signed in to access this page.</p>
        </div>
        <Button className="ds-btn-primary text-white rounded-xl" onClick={() => base44.auth.redirectToLogin()}>
          Sign In
        </Button>
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Lock className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Founder settings not initialized</h2>
          <p className="text-gray-400 text-sm mt-1">Access denied. Settings must be bootstrapped by the initial founder.</p>
        </div>
      </div>
    );
  }

  if (!founder) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Lock className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Access Denied</h2>
          <p className="text-gray-400 text-sm mt-1">This area is restricted to Founders only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-9 h-9 rounded-xl ds-accent-bg ds-accent-bd border flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" style={{ color: "var(--ds-primary-text)" }} />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Founder Console</h1>
          <p className="text-gray-600 text-xs">Internal admin · not visible to users</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === t.key
                ? "ds-btn-primary text-white"
                : "bg-gray-800 text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview"  && <OverviewSection settings={settings} />}
      {activeTab === "founders"  && <FoundersSection settings={settings} auth={auth} onRefresh={handleRefresh} />}
      {activeTab === "nav"       && <NavBuilderSection settings={settings} onRefresh={handleRefresh} />}
      {activeTab === "flags"     && <FeatureFlagsSection settings={settings} onRefresh={handleRefresh} />}
      {activeTab === "browser"   && <EntityBrowserSection />}
      {activeTab === "leagues"   && <LeagueOverridesSection />}
      {activeTab === "notifs"    && <NotificationSenderSection auth={auth} />}
      {activeTab === "config"    && <ConfigEditorSection settings={settings} onRefresh={handleRefresh} />}
      {activeTab === "qa"        && <QAHealthSection auth={auth} />}
      {activeTab === "seeder"    && <DevSeederSection auth={auth} />}
    </div>
  );
}