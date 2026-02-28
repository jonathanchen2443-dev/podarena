import React, { useState } from "react";
import { Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { invalidateLeagueCache } from "@/components/services/leagueService";
import { toast } from "sonner";

function ConfirmRow({ label, onConfirm, loading, color = "violet" }) {
  const [confirming, setConfirming] = useState(false);
  const cls = color === "red"
    ? "bg-red-600 hover:bg-red-700"
    : color === "amber"
    ? "bg-amber-600 hover:bg-amber-700"
    : "bg-violet-600 hover:bg-violet-700";
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-300">{label}</span>
      {confirming ? (
        <div className="flex gap-1.5">
          <button onClick={() => setConfirming(false)} className="text-xs text-gray-500 hover:text-gray-300 px-2">Cancel</button>
          <button
            onClick={() => { setConfirming(false); onConfirm(); }}
            className={`text-xs text-white px-2.5 py-1 rounded-lg ${cls}`}
            disabled={loading}
          >
            Confirm
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className={`text-xs text-white px-2.5 py-1 rounded-lg ${cls}`} disabled={loading}>
          Run
        </button>
      )}
    </div>
  );
}

export default function LeagueOverridesSection() {
  const [leagueId, setLeagueId] = useState("");
  const [userId, setUserId] = useState("");
  const [newMax, setNewMax] = useState("12");
  const [loading, setLoading] = useState(false);

  async function run(fn) {
    if (!leagueId.trim()) { toast.error("Enter a League ID first."); return; }
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  }

  async function increaseMax() {
    await run(async () => {
      const max = Math.max(2, Math.min(100, Number(newMax) || 12));
      await base44.entities.League.update(leagueId.trim(), { max_members: max });
      invalidateLeagueCache(leagueId.trim());
      toast.success(`max_members set to ${max}.`);
    });
  }

  async function regenInvite() {
    await run(async () => {
      const existing = await base44.entities.LeagueInvite.filter({ league_id: leagueId.trim(), is_active: true });
      await Promise.all(existing.map((i) => base44.entities.LeagueInvite.update(i.id, { is_active: false })));
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      await base44.entities.LeagueInvite.create({ league_id: leagueId.trim(), token, created_by_user_id: "founder-override", is_active: true });
      invalidateLeagueCache(leagueId.trim());
      toast.success("Invite regenerated. Token: " + token);
    });
  }

  async function forceRemoveMember() {
    await run(async () => {
      if (!userId.trim()) { toast.error("Enter a User ID."); return; }
      const members = await base44.entities.LeagueMember.filter({ league_id: leagueId.trim(), user_id: userId.trim() });
      if (!members.length) { toast.error("Member not found."); return; }
      await base44.entities.LeagueMember.update(members[0].id, { status: "removed" });
      invalidateLeagueCache(leagueId.trim());
      toast.success("Member removed.");
    });
  }

  async function forcePromoteAdmin() {
    await run(async () => {
      if (!userId.trim()) { toast.error("Enter a User ID."); return; }
      const members = await base44.entities.LeagueMember.filter({ league_id: leagueId.trim(), user_id: userId.trim() });
      if (!members.length) { toast.error("Member not found."); return; }
      await base44.entities.LeagueMember.update(members[0].id, { role: "admin" });
      invalidateLeagueCache(leagueId.trim());
      toast.success("Member promoted to admin.");
    });
  }

  async function forceAddMember() {
    await run(async () => {
      if (!userId.trim()) { toast.error("Enter a User ID."); return; }
      await base44.entities.LeagueMember.create({
        league_id: leagueId.trim(), user_id: userId.trim(),
        role: "member", status: "active", joined_at: new Date().toISOString(),
      });
      invalidateLeagueCache(leagueId.trim());
      toast.success("Member added.");
    });
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wrench className="w-4 h-4 text-amber-400" />
        <h2 className="text-white font-semibold text-sm">League Overrides</h2>
        <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">founder only</span>
      </div>

      <div className="space-y-2">
        <input value={leagueId} onChange={(e) => setLeagueId(e.target.value)} placeholder="League ID (required)"
          className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500" />
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User/Profile ID (for member actions)"
          className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500" />
      </div>

      <div className="bg-gray-800/30 rounded-xl px-3 py-1 space-y-0.5">
        <div className="flex items-center gap-2 py-1">
          <input value={newMax} onChange={(e) => setNewMax(e.target.value)} placeholder="New max"
            className="w-20 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500" />
          <span className="text-xs text-gray-500 flex-1">→ max_members override</span>
          <ConfirmRow label="" onConfirm={increaseMax} loading={loading} color="amber" />
        </div>
        <ConfirmRow label="Regenerate invite token" onConfirm={regenInvite} loading={loading} color="amber" />
        <ConfirmRow label="Force remove member" onConfirm={forceRemoveMember} loading={loading} color="red" />
        <ConfirmRow label="Force promote to admin" onConfirm={forcePromoteAdmin} loading={loading} color="violet" />
        <ConfirmRow label="Force add member (active)" onConfirm={forceAddMember} loading={loading} color="violet" />
      </div>
    </div>
  );
}