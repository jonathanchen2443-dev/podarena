import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { ROUTES } from "@/components/utils/routes";
import { LogOut, Plus, Lock, AlertCircle, RefreshCw, Copy, Check } from "lucide-react";
import { LoadingState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import LoginRequiredModal from "@/components/auth/LoginRequiredModal";
import DeckTile from "@/components/decks/DeckTile";
import DeleteDeckModal from "@/components/decks/DeleteDeckModal";
import AvatarUpload from "@/components/profile/AvatarUpload";
import { Pencil, X, Check as CheckIcon, Loader2 } from "lucide-react";
import StatRingCards from "@/components/profile/StatRingCards";
import BadgesSection from "@/components/profile/BadgesSection";
import DeckInsightsModal from "@/components/decks/DeckInsightsModal";
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
  const [insightsDeck, setInsightsDeck] = useState(null);
  const [profile, setProfile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const fetchingRef = useRef(false);

  function copyUserId() {
    if (!profile?.public_user_id) return;
    navigator.clipboard.writeText(profile.public_user_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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

  function handleDisplayNameSaved(newName) {
    setProfile((p) => p ? { ...p, display_name: newName, display_name_lc: newName.toLowerCase() } : p);
  }

  function startEditName() {
    setNameValue(profile?.display_name || "");
    setNameError("");
    setEditingName(true);
  }

  function cancelEditName() {
    setEditingName(false);
    setNameError("");
  }

  async function saveEditName() {
    const trimmed = nameValue.trim();
    if (trimmed.length < 3) { setNameError("Name must be at least 3 characters."); return; }
    setNameSaving(true);
    setNameError("");
    const lc = trimmed.toLowerCase();
    const matches = await base44.entities.Profile.filter({ display_name_lc: lc });
    const conflict = matches.find((p) => p.id !== profile.id);
    if (conflict) { setNameError("This name is already taken."); setNameSaving(false); return; }
    await base44.entities.Profile.update(profile.id, { display_name: trimmed, display_name_lc: lc });
    toast.success("Display name updated!");
    handleDisplayNameSaved(trimmed);
    setEditingName(false);
    setNameSaving(false);
  }

  if (authLoading) return <LoadingState message="Loading profile…" />;

  // ── Guest view ───────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center ds-accent-bg ds-accent-bd border">
          <Lock className="w-8 h-8" style={{ color: "var(--ds-primary-text)" }} />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Login to manage your profile</h2>
          <p className="text-gray-400 text-sm mt-1">
            Sign in to track your decks, view your game history, and manage your account.
          </p>
        </div>
        <button
          onClick={() => setShowLoginModal(true)}
          className="h-11 px-6 rounded-xl text-white text-sm font-medium transition-colors ds-btn-primary"
        >
          Sign In
        </button>
        {showLoginModal && <LoginRequiredModal onClose={() => setShowLoginModal(false)} />}
      </div>
    );
  }

  // ── Authenticated view ───────────────────────────────────────────────────────
  // Top-4: favorites first (up to 4), then fill with most-played non-favorites
  const favorites = decks.filter((d) => d.is_favorite);
  const favIds = new Set(favorites.map((d) => d.id));
  const nonFavsSorted = decks
    .filter((d) => !favIds.has(d.id))
    .sort((a, b) => (b.gamesWithDeck || 0) - (a.gamesWithDeck || 0));
  const previewDecks = [
    ...favorites.slice(0, 4),
    ...nonFavsSorted.slice(0, 4 - Math.min(favorites.length, 4)),
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
              <div className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 ds-accent-bg" style={{ border: "2px solid rgb(var(--ds-primary-muted-bd))" }}>
                <Lock className="w-8 h-8" style={{ color: "var(--ds-primary-text)" }} />
              </div>
            )}
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-white font-bold text-lg leading-tight truncate">
                {profile?.display_name || currentUser?.display_name || "—"}
              </p>
              {profile?.public_user_id && (
                <button
                  onClick={copyUserId}
                  className="mt-1.5 flex items-center gap-1.5 text-left group"
                  title="Tap to copy"
                >
                  <span className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold">User ID</span>
                  <span className="text-gray-300 text-xs font-mono tracking-wide">{profile.public_user_id}</span>
                  {copied
                    ? <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    : <Copy className="w-3 h-3 text-gray-600 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
                  }
                </button>
              )}
              {profile && (
                <DisplayNameEdit profile={profile} onSaved={handleDisplayNameSaved} />
              )}
            </div>
          </div>


        </CardContent>
      </Card>

      {/* Stat ring cards */}
      <StatRingCards stats={stats} decks={decks} />

      {/* Badges section */}
      <BadgesSection stats={stats} decks={decks} />

      {/* My Decks section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-white font-semibold text-base">My Decks</h2>
          <div className="flex items-center gap-2">
            <button
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--ds-primary-text)" }}
              onClick={() => navigate(ROUTES.PROFILE_DECKS)}
            >
              All Decks
            </button>
            <Button
              size="sm"
              className="ds-btn-primary text-white rounded-xl h-8 text-xs px-3"
              onClick={() => navigate(ROUTES.PROFILE_DECK_NEW)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Deck
            </Button>
          </div>
        </div>

        {decksLoading ? (
          <p className="text-gray-500 text-sm px-1">Loading…</p>
        ) : decksError ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <AlertCircle className="w-6 h-6 text-red-400/70" />
            <p className="text-red-400 text-xs">{decksError}</p>
            <button onClick={() => { fetchingRef.current = false; loadAll(); }} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: "var(--ds-primary-text)" }}>
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        ) : previewDecks.length === 0 ? (
          <Card className="bg-gray-900/40 border-gray-800/40 border-dashed">
            <CardContent className="p-6 text-center">
              <p className="text-gray-500 text-sm">No decks yet.</p>
              <button
                className="text-sm mt-1 hover:underline"
                style={{ color: "var(--ds-primary-text)" }}
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
                <DeckTile
                  key={deck.id}
                  deck={deck}
                  onDelete={setDeletingDeck}
                  editHref={`${ROUTES.PROFILE_DECK_EDIT(deck.id)}&returnTo=profile`}
                  isGuest={isGuest}
                  onFavoriteToggle={(d, newFav) => {
                    setDecks((prev) => prev.map((x) => x.id === d.id ? { ...x, is_favorite: newFav } : x));
                  }}
                  onInsights={setInsightsDeck}
                />
              ))}
            </div>
            {decks.length > 4 && (
              <button
                className="w-full flex items-center justify-center gap-1 text-sm py-2 transition-colors hover:opacity-80"
                style={{ color: "var(--ds-primary-text)" }}
                onClick={() => navigate(ROUTES.PROFILE_DECKS)}
              >
                View all {decks.length} decks <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}
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

      <DeckInsightsModal
        deck={insightsDeck}
        auth={auth}
        onClose={() => setInsightsDeck(null)}
      />
    </div>
  );
}