import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { ArrowLeft, Globe, Lock, Info, Users, User, ChevronRight, Trophy, Swords, AlertCircle, RefreshCw, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { getLeagueById, listLeagueMembers, isLeagueAdmin, updateLeague } from "@/components/services/leagueService";
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
  const initialTab = new URLSearchParams(window.location.search).get("tab") || "standings";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [league, setLeague] = useState(null);
  const [isMember, setIsMember] = useState(false);
  function handleLeagueUpdated(updated) { setLeague(updated); }
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
            onClick={() => {
              setActiveTab(tab.id);
              const url = new URL(window.location.href);
              url.searchParams.set("tab", tab.id);
              window.history.replaceState(null, "", url.toString());
            }}
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
      {activeTab === "info" && <InfoTab league={league} auth={auth} onLeagueUpdated={handleLeagueUpdated} />}
    </div>
  );
}

function InfoTab({ league: initialLeague, auth, onLeagueUpdated }) {
  const navigate = useNavigate();
  const [league, setLeague] = useState(initialLeague);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(null);
  const fetchingRef = useRef(false);

  // Admin check
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (auth.isGuest || !auth.currentUser) return;
    isLeagueAdmin(auth, league.id).then(setIsAdmin);
  }, [auth, league.id]);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(league.name);
  const [editDesc, setEditDesc] = useState(league.description || "");
  const [editPublic, setEditPublic] = useState(league.is_public !== false);
  const [editError, setEditError] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function enterEdit() {
    setEditName(league.name);
    setEditDesc(league.description || "");
    setEditPublic(league.is_public !== false);
    setEditError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditError(null);
  }

  async function handleSave() {
    if (savingRef.current) return;
    setEditError(null);
    const trimmed = editName.trim();
    if (!trimmed) { setEditError("League name is required."); return; }
    if (trimmed.length > 100) { setEditError("League name is too long (max 100 characters)."); return; }

    savingRef.current = true;
    setSaving(true);
    try {
      await updateLeague(auth, league.id, {
        name: trimmed,
        description: editDesc,
        is_public: editPublic,
      });
      const updated = { ...league, name: trimmed, description: editDesc, is_public: editPublic };
      setLeague(updated);
      onLeagueUpdated?.(updated);
      setEditing(false);
      toast.success("League updated");
    } catch (e) {
      const isRateLimit = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      setEditError(isRateLimit
        ? "Too many requests right now. Please wait a few seconds and try again."
        : e.message || "Failed to save. Please try again.");
      savingRef.current = false;
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

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
      {/* League info card */}
      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-4">
          {editing ? (
            /* ── INLINE EDIT FORM ── */
            <div className="space-y-3">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wider">
                  League Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg px-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wider">
                  Description <span className="text-gray-600">(optional)</span>
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                />
              </div>

              {/* Visibility */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wider">Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPublic(true)}
                    className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      editPublic
                        ? "border-violet-500 bg-violet-500/10 text-violet-300"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <Globe className="w-4 h-4" /> Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPublic(false)}
                    className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      !editPublic
                        ? "border-violet-500 bg-violet-500/10 text-violet-300"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <Lock className="w-4 h-4" /> Private
                  </button>
                </div>
              </div>

              {/* Error */}
              {editError && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {editError}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={handleSave}
                  className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex-1"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={cancelEdit}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* ── READ-ONLY VIEW ── */
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-3 flex-1 min-w-0">
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
                </div>
                {isAdmin && (
                  <button
                    onClick={enterEdit}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-xs font-medium transition-colors flex-shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members — ADMIN badge preserved */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-1">
          Members{members.length > 0 && !membersLoading ? ` · ${members.length}` : ""}
        </p>
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-0">
            {membersLoading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading members…</div>
            ) : membersError ? (
              <div className="p-4 flex flex-col items-center gap-3 text-center">
                <p className="text-red-400 text-xs">{membersError}</p>
                <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={loadMembers}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                </Button>
              </div>
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