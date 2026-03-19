import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { Clock, ChevronRight, Trophy } from "lucide-react";
import { format } from "date-fns";

function GameRow({ game, participants, profiles, onClick }) {
  const winner = participants.find((p) => p.placement === 1 || p.result === "win");
  const winnerProfile = winner ? profiles[winner.participant_profile_id] : null;
  const date = game.played_at ? format(new Date(game.played_at), "MMM d, yyyy") : "Unknown date";

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 last:border-0 cursor-pointer hover:bg-gray-800/30 transition-colors" onClick={onClick}>
      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
        <Trophy className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">{participants.length}-player game</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-gray-500 text-xs">{date}</span>
          {winnerProfile && <span className="text-gray-400 text-xs">· Winner: {winnerProfile.display_name}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.status === "approved" ? "bg-green-500/10 text-green-400" : game.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
          {game.status}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
      </div>
    </div>
  );
}

export default function PodActivityTab({ podId, myMembership, onOpenGame }) {
  const { currentUser } = useAuth();
  const [games, setGames] = useState([]);
  const [participantMap, setParticipantMap] = useState({});
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterPlayer, setFilterPlayer] = useState("");
  const [filterWinner, setFilterWinner] = useState("");

  useEffect(() => {
    if (!currentUser?.id) return;
    if (myMembership?.membership_status !== "active") { setLoading(false); return; }
    async function load() {
      setLoading(true);
      try {
        // Use scoped backend function — pod history for active members only.
        // This is intentionally broader than personal history (all pod games visible)
        // but is gated server-side to active pod members only.
        const res = await base44.functions.invoke('publicProfiles', {
          action: 'podHistory',
          podId,
          callerProfileId: currentUser.id,
        });
        const { games: podGames = [], participants = {}, profiles: profileMap = {} } = res.data || {};
        setParticipantMap(participants);
        setProfiles(profileMap);
        setGames(podGames.sort((a, b) => new Date(b.played_at || b.created_date) - new Date(a.played_at || a.created_date)));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [podId, currentUser?.id, myMembership?.membership_status]);

  const filteredGames = games.filter((g) => {
    const participants = participantMap[g.id] || [];
    if (filterPlayer) {
      const profile = profiles[filterPlayer];
      if (!profile) return false;
      if (!participants.find((p) => p.participant_profile_id === filterPlayer)) return false;
    }
    if (filterWinner) {
      const winner = participants.find((p) => p.placement === 1 || p.result === "win");
      if (!winner || winner.participant_profile_id !== filterWinner) return false;
    }
    return true;
  });

  // Build unique players list for filter
  const allPlayerIds = [...new Set(Object.values(participantMap).flat().map((p) => p.participant_profile_id).filter(Boolean))];

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      {allPlayerIds.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterPlayer}
            onChange={(e) => setFilterPlayer(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 h-8 text-xs focus:outline-none"
          >
            <option value="">All players</option>
            {allPlayerIds.map((id) => (
              <option key={id} value={id}>{profiles[id]?.display_name || id}</option>
            ))}
          </select>
          <select
            value={filterWinner}
            onChange={(e) => setFilterWinner(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 h-8 text-xs focus:outline-none"
          >
            <option value="">Any winner</option>
            {allPlayerIds.map((id) => (
              <option key={id} value={id}>{profiles[id]?.display_name || id}</option>
            ))}
          </select>
          {(filterPlayer || filterWinner) && (
            <button onClick={() => { setFilterPlayer(""); setFilterWinner(""); }} className="text-xs text-gray-400 hover:text-gray-200 px-2">
              Clear
            </button>
          )}
        </div>
      )}

      {filteredGames.length === 0 ? (
        <div className="py-10 text-center">
          <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No activity yet</p>
          <p className="text-gray-600 text-xs mt-1">Games will appear here once they are logged and approved.</p>
        </div>
      ) : (
        <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl overflow-hidden">
          {filteredGames.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              participants={participantMap[game.id] || []}
              profiles={profiles}
              onClick={() => onOpenGame(game.id, podId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}