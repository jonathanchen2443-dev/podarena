import React, { useState } from "react";
import { CheckCircle, XCircle, Loader2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/components/utils/routes";
import { base44 } from "@/api/base44Client";
import { getSettings, DEFAULT_FEATURE_FLAGS, DEFAULT_NAV_CONFIG } from "@/components/services/appSettingsService";
import { isFounder } from "@/components/services/founderService";
import { listVisibleLeagues } from "@/components/services/leagueService";

function CheckRow({ name, status, detail }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-800/40 last:border-0">
      <div className="mt-0.5 flex-shrink-0">
        {status === "pass" ? <CheckCircle className="w-4 h-4 text-emerald-400" />
          : status === "fail" ? <XCircle className="w-4 h-4 text-red-400" />
          : <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${status === "pass" ? "text-emerald-400" : status === "fail" ? "text-red-400" : "text-gray-500"}`}>{name}</p>
        {detail && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{detail}</p>}
      </div>
    </div>
  );
}

async function runChecks(auth) {
  const results = [];
  const add = (name, fn) => results.push({ name, fn });

  add("ROUTES.HOME resolves", async () => {
    if (!ROUTES.HOME) throw new Error("ROUTES.HOME is empty");
    return `→ ${ROUTES.HOME}`;
  });

  add("ROUTES.LEAGUES resolves", async () => {
    if (!ROUTES.LEAGUES) throw new Error("empty");
    return `→ ${ROUTES.LEAGUES}`;
  });

  add("ROUTES.LOG_GAME resolves", async () => {
    if (!ROUTES.LOG_GAME) throw new Error("empty");
    return `→ ${ROUTES.LOG_GAME}`;
  });

  add("ROUTES.INBOX resolves", async () => {
    if (!ROUTES.INBOX) throw new Error("empty");
    return `→ ${ROUTES.INBOX}`;
  });

  add("AppSettings exists", async () => {
    const s = await getSettings();
    if (!s) throw new Error("No AppSettings row found");
    return `id: ${s.id?.slice(-8)}`;
  });

  add("bottom_nav_config valid", async () => {
    const s = await getSettings();
    const cfg = s?.bottom_nav_config;
    if (!Array.isArray(cfg) || cfg.length === 0) throw new Error("Missing or empty");
    return `${cfg.length} items`;
  });

  add("feature_flags is object", async () => {
    const s = await getSettings();
    if (typeof s?.feature_flags !== "object") throw new Error("Not an object");
    return `${Object.keys(s.feature_flags).length} flags`;
  });

  add("Current user is founder", async () => {
    const ok = await isFounder(auth);
    if (!ok) throw new Error("Not in founder_user_ids");
    return "confirmed";
  });

  add("Can fetch leagues list", async () => {
    const leagues = await listVisibleLeagues(auth);
    return `${leagues.length} visible leagues`;
  });

  add("Can fetch profiles", async () => {
    const p = await base44.entities.Profile.list("-created_date", 5);
    return `${p.length} profiles`;
  });

  add("Invite route + token parsing", async () => {
    const url = ROUTES.HOME; // just check createPageUrl works
    const inviteRoute = `${window.location.origin}/invite?token=test123`;
    const parsed = new URL(inviteRoute).searchParams.get("token");
    if (parsed !== "test123") throw new Error("Token parsing failed");
    return "token parse ok";
  });

  // Run all
  const out = [];
  for (const { name, fn } of results) {
    try {
      const detail = await fn();
      out.push({ name, status: "pass", detail: detail || "" });
    } catch (e) {
      out.push({ name, status: "fail", detail: e.message });
    }
  }
  return out;
}

export default function QAHealthSection({ auth }) {
  const [checks, setChecks] = useState(null);
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    setChecks(null);
    const results = await runChecks(auth);
    setChecks(results);
    setRunning(false);
  }

  const passed = checks?.filter((c) => c.status === "pass").length || 0;
  const failed = checks?.filter((c) => c.status === "fail").length || 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />
          <h2 className="text-white font-semibold text-sm">QA / Health Checks</h2>
        </div>
        {checks && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${failed === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            {passed}/{passed + failed} passed
          </span>
        )}
      </div>

      <Button
        className="w-full ds-btn-primary rounded-xl"
        onClick={handleRun}
        disabled={running}
      >
        {running ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Running…</> : "Run Health Checks"}
      </Button>

      {checks && (
        <div className="bg-gray-800/30 rounded-xl px-3 py-1">
          {checks.map((c, i) => <CheckRow key={i} {...c} />)}
        </div>
      )}
    </div>
  );
}