import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { LogOut, Plus, ChevronRight, Trophy, Swords, Lock, AlertCircle, RefreshCw } from "lucide-react";
import { LoadingState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import LoginRequiredModal from "@/components/auth/LoginRequiredModal";
import DeckTile from "@/components/decks/DeckTile";
import DeleteDeckModal from "@/components/decks/DeleteDeckModal";
import AvatarUpload from "@/components/profile/AvatarUpload";
import UsernameEdit from "@/components/profile/UsernameEdit";
import StatOrb from "@/components/profile/StatOrb";
import { getMyDecksWithStats, invalidateDeckStatsCache } from "@/components/services/deckStatsService";
import { getProfileStats, invalidateProfileStatsCache } from "@/components/services/profileStatsService";
import { deleteDeck } from "@/components/services/deckService";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function Profile() {
  const auth = useAuth();
  const { isGuest, authLoading, currentUser, logout } = auth;
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [decks, setDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [deletingDeck, setDeletingDeck] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !isGuest) {
      loadAll();
    }
  }, [authLoading, isGuest]);

  async function loadAll() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setDecksLoading(true);
    setDecksError(null);
    setStatsError(null);
    try {
      // Load profile record for avatar + username
      const profiles = await base44.entities.Profile.filter({ created_by: currentUser?.email });
      setProfile(profiles[0] || null);

      const [decksData, statsData] = await Promise.all([
        getMyDecksWithStats(auth),
        getProfileStats(auth),
      ]);
      setDecks(decksData);
      setStats(statsData);
    } catch (e) {
      const isRate = e?.message?.toLowerCase().includes("rate") || e?.message?.toLowerCase().includes("429");
      const msg = isRate ? "Too many requests right now. Please wait a few seconds and try again." : (e.message || "Failed to load profile.");
      setDecksError(msg);
      setStatsError(msg);
    } finally {
      setDecksLoading(false);
      fetchingRef.current = false;
    }
  }

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    await deleteDeck(auth, deletingDeck.id);
    toast.success("Deck deleted.");
    setDeletingDeck(null);
    setDeleteLoading(false);
    invalidateDeckStatsCache(currentUser?.id);
    invalidateProfileStatsCache(currentUser?.id);
    fetchingRef.current = false;
    await loadAll();
  }

  function handleAvatarSaved(newUrl) {
    setProfile((p) => p ? { ...p, avatar_url: newUrl } : p);
  }

  function handleUsernameSaved(newUsername) {
    setProfile((p) => p ? { ...p, username: newUsername, username_lc: newUsername.toLowerCase() } : p);
  }

  if (authLoading) return <LoadingState message="Loading profile…" />;

  // ── Guest view ───────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-violet-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Login to manage your profile</h2>
          <p className="text-gray-400 text-sm mt-1">
            Sign in to track your decks, view your game history, and manage your account.
          </p>
        </div>
        <button
          onClick={() => setShowLoginModal(true)}
          className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          Sign In
        </button>
        {showLoginModal && <LoginRequiredModal onClose={() => setShowLoginModal(false)} />}
      </div>
    );
  }

  // ── Authenticated view ───────────────────────────────────────────────────────
  const previewDecks = decks.slice(0, 4);

  const orbStats = [
    { label: "Games", value: stats ? stats.gamesPlayed : (decksLoading ? "…" : "—"), color: "violet" },
    { label: "Wins", value: stats ? stats.wins : (decksLoading ? "…" : "—"), color: "emerald" },
    { label: "Decks", value: stats ? stats.decksCount : (decksLoading ? "…" : decks.length), color: "amber" },
    { label: "Leagues", value: stats ? stats.leaguesCount : (decksLoading ? "…" : "—"), color: "sky" },
  ];

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-5">
          {/* Avatar + identity */}
          <div className="flex items-start gap-4">
            {profile ? (
              <AvatarUpload profile={profile} onSaved={handleAvatarSaved} />
            ) : (
              <div className="w-20 h-20 rounded-full bg-violet-500/10 border-2 border-violet-500/30 flex items-center justify-center flex-shrink-0">
                <Lock className="w-8 h-8 text-violet-400" />
              </div>
            )}
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-white font-bold text-lg leading-tight truncate">
                {currentUser?.display_name || "—"}
              </p>
              <p className="text-gray-500 text-xs mt-0.5 truncate">{currentUser?.email || ""}</p>
              {profile && (
                <div className="mt-1.5">
                  <UsernameEdit profile={profile} onSaved={handleUsernameSaved} />
                </div>
              )}
            </div>
          </div>

          {/* Stat orbs */}
          {statsError ? (
            <div className="mt-5 pt-4 border-t border-gray-800/60 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <p className="text-red-400 text-xs">{statsError}</p>
              </div>
              <button
                onClick={() => { fetchingRef.current = false; loadAll(); }}
                className="flex items-center gap-1.5 text-violet-400 text-xs hover:text-violet-300 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          ) : (
            <div className="mt-5 pt-4 border-t border-gray-800/60 grid grid-cols-4 gap-2">
              {orbStats.map((s) => (
                <StatOrb key={s.label} value={s.value} label={s.label} color={s.color} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Decks section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-white font-semibold text-base">My Decks</h2>
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-8 text-xs px-3"
            onClick={() => navigate(ROUTES.PROFILE_DECK_NEW)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Deck
          </Button>
        </div>

        {decksLoading ? (
          <p className="text-gray-500 text-sm px-1">Loading…</p>
        ) : decksError ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <AlertCircle className="w-6 h-6 text-red-400/70" />
            <p className="text-red-400 text-xs">{decksError}</p>
            <button onClick={() => { fetchingRef.current = false; loadAll(); }} className="text-violet-400 text-xs hover:text-violet-300 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        ) : previewDecks.length === 0 ? (
          <Card className="bg-gray-900/40 border-gray-800/40 border-dashed">
            <CardContent className="p-6 text-center">
              <p className="text-gray-500 text-sm">No decks yet.</p>
              <button
                className="text-violet-400 text-sm mt-1 hover:underline"
                onClick={() => navigate(ROUTES.PROFILE_DECK_NEW)}
              >
                Create your first deck
              </button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {previewDecks.map((deck) => (
                <DeckTile key={deck.id} deck={deck} onDelete={setDeletingDeck} />
              ))}
            </div>
            {decks.length > 4 && (
              <button
                className="w-full flex items-center justify-center gap-1 text-violet-400 text-sm hover:text-violet-300 py-2 transition-colors"
                onClick={() => navigate(ROUTES.PROFILE_DECKS)}
              >
                View all {decks.length} decks <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Other profile links */}
      <div className="space-y-2">
        {[
          { icon: Trophy, label: "My Leagues", description: "View leagues you're a member of" },
          { icon: Swords, label: "Game History", description: "Browse all your logged games" },
        ].map((action) => (
          <Card key={action.label} className="bg-gray-900/60 border-gray-800/50 hover:border-violet-800/40 transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center border border-gray-700">
                <action.icon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{action.label}</p>
                <p className="text-xs text-gray-500">{action.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full h-11 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>

      <DeleteDeckModal
        deck={deletingDeck}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingDeck(null)}
        loading={deleteLoading}
      />
    </div>
  );
}