import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import {
  ArrowLeft, Globe, Lock, Info, Users, User, ChevronRight, Trophy, Swords,
  AlertCircle, RefreshCw, Pencil, Loader2, Share2, LogOut, UserX, X,
  ShieldCheck, MessageCircle, Copy, Check
} from "lucide-react";
import { formatLeagueInviteMessage } from "@/components/utils/inviteUtils";
import { toast } from "sonner";
import { LoadingState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import {
  getLeagueById, listLeagueMembers, isLeagueAdmin, updateLeague,
  validateInvite, getOrCreateInvite, joinPublicLeague, acceptInviteJoinLeague,
  leaveLeague, removeMember, promoteMemberToAdmin, invalidateLeagueCache
} from "@/components/services/leagueService";
import StandingsTab from "@/components/leagues/StandingsTab";
import GamesTab from "@/components/leagues/GamesTab";
import { base44 } from "@/api/base44Client";

function getQP(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function updateQP(updates) {
  const url = new URL(window.location.href);
  Object.entries(updates).forEach(([k, v]) => {
    if (v == null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  });
  window.history.replaceState(null, "", url.toString());
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
  const leagueId = getQP("leagueId");
  const inviteToken = getQP("invite");
  const initialTab = getQP("tab") || "standings";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [league, setLeague] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [accessMode, setAccessMode] = useState(null); // "member" | "public" | "invited_view"
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState(null);
  const [inviteValid, setInviteValid] = useState(null); // null=unchecked, true, false

  function handleLeagueUpdated(updated) { setLeague(updated); }
  function handleJoined() {
    setIsMember(true);
    setAccessMode("member");
    updateQP({ invite: null });
  }

  useEffect(() => {
    if (authLoading) return;
    if (!leagueId) { setAccessError("not_found"); setLoading(false); return; }
    loadLeague();
  }, [authLoading, leagueId]);

  async function loadLeague() {
    setLoading(true);
    setAccessError(null);
    try {
      const result = await getLeagueById(auth, leagueId, inviteToken);
      setLeague(result.league);
      setIsMember(result.isMember);
      setAccessMode(result.accessMode);
      if (result.accessMode === "invited_view") setInviteValid(true);
    } catch (e) {
      setAccessError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) return <LoadingState message="Loading league…" />;

  if (accessError === "not_found") {
    return <GateView icon={Info} title="League not found" description="This league doesn't exist or has been removed." />;
  }
  if (accessError === "private") {
    return (
      <GateView icon={Lock} title="Private league" description="You need to sign in to view this league.">
        <Button
          className="ds-btn-primary text-white rounded-xl h-11 px-6"
          onClick={() => base44.auth.redirectToLogin(window.location.href)}
        >Sign In</Button>
      </GateView>
    );
  }
  if (accessError === "restricted") {
    return (
      <GateView icon={Lock} title="Access restricted" description="You are not a member of this private league.">
        {inviteToken && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            This invite link is invalid or expired.
          </p>
        )}
      </GateView>
    );
  }

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
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ds-accent-bg ds-accent-bd border">
          <Users className="w-6 h-6" style={{ color: "var(--ds-primary-text)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight truncate">{league.name}</h1>
          <div className="flex items-center gap-1.5 mt-1">
            {league.is_public ? <Globe className="w-3.5 h-3.5 text-gray-500" /> : <Lock className="w-3.5 h-3.5 text-gray-500" />}
            <span className="text-xs text-gray-500">{league.is_public ? "Public" : "Private"} league</span>
            {isMember && (
              <Badge className="ds-accent-bg ds-accent-bd text-[10px] px-1.5 py-0 ml-1" style={{ color: "var(--ds-primary-text)" }}>
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
              updateQP({ tab: tab.id });
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? "ds-btn-primary text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "standings" && <StandingsTab auth={auth} leagueId={leagueId} inviteToken={inviteToken} isMember={isMember} />}
      {activeTab === "games" && <GamesTab auth={auth} leagueId={leagueId} inviteToken={inviteToken} />}
      {activeTab === "info" && (
        <InfoTab
          league={league}
          auth={auth}
          isMember={isMember}
          accessMode={accessMode}
          inviteToken={inviteToken}
          onLeagueUpdated={handleLeagueUpdated}
          onJoined={handleJoined}
        />
      )}
    </div>
  );
}

// ── InfoTab ───────────────────────────────────────────────────────────────────

const MEMBERS_PAGE_SIZE = 20;

function InfoTab({ league: initialLeague, auth, isMember: initialIsMember, accessMode: initialAccessMode, inviteToken, onLeagueUpdated, onJoined }) {
  const navigate = useNavigate();
  const [league, setLeague] = useState(initialLeague);
  const [isMember, setIsMember] = useState(initialIsMember);
  const [accessMode, setAccessMode] = useState(initialAccessMode);
  const [members, setMembers] = useState([]);
  const [visibleMemberCount, setVisibleMemberCount] = useState(MEMBERS_PAGE_SIZE);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(null);
  const fetchingRef = useRef(false);

  // Admin check
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (auth.isGuest || !auth.currentUser) return;
    isLeagueAdmin(auth, league.id).then(setIsAdmin);
  }, [auth, league.id]);

  // Promote member state
  const [promotingUserId, setPromotingUserId] = useState(null);
  const [promoting, setPromoting] = useState(false);

  // Invite / share panel state
  const [inviteUrl, setInviteUrl] = useState(null);
  const [inviteMessage, setInviteMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  // ── Inline edit state ───────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(league.name);
  const [editDesc, setEditDesc] = useState(league.description || "");
  const [editPublic, setEditPublic] = useState(league.is_public !== false);
  const [editMaxMembers, setEditMaxMembers] = useState(league.max_members || 10);
  const [editError, setEditError] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Confirm remove state
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState(null);
  const [removing, setRemoving] = useState(false);

  // ── Member actions state ────────────────────────────────────────────────────
  const [sharing, setSharing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // ── Invite panel state ──────────────────────────────────────────────────────
  const [showInvitePanel, setShowInvitePanel] = useState(accessMode === "invited_view");
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteActionError, setInviteActionError] = useState(null);

  // ── Join (public) state ─────────────────────────────────────────────────────
  const [joining, setJoining] = useState(false);

  function enterEdit() {
    setEditName(league.name);
    setEditDesc(league.description || "");
    setEditPublic(league.is_public !== false);
    setEditMaxMembers(league.max_members || 10);
    setEditError(null);
    setEditing(true);
  }
  function cancelEdit() { setEditing(false); setEditError(null); setConfirmRemoveUserId(null); setPromotingUserId(null); }

  async function handleSave() {
    if (savingRef.current) return;
    setEditError(null);
    const trimmed = editName.trim();
    if (!trimmed) { setEditError("League name is required."); return; }
    if (trimmed.length > 100) { setEditError("League name is too long (max 100 characters)."); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      await updateLeague(auth, league.id, { name: trimmed, description: editDesc, is_public: editPublic, max_members: editMaxMembers });
      const updated = { ...league, name: trimmed, description: editDesc, is_public: editPublic, max_members: editMaxMembers };
      setLeague(updated);
      onLeagueUpdated?.(updated);
      setEditing(false);
      toast.success("League updated");
    } catch (e) {
      setEditError(e.message?.toLowerCase().includes("rate") ? "Too many requests. Please wait and retry." : e.message || "Failed to save.");
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  async function loadMembers(skipCache = false) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setMembersLoading(true);
    setMembersError(null);
    if (skipCache) invalidateLeagueCache(league.id);
    try {
      // listLeagueMembers calls getLeagueById internally; for invited_view we do a direct fetch
      if (!isMember) {
        const rawMembers = await base44.entities.LeagueMember.filter({ league_id: league.id, status: "active" });
        const { Profile } = base44.entities;
        const allProfiles = await Profile.list("-created_date", 200);
        const pm = {};
        for (const p of allProfiles) pm[p.id] = p;
        setMembers(rawMembers.map((m) => ({
          userId: m.user_id,
          display_name: pm[m.user_id]?.display_name || "Unknown",
          avatar_url: pm[m.user_id]?.avatar_url || null,
          role: m.role,
        })));
      } else {
        const data = await listLeagueMembers(auth, league.id);
        setMembers(data);
      }
    } catch (e) {
      const isRate = e.message?.toLowerCase().includes("rate") || e.message?.toLowerCase().includes("429");
      setMembersError(isRate ? "Too many requests right now. Please wait a few seconds and try again." : e.message);
      setMembers([]);
    } finally {
      setMembersLoading(false);
      fetchingRef.current = false;
    }
  }

  useEffect(() => { loadMembers(); }, [league.id]);

  // ── Invite link share ────────────────────────────────────────────────────────
  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      let url;
      if (league.is_public) {
        url = `${window.location.origin}${ROUTES.LEAGUE_DETAILS(league.id)}`;
      } else {
        const result = await getOrCreateInvite(auth, league.id);
        url = result.url;
      }
      const inviterName = auth.currentUser?.display_name || "A PodArea user";
      const msg = formatLeagueInviteMessage({ leagueName: league.name, inviterName, inviteUrl: url });
      setInviteUrl(url);
      setInviteMessage(msg);

      // Try Web Share API; fallback to clipboard
      if (navigator.share) {
        try {
          await navigator.share({ title: "PodArea Invite", text: msg, url });
          toast.success("Shared!");
          return;
        } catch (shareErr) {
          if (shareErr.name === "AbortError") return;
          // Permission denied or other error → fall through to show panel
        }
      }
      // Clipboard fallback — copy full message
      try {
        await navigator.clipboard.writeText(msg);
        toast.success("Invite copied to clipboard");
      } catch {
        // execCommand last-resort; panel will be visible as fallback
        const el = document.createElement("textarea");
        el.value = msg;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        toast.success("Invite copied");
      }
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message || "Failed to share.");
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyInviteUrl(msg) {
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      const el = document.createElement("textarea");
      el.value = msg;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Invite copied!");
  }

  // ── Leave league ─────────────────────────────────────────────────────────────
  async function handleLeave() {
    if (leaving) return;
    setLeaving(true);
    try {
      await leaveLeague(auth, league.id);
      invalidateLeagueCache(league.id);
      toast.success("You left the league");
      if (!league.is_public) {
        // Private league: user no longer has access — navigate away immediately
        navigate(ROUTES.LEAGUES, { replace: true });
        return;
      }
      // Public league: stay on page as a non-member
      setIsMember(false);
      setAccessMode("public");
      setConfirmLeave(false);
      updateQP({ invite: null });
    } catch (e) {
      toast.error(e.message || "Failed to leave.");
    } finally {
      setLeaving(false);
    }
  }

  // ── Accept invite ────────────────────────────────────────────────────────────
  async function handleAcceptInvite() {
    if (acceptingInvite) return;
    setAcceptingInvite(true);
    setInviteActionError(null);
    try {
      await acceptInviteJoinLeague(auth, league.id, inviteToken);
      toast.success(`Joined "${league.name}"!`);
      setIsMember(true);
      setAccessMode("member");
      setShowInvitePanel(false);
      updateQP({ invite: null });
      onJoined?.();
      await loadMembers(true);
    } catch (e) {
      setInviteActionError(e.message || "Failed to join.");
    } finally {
      setAcceptingInvite(false);
    }
  }

  function handleDeclineInvite() {
    setShowInvitePanel(false);
    updateQP({ invite: null });
  }

  // ── Join public league ────────────────────────────────────────────────────────
  async function handleJoinPublic() {
    if (auth.isGuest) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    if (joining) return;
    setJoining(true);
    try {
      await joinPublicLeague(auth, league.id);
      toast.success(`Joined "${league.name}"!`);
      setIsMember(true);
      setAccessMode("member");
      onJoined?.();
      await loadMembers(true);
    } catch (e) {
      toast.error(e.message || "Failed to join.");
    } finally {
      setJoining(false);
    }
  }

  // ── Remove member ────────────────────────────────────────────────────────────
  async function handleRemoveMember(memberUserId) {
    if (removing) return;
    setRemoving(true);
    try {
      await removeMember(auth, league.id, memberUserId);
      toast.success("Member removed");
      setConfirmRemoveUserId(null);
      setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
    } catch (e) {
      toast.error(e.message || "Failed to remove member.");
    } finally {
      setRemoving(false);
    }
  }

  // ── Promote member ────────────────────────────────────────────────────────────
  async function handlePromoteMember(memberUserId) {
    if (promoting) return;
    setPromoting(true);
    try {
      await promoteMemberToAdmin(auth, league.id, memberUserId);
      toast.success("Member promoted to admin");
      setPromotingUserId(null);
      setMembers((prev) => prev.map((m) => m.userId === memberUserId ? { ...m, role: "admin" } : m));
    } catch (e) {
      toast.error(e.message || "Failed to promote member.");
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="space-y-3">

      {/* ── Invited-view panel ─────────────────────────────────────────────── */}
      {showInvitePanel && accessMode === "invited_view" && !isMember && (
        <Card className="ds-accent-bg border" style={{ borderColor: "rgb(var(--ds-primary-muted-bd))" }}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-white font-semibold text-sm">You're invited to join this league</p>
                <p className="text-gray-400 text-xs mt-0.5">Accept to become a member and participate in games.</p>
              </div>
              <button onClick={handleDeclineInvite} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {inviteActionError && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{inviteActionError}</p>
            )}
            {(() => {
              const maxM = league.max_members || 10;
              const isFull = !membersLoading && members.length >= maxM;
              if (isFull) return (
                <p className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">League is full ({members.length}/{maxM})</p>
              );
              return null;
            })()}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={acceptingInvite || (!membersLoading && members.length >= (league.max_members || 10))}
                onClick={handleAcceptInvite}
                className="ds-btn-primary text-white rounded-lg flex-1"
              >
                {acceptingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Accept & Join"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={acceptingInvite}
                onClick={handleDeclineInvite}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg flex-1"
              >
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Join public league CTA ──────────────────────────────────────────── */}
      {!isMember && accessMode === "public" && (() => {
        const maxM = league.max_members || 10;
        const isFull = members.length >= maxM && !membersLoading;
        return (
          <Card className="bg-gray-900/60 border-gray-800/50">
            <CardContent className="p-4 space-y-2">
              <p className="text-white text-sm font-medium">Want to participate?</p>
              <p className="text-gray-400 text-xs">Join this public league to log games and appear in the standings.</p>
              {isFull ? (
                <p className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">League is full ({members.length}/{maxM} members)</p>
              ) : (
                <Button
                  size="sm"
                  disabled={joining}
                  onClick={handleJoinPublic}
                  className="ds-btn-primary text-white rounded-lg w-full mt-1"
                >
                  {joining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : auth.isGuest ? "Sign in to join" : "Request to Join"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── League info card ────────────────────────────────────────────────── */}
      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-4">
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wider">League Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wider">Description <span className="text-gray-600">(optional)</span></label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wider">Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEditPublic(true)}
                    className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${editPublic ? "border-violet-500 bg-violet-500/10 text-violet-300" : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"}`}>
                    <Globe className="w-4 h-4" /> Public
                  </button>
                  <button type="button" onClick={() => setEditPublic(false)}
                    className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${!editPublic ? "border-violet-500 bg-violet-500/10 text-violet-300" : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"}`}>
                    <Lock className="w-4 h-4" /> Private
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wider">Max Members <span className="text-gray-600 normal-case">(2–10)</span></label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={2} max={10} step={1}
                    value={editMaxMembers}
                    onChange={(e) => setEditMaxMembers(Number(e.target.value))}
                    className="flex-1 accent-violet-500"
                  />
                  <span className="text-white text-sm font-medium w-5 text-center">{editMaxMembers}</span>
                </div>
              </div>
              {editError && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={saving} onClick={handleSave} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex-1">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={cancelEdit} className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
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
                      {league.is_public ? <Globe className="w-3.5 h-3.5 text-gray-400" /> : <Lock className="w-3.5 h-3.5 text-gray-400" />}
                      <p className="text-gray-300 text-sm">{league.is_public ? "Public" : "Private"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Capacity</p>
                    <p className="text-gray-300 text-sm">{members.length} / {league.max_members || 10} members</p>
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={enterEdit} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-xs font-medium transition-colors flex-shrink-0">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Member actions (share + leave) ──────────────────────────────────── */}
      {isMember && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {/* Only show Invite button if: public league OR (private league AND admin) */}
            {(league.is_public || isAdmin) && (
              <Button
                variant="outline"
                size="sm"
                disabled={sharing}
                onClick={handleShare}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg h-10"
              >
                {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Share2 className="w-3.5 h-3.5 mr-1.5" />}
                {league.is_public ? "Share" : "Invite"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmLeave(true)}
              className={`border-red-800/50 text-red-400 hover:bg-red-900/20 rounded-lg h-10 ${(league.is_public || isAdmin) ? "" : "col-span-2"}`}
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Leave League
            </Button>
          </div>
          {/* Invite panel: show after share pressed */}
          {inviteUrl && inviteMessage && (
            <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-500 font-medium">Invite message</p>
              <div className="relative">
                <textarea
                  readOnly
                  value={inviteMessage}
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none resize-none"
                />
                <button
                  onClick={() => handleCopyInviteUrl(inviteMessage)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-md bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => toast.success("Opening WhatsApp…")}
                className="flex items-center gap-2 h-8 px-3 rounded-lg bg-green-700/20 border border-green-700/40 text-green-400 text-xs font-medium hover:bg-green-700/30 transition-colors w-full justify-center"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Share on WhatsApp
              </a>
            </div>
          )}
        </div>
      )}

      {/* Leave confirmation */}
      {confirmLeave && (
        <Card className="bg-red-900/10 border-red-800/40">
          <CardContent className="p-4 space-y-3">
            <p className="text-white text-sm font-medium">Leave "{league.name}"?</p>
            <p className="text-gray-400 text-xs">You will lose your membership. If this league is private, you will need an invite link to rejoin.</p>
            <div className="flex gap-2">
              <Button size="sm" disabled={leaving} onClick={handleLeave} className="bg-red-600 hover:bg-red-700 text-white rounded-lg flex-1">
                {leaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Leave"}
              </Button>
              <Button size="sm" variant="outline" disabled={leaving} onClick={() => setConfirmLeave(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg flex-1">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Members list ────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-1">
          {membersLoading
            ? "Members"
            : `Members · ${members.length} / ${league.max_members || 10}`}
        </p>
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-0">
            {membersLoading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading members…</div>
            ) : membersError ? (
              <div className="p-4 flex flex-col items-center gap-3 text-center">
                <p className="text-red-400 text-xs">{membersError}</p>
                <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => loadMembers(true)}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : members.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No members found.</div>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {members.slice(0, visibleMemberCount).map((member) => {
                  const isCurrentUser = auth.currentUser?.id === member.userId;
                  const showRemoveBtn = editing && isAdmin && !isCurrentUser;
                  const isConfirming = confirmRemoveUserId === member.userId;
                  const isPromoting = promotingUserId === member.userId;
                  const showPromoteBtn = editing && isAdmin && !isCurrentUser && member.role === "member";

                  return (
                    <div key={member.userId}>
                      <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors">
                        {/* Avatar */}
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.display_name} className="w-8 h-8 rounded-full object-cover border border-gray-700 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-violet-400" />
                          </div>
                        )}
                        {/* Name — clickable if not in edit mode */}
                        <button
                          className="flex-1 text-sm text-white truncate text-left"
                          onClick={() => !editing && navigate(ROUTES.USER_PROFILE(member.userId))}
                        >
                          {member.display_name}
                          {isCurrentUser && <span className="text-gray-500 text-xs ml-1">(you)</span>}
                        </button>
                        {/* Admin badge — PRESERVED */}
                        {member.role === "admin" && (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5 flex-shrink-0">
                            Admin
                          </Badge>
                        )}
                        {/* Promote icon (admin edit mode, only for non-admin members) */}
                        {showPromoteBtn && !isConfirming && !isPromoting && (
                          <button
                            onClick={() => setPromotingUserId(member.userId)}
                            className="ml-1 p-1 rounded-md text-gray-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors flex-shrink-0"
                            title="Promote to admin"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}
                        {/* Remove icon (admin edit mode) */}
                        {showRemoveBtn && !isConfirming && !isPromoting && (
                          <button
                            onClick={() => setConfirmRemoveUserId(member.userId)}
                            className="ml-1 p-1 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                            title="Remove member"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                        {/* Navigate chevron (non-edit mode) */}
                        {!editing && (
                          <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        )}
                      </div>
                      {/* Inline remove confirmation */}
                      {isConfirming && (
                        <div className="px-4 pb-3 flex items-center gap-2 bg-red-900/10 border-t border-red-800/30">
                          <p className="text-xs text-red-400 flex-1">Remove {member.display_name}?</p>
                          <button
                            disabled={removing}
                            onClick={() => handleRemoveMember(member.userId)}
                            className="h-7 px-3 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-60"
                          >
                            {removing ? "…" : "Remove"}
                          </button>
                          <button
                            disabled={removing}
                            onClick={() => setConfirmRemoveUserId(null)}
                            className="h-7 px-3 rounded-md bg-gray-700 text-gray-200 text-xs font-medium hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {/* Inline promote confirmation */}
                      {isPromoting && (
                        <div className="px-4 pb-3 flex items-center gap-2 bg-amber-900/10 border-t border-amber-800/30">
                          <p className="text-xs text-amber-400 flex-1">Promote {member.display_name} to admin?</p>
                          <button
                            disabled={promoting}
                            onClick={() => handlePromoteMember(member.userId)}
                            className="h-7 px-3 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-60"
                          >
                            {promoting ? "…" : "Promote"}
                          </button>
                          <button
                            disabled={promoting}
                            onClick={() => setPromotingUserId(null)}
                            className="h-7 px-3 rounded-md bg-gray-700 text-gray-200 text-xs font-medium hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        {members.length > visibleMemberCount && (
          <button
            onClick={() => setVisibleMemberCount((c) => c + MEMBERS_PAGE_SIZE)}
            className="w-full mt-2 py-2.5 text-xs text-violet-400 hover:text-violet-300 hover:bg-gray-800/40 rounded-xl border border-gray-800/50 transition-colors"
          >
            Load more ({members.length - visibleMemberCount} remaining)
          </button>
        )}
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