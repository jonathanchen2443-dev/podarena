import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, ChevronRight, Globe, Lock, Plus } from "lucide-react";
import { LoadingState, EmptyState, ErrorState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/AuthContext";
import { listVisibleLeagues } from "@/components/services/leagueService";

export default function LeaguesList() {
  const auth = useAuth();
  const { isGuest, authLoading } = auth;
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    loadLeagues();
  }, [authLoading, isGuest]);

  async function loadLeagues() {
    setLoading(true);
    setError(null);
    const data = await listVisibleLeagues(auth);
    setLeagues(data);
    setLoading(false);
  }

  if (authLoading || loading) return <LoadingState message="Loading leagues…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-400">{leagues.length} league{leagues.length !== 1 ? "s" : ""}</p>
        {!isGuest && (
          <button className="text-sm text-violet-400 font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> New League
          </button>
        )}
      </div>

      {leagues.length === 0 ? (
        <EmptyState
          title={isGuest ? "No public leagues found" : "No leagues yet"}
          description={
            isGuest
              ? "Public leagues will appear here once they're created."
              : "Create a league or join one to start tracking games."
          }
        />
      ) : (
        <div className="space-y-3">
          {leagues.map((league) => (
            <Card
              key={league.id}
              className="bg-gray-900/60 border-gray-800/50 hover:border-violet-800/40 transition-all cursor-pointer"
              onClick={() => navigate(`${createPageUrl("LeagueDetails")}/${league.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate">{league.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {league.is_public ? (
                        <Globe className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      ) : (
                        <Lock className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-500">
                        {league.is_public ? "Public" : "Private"}
                      </span>
                      {league.description && (
                        <span className="text-xs text-gray-600 truncate">· {league.description}</span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}