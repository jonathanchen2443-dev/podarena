import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getOrCreateProfile } from "@/components/services/gameService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Globe, Lock, Plus } from "lucide-react";

export default function Leagues() {
  const [profile, setProfile] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(true);

  useEffect(() => {
    loadLeagues();
  }, []);

  async function loadLeagues() {
    const authenticated = await base44.auth.isAuthenticated();
    setIsGuest(!authenticated);

    let p = null;
    if (authenticated) {
      p = await getOrCreateProfile();
      setProfile(p);
    }

    const allLeagues = await base44.entities.League.list("-created_date");

    if (p) {
      const myMemberships = await base44.entities.LeagueMember.filter({
        user_id: p.id,
        status: "active",
      });
      setMemberships(myMemberships);

      // Show public leagues + leagues I'm a member of
      const memberLeagueIds = new Set(myMemberships.map((m) => m.league_id));
      const visible = allLeagues.filter(
        (l) => l.is_public || memberLeagueIds.has(l.id)
      );
      setLeagues(visible);
    } else {
      // Guest: only public
      setLeagues(allLeagues.filter((l) => l.is_public));
    }

    setLoading(false);
  }

  function isMember(leagueId) {
    return memberships.some((m) => m.league_id === leagueId);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-40 bg-gray-800" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Leagues</h1>
          {!isGuest && (
            <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Create League
            </Button>
          )}
        </div>

        {isGuest && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            You're browsing as a guest. Sign in to join leagues and log games.
          </div>
        )}

        {leagues.length === 0 ? (
          <Card className="bg-gray-900/50 border-gray-800/50">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No leagues found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leagues.map((league) => (
              <Card
                key={league.id}
                className="bg-gray-900/50 border-gray-800/50 hover:border-gray-700/50 transition-colors"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{league.name}</h3>
                        <Badge
                          variant="outline"
                          className={
                            league.is_public
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          }
                        >
                          {league.is_public ? (
                            <><Globe className="w-3 h-3 mr-1" /> Public</>
                          ) : (
                            <><Lock className="w-3 h-3 mr-1" /> Private</>
                          )}
                        </Badge>
                        {isMember(league.id) && (
                          <Badge
                            variant="outline"
                            className="bg-violet-500/10 text-violet-400 border-violet-500/20"
                          >
                            Member
                          </Badge>
                        )}
                      </div>
                      {league.description && (
                        <p className="text-gray-400 text-sm">{league.description}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}