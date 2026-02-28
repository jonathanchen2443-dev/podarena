import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, LogIn, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { isFounder } from "@/components/services/founderService";
import { ensureSettings, getSettings, invalidateSettingsCache } from "@/components/services/appSettingsService";
import { base44 } from "@/api/base44Client";
import FoundersSection from "@/components/founder/FoundersSection";
import NavBuilderSection from "@/components/founder/NavBuilderSection";
import FeatureFlagsSection from "@/components/founder/FeatureFlagsSection";
import DevSeederSection from "@/components/founder/DevSeederSection";

export default function Founder() {
  const auth = useAuth();
  const { isGuest, authLoading } = auth;

  const [checking, setChecking] = useState(true);
  const [founder, setFounder] = useState(false);
  const [settings, setSettings] = useState(null);

  const load = useCallback(async () => {
    if (authLoading || isGuest) { setChecking(false); return; }
    try {
      // Bootstrap if first time
      await ensureSettings(auth);
      const [ok, s] = await Promise.all([isFounder(auth), getSettings()]);
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
    // re-check founder status after settings refresh
    const ok = await isFounder(auth);
    setFounder(ok);
  }

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <LogIn className="w-7 h-7 text-violet-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Sign in required</h2>
          <p className="text-gray-400 text-sm mt-1">You need to be signed in to access this page.</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700 rounded-xl" onClick={() => base44.auth.redirectToLogin()}>
          Sign In
        </Button>
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
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Founder Console</h1>
          <p className="text-gray-600 text-xs">Internal admin · not visible to users</p>
        </div>
      </div>

      <FoundersSection settings={settings} auth={auth} onRefresh={handleRefresh} />
      <NavBuilderSection settings={settings} onRefresh={handleRefresh} />
      <FeatureFlagsSection settings={settings} onRefresh={handleRefresh} />
      <DevSeederSection auth={auth} />
    </div>
  );
}