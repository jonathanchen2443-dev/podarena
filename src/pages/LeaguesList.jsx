import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { Users, ChevronRight, Globe, Lock, Plus, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { listVisibleLeagues } from "@/components/services/leagueService";

const PAGE_SIZE = 20;

function isRateLimitError(e) {
  const m = e?.message?.toLowerCase() || "";
  return m.includes("rate") || m.includes("429");
}

export default function LeaguesList() {
  const auth = useAuth();
  const { isGuest, authLoading } = auth;
  const navigate = useNavigate();
  const [allLeagues, setAllLeagues] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    loadLeagues();
  }, [authLoading, isGuest]);

  async function loadLeagues() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await listVisibleLeagues(auth);
      setAllLeagues(data);
      setVisibleCount(PAGE_SIZE);
    } catch (e) {
      setError(isRateLimitError(e)
        ? "Too many requests right now. Please wait a few seconds and try again."
        : e.message || "Failed to load leagues."
      );
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  const leagues = allLeagues.slice(0, visibleCount);
  const hasMore = visibleCount < allLeagues.length;

  if (authLoading || loading) return <LoadingState message="Loading leagues…" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={() => { fetchingRef.current = false; loadLeagues(); }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-400">{allLeagues.length} league{allLeagues.length !== 1 ? "s" : ""}</p>
        {!isGuest && (
          <button
            className="text-sm text-violet-400 font-medium flex items-center gap-1"
            onClick={() => navigate(ROUTES.CREATE_LEAGUE)}
          >
            <Plus className="w-3.5 h-3.5" /> New League
          </button>
        )}
      </div>

      {allLeagues.length === 0 ? (
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
              onClick={() => navigate(ROUTES.LEAGUE_DETAILS(league.id))}
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
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full flex items-center justify-center gap-1.5 text-violet-400 text-sm hover:text-violet-300 py-2 transition-colors"
            >
              <Loader2 className="w-3.5 h-3.5" />
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}