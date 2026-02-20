import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { getOrCreateProfile } from "@/components/services/gameService";
import { Swords, Shield, Users, AlertCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const p = await getOrCreateProfile();
    if (!p) {
      base44.auth.redirectToLogin();
      return;
    }
    setProfile(p);

    const [allLeagues, allApprovals, allGames, allDecks] = await Promise.all([
      base44.entities.LeagueMember.filter({ user_id: p.id, status: "active" }),
      base44.entities.GameApproval.filter({ approver_user_id: p.id, status: "pending" }),
      base44.entities.GameParticipant.filter({ user_id: p.id }),
      base44.entities.Deck.filter({ owner_id: p.id }),
    ]);

    // Get league details
    const leagueIds = [...new Set(allLeagues.map((m) => m.league_id))];
    const leagueDetails = [];
    for (const id of leagueIds) {
      const leagues = await base44.entities.League.filter({ id });
      if (leagues.length) leagueDetails.push(leagues[0]);
    }

    setLeagues(leagueDetails);
    setPendingApprovals(allApprovals);
    setDecks(allDecks);

    // Get recent games
    const gameIds = [...new Set(allGames.map((gp) => gp.game_id))];
    const gameDetails = [];
    for (const id of gameIds.slice(0, 5)) {
      const games = await base44.entities.Game.filter({ id });
      if (games.length) gameDetails.push(games[0]);
    }
    setRecentGames(gameDetails.sort((a, b) => new Date(b.played_at) - new Date(a.played_at)));

    setLoading(false);
  }

  const statusColors = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-gray-800" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 bg-gray-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {profile?.display_name}
          </h1>
          <p className="text-gray-400 mt-1">Here's what's happening in your leagues.</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-900/50 border-gray-800/50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{leagues.length}</p>
                <p className="text-sm text-gray-400">Leagues</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800/50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Swords className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{recentGames.length}</p>
                <p className="text-sm text-gray-400">Games</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800/50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{decks.length}</p>
                <p className="text-sm text-gray-400">Decks</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800/50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pendingApprovals.length}</p>
                <p className="text-sm text-gray-400">Pending Approvals</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Games */}
          <Card className="bg-gray-900/50 border-gray-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">Recent Games</CardTitle>
                <Link to={createPageUrl("Leagues")}>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                    View All <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentGames.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">No games yet. Log your first game!</p>
              ) : (
                recentGames.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-gray-800/50"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">
                        {new Date(game.played_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      {game.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{game.notes}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={statusColors[game.status]}>
                      {game.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Your Leagues */}
          <Card className="bg-gray-900/50 border-gray-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">Your Leagues</CardTitle>
                <Link to={createPageUrl("Leagues")}>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                    View All <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {leagues.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">You haven't joined any leagues yet.</p>
              ) : (
                leagues.map((league) => (
                  <Link
                    key={league.id}
                    to={createPageUrl("Leagues") + `?leagueId=${league.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-gray-800/50 hover:border-gray-700/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{league.name}</p>
                      {league.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                          {league.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        league.is_public
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                      }
                    >
                      {league.is_public ? "Public" : "Private"}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}