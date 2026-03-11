import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Swords, Trophy, Clock } from "lucide-react";
import { getPODLeaderboard } from "@/components/services/podService";

export default function PodLeaderboardTab({ pod, myMembership, podId }) {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [lb, allProfiles] = await Promise.all([
          getPODLeaderboard(podId),
          base44.entities.Profile.list("-created_date", 200),
        ]);
        const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p]));
        setProfiles(profileMap);
        setLeaderboard(lb);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [podId]);

  const isActiveMember = myMembership?.membership_status === "active";
  const hasPendingOrInvite = myMembership && ["pending_request", "invited_pending"].includes(myMembership.membership_status);

  function handleLogGame() {
    navigate(`${createPageUrl("LogGame")}?contextType=pod&podId=${podId}&podName=${encodeURIComponent(pod.pod_name)}`);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* CTA */}
      {isActiveMember ? (
        <Button onClick={handleLogGame} className="w-full ds-btn-primary h-11 rounded-xl text-sm font-semibold flex items-center gap-2">
          <Swords className="w-4 h-4" />
          Log a Game
        </Button>
      ) : hasPendingOrInvite ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
          <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-amber-400 text-sm font-medium">
            {myMembership.membership_status === "pending_request" ? "Request sent — waiting for admin approval" : "Invite received — waiting for admin to activate"}
          </p>
        </div>
      ) : null}

      {leaderboard.length === 0 ? (
        <div className="py-10 text-center">
          <Trophy className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No activity yet</p>
          <p className="text-gray-600 text-xs mt-1">The leaderboard will appear after the first approved game.</p>
        </div>
      ) : (
        <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[28px_1fr_40px_40px_48px_52px] gap-1 px-4 py-2 border-b border-gray-800/50">
            <span className="text-gray-600 text-xs font-medium">#</span>
            <span className="text-gray-600 text-xs font-medium">Player</span>
            <span className="text-gray-600 text-xs font-medium text-center">G</span>
            <span className="text-gray-600 text-xs font-medium text-center">W</span>
            <span className="text-gray-600 text-xs font-medium text-center">Pts</span>
            <span className="text-gray-600 text-xs font-medium text-right">Win%</span>
          </div>
          {leaderboard.map((entry, idx) => {
            const profile = profiles[entry.profileId];
            return (
              <div key={entry.profileId} className="grid grid-cols-[28px_1fr_40px_40px_48px_52px] gap-1 items-center px-4 py-2.5 border-b border-gray-800/30 last:border-0">
                <span className={`text-sm font-bold ${idx === 0 ? "text-amber-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-700" : "text-gray-600"}`}>
                  {idx + 1}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} className="w-6 h-6 rounded-full object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                      {(profile?.display_name || "?")[0]}
                    </div>
                  )}
                  <span className="text-white text-sm truncate">{profile?.display_name || "Unknown"}</span>
                </div>
                <span className="text-gray-300 text-sm text-center">{entry.games}</span>
                <span className="text-gray-300 text-sm text-center">{entry.wins}</span>
                <span className="text-white text-sm font-semibold text-center">{entry.points}</span>
                <span className="text-gray-400 text-xs text-right">{entry.winRate}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}