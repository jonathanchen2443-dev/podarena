import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { ArrowLeft, Globe, Lock, Info, Users, User, ChevronRight, Trophy, Swords, AlertCircle, RefreshCw } from "lucide-react";
import { LoadingState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { getLeagueById, listLeagueMembers } from "@/components/services/leagueService";
import StandingsTab from "@/components/leagues/StandingsTab";
import GamesTab from "@/components/leagues/GamesTab";
import { base44 } from "@/api/base44Client";

// Parse leagueId from query param: ?leagueId=xxx
function getLeagueIdFromPath() {
  return new URLSearchParams(window.location.search).get("leagueId");
}

const TABS = [
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "games", label: "Games", icon: Swords },
  { id: "info", label: "Info", icon: Info },
];

export default function LeagueDetails() {
  const auth = useAuth();
  const { isGuest, authLoading } = auth;
  const navigate = useNavigate();
  const leagueId = getLeagueIdFromPath();
  const [activeTab, setActiveTab] = useState("standings");
  const [league, setLeague] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState(null); // "private" | "restricted" | "not_found"

  useEffect(() => {
    if (authLoading) return;
    if (!leagueId) { setAccessError("not_found"); setLoading(false); return; }
    loadLeague();
  }, [authLoading, leagueId]);

  async function loadLeague() {
    setLoading(true);
    setAccessError(null);
    try {
      const { league: l, isMember: m } = await getLeagueById(auth, leagueId);
      setLeague(l);
      setIsMember(m);
    } catch (e) {
      setAccessError(e.message); // "private" | "restricted" | "not_found"
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) return <LoadingState message="Loading league…" />;

  // ── Access errors ─────────────────────────────────────────────────────────────
  if (accessError === "not_found") {
    return <GateView icon={Info} title="League not found" description="This league doesn't exist or has been removed." />;
  }

  if (accessError === "private") {
    return (
      <GateView icon={Lock} title="Private league" description="You need to sign in to view this league.">
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-11 px-6"
          onClick={() => base44.auth.redirectToLogin()}
        >
          Sign In
        </Button>
      </GateView>
    );
  }

  if (accessError === "restricted") {
    return <GateView icon={Lock} title="Access restricted" description="You are not an active member of this private league." />;
  }

  // ── League content ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Back nav */}
      <button
        onClick={() => navigate(ROUTES.LEAGUES)}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Leagues
      </button>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Users className="w-6 h-6 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight truncate">{league.name}</h1>
          <div className="flex items-center gap-1.5 mt-1">
            {league.is_public ? (
              <Globe className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-gray-500" />
            )}
            <span className="text-xs text-gray-500">{league.is_public ? "Public" : "Private"} league</span>
            {isMember && (
              <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] px-1.5 py-0 ml-1">
                Member
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900/60 border border-gray-800/50 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-violet-600 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "standings" && <StandingsTab auth={auth} leagueId={leagueId} />}
      {activeTab === "games" && <GamesTab auth={auth} leagueId={leagueId} />}
      {activeTab === "info" && <InfoTab league={league} auth={auth} />}
    </div>
  );
}

function InfoTab({ league, auth }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(null);
  const fetchingRef = useRef(false);

  async function loadMembers() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const data = await listLeagueMembers(auth, league.id);
      setMembers(data);
    } catch (e) {
      const isRateLimit = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      setMembersError(isRateLimit
        ? "Too many requests right now. Please wait a few seconds and try again."
        : e.message
      );
      setMembers([]);
    } finally {
      setMembersLoading(false);
      fetchingRef.current = false;
    }
  }

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league.id]);

  return (
    <div className="space-y-3">
      {/* League info */}
      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Name</p>
            <p className="text-white text-sm font-medium">{league.name}</p>
          </div>
          {league.description && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-gray-300 text-sm">{league.description}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Visibility</p>
            <div className="flex items-center gap-1.5">
              {league.is_public ? (
                <Globe className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-gray-400" />
              )}
              <p className="text-gray-300 text-sm">{league.is_public ? "Public" : "Private"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-1">
          Members{members.length > 0 && !membersLoading ? ` · ${members.length}` : ""}
        </p>
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-0">
            {membersLoading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading members…</div>
            ) : members.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No members found.</div>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {members.map((member) => (
                  <button
                    key={member.userId}
                    onClick={() => navigate(ROUTES.USER_PROFILE(member.userId))}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors text-left"
                  >
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.display_name}
                        className="w-8 h-8 rounded-full object-cover border border-gray-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-violet-400" />
                      </div>
                    )}
                    <span className="flex-1 text-sm text-white truncate">{member.display_name}</span>
                    {member.role === "admin" && (
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5">
                        Admin
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Shared gate view ──────────────────────────────────────────────────────────
function GateView({ icon: Icon, title, description, children }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-5">
      <button
        onClick={() => navigate(ROUTES.LEAGUES)}
        className="self-start flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Leagues
      </button>
      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
        <Icon className="w-8 h-8 text-violet-400" />
      </div>
      <div>
        <h2 className="text-white font-semibold text-lg">{title}</h2>
        <p className="text-gray-400 text-sm mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
}