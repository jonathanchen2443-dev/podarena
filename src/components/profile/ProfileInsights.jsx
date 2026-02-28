import React, { useState, useEffect } from "react";
import { Trophy, Swords, Layers, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { getProfileInsights } from "@/components/services/profileInsightsService";

function InsightCard({ icon: Icon, color, label, value, sub, imageUrl }) {
  const colorMap = {
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    amber:  "text-amber-400  bg-amber-500/10  border-amber-500/20",
    sky:    "text-sky-400    bg-sky-500/10    border-sky-500/20",
  };
  const iconCls = colorMap[color] || colorMap.violet;

  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${iconCls}`}>
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-gray-500 text-[10px] font-medium uppercase tracking-wide leading-none">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="w-6 h-6 rounded-md object-cover flex-shrink-0 border border-gray-700"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        )}
        <div>
          <p className="text-white font-semibold text-sm leading-tight">{value}</p>
          {sub && <p className="text-gray-500 text-[10px] leading-snug">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ProfileInsights({ auth }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth || auth.isGuest || auth.authLoading) return;
    load();
  }, [auth?.currentUser?.id, auth?.authLoading]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getProfileInsights(auth);
      setInsights(data);
    } catch (e) {
      const isRate = e?.message?.toLowerCase().includes("rate") || e?.message?.toLowerCase().includes("429");
      setError(isRate ? "Too many requests. Wait a moment and retry." : "Could not load insights.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-white font-semibold text-base px-1">Insights</h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h2 className="text-white font-semibold text-base px-1">Insights</h2>
        <div className="flex flex-col items-center gap-2 py-4">
          <AlertCircle className="w-5 h-5 text-red-400/70" />
          <p className="text-red-400 text-xs text-center">{error}</p>
          <button
            onClick={load}
            className="flex items-center gap-1 text-violet-400 text-xs hover:text-violet-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const { totalWinRatePercent, wins, gamesPlayed, mostDefeatedOpponent, mostPlayedDeck } = insights;

  return (
    <div className="space-y-3">
      <h2 className="text-white font-semibold text-base px-1">Insights</h2>
      <div className="grid grid-cols-2 gap-2">
        <InsightCard
          icon={Trophy}
          color="amber"
          label="Total Win Rate"
          value={gamesPlayed === 0 ? "—" : `${totalWinRatePercent}%`}
          sub={gamesPlayed === 0 ? "No approved games yet" : `${wins} wins / ${gamesPlayed} games`}
        />
        <InsightCard
          icon={Swords}
          color="violet"
          label="Most Defeated Opponent"
          value={mostDefeatedOpponent ? mostDefeatedOpponent.displayName : "—"}
          sub={mostDefeatedOpponent ? `Defeated ${mostDefeatedOpponent.count}×` : "Win some games first"}
        />
        <InsightCard
          icon={Layers}
          color="sky"
          label="Most Played Deck"
          value={mostPlayedDeck ? mostPlayedDeck.commanderName : "—"}
          sub={mostPlayedDeck ? `${mostPlayedDeck.count} games` : "Log games with decks"}
          imageUrl={mostPlayedDeck?.imageUrl}
        />
      </div>
    </div>
  );
}