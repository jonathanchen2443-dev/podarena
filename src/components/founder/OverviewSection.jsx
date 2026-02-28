import React, { useState, useEffect } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { DEFAULT_FEATURE_FLAGS } from "@/components/services/appSettingsService";

function StatCard({ label, value, color = "text-white" }) {
  return (
    <div className="bg-gray-800/60 rounded-xl px-3 py-3">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function OverviewSection({ settings }) {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [profiles, leagues, games, approvals, notifications] = await Promise.all([
      base44.entities.Profile.list("-created_date", 500),
      base44.entities.League.list("-created_date", 500),
      base44.entities.Game.list("-created_date", 500),
      base44.entities.GameApproval.filter({ status: "pending" }),
      base44.entities.Notification.list("-created_date", 200),
    ]);
    setCounts({
      profiles: profiles.length,
      leagues: leagues.length,
      games: games.length,
      pendingApprovals: approvals.length,
      unreadNotifications: notifications.filter((n) => !n.read_at).length,
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const flags = { ...DEFAULT_FEATURE_FLAGS, ...(settings?.feature_flags || {}) };
  const enabledFlags = Object.entries(flags).filter(([, v]) => v).map(([k]) => k);
  const disabledFlags = Object.entries(flags).filter(([, v]) => !v).map(([k]) => k);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold text-sm">Overview</h2>
        </div>
        <button onClick={load} className="text-gray-600 hover:text-gray-400">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array(5).fill(0).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-800/60 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Profiles" value={counts.profiles} />
          <StatCard label="Leagues" value={counts.leagues} />
          <StatCard label="Games" value={counts.games} />
          <StatCard label="Pending Approvals" value={counts.pendingApprovals} color="text-amber-400" />
          <StatCard label="Unread Notifs" value={counts.unreadNotifications} color="text-sky-400" />
          <StatCard label="Founders" value={settings?.founder_user_ids?.length || 0} color="text-violet-400" />
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-gray-600 uppercase tracking-wider">Feature Flags</p>
        <div className="flex flex-wrap gap-1.5">
          {enabledFlags.map((k) => <span key={k} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">{k}</span>)}
          {disabledFlags.map((k) => <span key={k} className="text-[10px] bg-gray-800 text-gray-600 px-2 py-0.5 rounded-full line-through">{k}</span>)}
        </div>
      </div>
    </div>
  );
}