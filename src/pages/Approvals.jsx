import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getOrCreateProfile, approveGame, rejectGame } from "@/components/services/gameService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Approvals() {
  const [profile, setProfile] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [games, setGames] = useState({});
  const [leagues, setLeagues] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadApprovals();
  }, []);

  async function loadApprovals() {
    const authenticated = await base44.auth.isAuthenticated();
    if (!authenticated) {
      base44.auth.redirectToLogin();
      return;
    }
    const p = await getOrCreateProfile();
    setProfile(p);

    const myApprovals = await base44.entities.GameApproval.filter({
      approver_user_id: p.id,
    });
    setApprovals(myApprovals.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return new Date(b.created_date) - new Date(a.created_date);
    }));

    // Load game details
    const gameIds = [...new Set(myApprovals.map((a) => a.game_id))];
    const gamesMap = {};
    const leaguesMap = {};
    for (const gid of gameIds) {
      const gs = await base44.entities.Game.filter({ id: gid });
      if (gs.length) {
        gamesMap[gid] = gs[0];
        if (!leaguesMap[gs[0].league_id]) {
          const ls = await base44.entities.League.filter({ id: gs[0].league_id });
          if (ls.length) leaguesMap[gs[0].league_id] = ls[0];
        }
      }
    }
    setGames(gamesMap);
    setLeagues(leaguesMap);
    setLoading(false);
  }

  async function handleApprove(approval) {
    setProcessing(approval.id);
    await approveGame(approval.game_id, profile.id);
    toast.success("Game approved!");
    await loadApprovals();
    setProcessing(null);
  }

  async function handleReject(approval) {
    setProcessing(approval.id);
    await rejectGame(approval.game_id, profile.id, "");
    toast.success("Game rejected.");
    await loadApprovals();
    setProcessing(null);
  }

  const statusConfig = {
    pending: { icon: Clock, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    approved: { icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    rejected: { icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/20" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-56 bg-gray-800" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Game Approvals</h1>

        {approvals.length === 0 ? (
          <Card className="bg-gray-900/50 border-gray-800/50">
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No approval requests. You're all caught up!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval) => {
              const game = games[approval.game_id];
              const league = game ? leagues[game.league_id] : null;
              const config = statusConfig[approval.status];
              const Icon = config.icon;

              return (
                <Card key={approval.id} className="bg-gray-900/50 border-gray-800/50">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className={config.color}>
                            <Icon className="w-3 h-3 mr-1" />
                            {approval.status}
                          </Badge>
                          {league && (
                            <span className="text-sm text-gray-400">{league.name}</span>
                          )}
                        </div>
                        {game && (
                          <p className="text-sm text-gray-300">
                            Game played{" "}
                            {new Date(game.played_at).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        )}
                        {game?.notes && (
                          <p className="text-xs text-gray-500 mt-1">{game.notes}</p>
                        )}
                        {approval.reason && (
                          <p className="text-xs text-red-400 mt-1">Reason: {approval.reason}</p>
                        )}
                      </div>

                      {approval.status === "pending" && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                            onClick={() => handleApprove(approval)}
                            disabled={processing === approval.id}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg"
                            onClick={() => handleReject(approval)}
                            disabled={processing === approval.id}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}