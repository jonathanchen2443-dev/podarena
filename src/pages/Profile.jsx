import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { User, LogOut, Plus, ChevronRight, Trophy, Swords, Lock } from "lucide-react";
import { LoadingState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import LoginRequiredModal from "@/components/auth/LoginRequiredModal";
import DeckCard from "@/components/decks/DeckCard";
import DeleteDeckModal from "@/components/decks/DeleteDeckModal";
import { listMyDecks, deleteDeck } from "@/components/services/deckService";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function Profile() {
  const auth = useAuth();
  const { isGuest, authLoading, currentUser, logout } = auth;
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [decks, setDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isGuest) {
      loadDecks();
    }
  }, [authLoading, isGuest]);

  async function loadDecks() {
    setDecksLoading(true);
    const data = await listMyDecks(auth);
    setDecks(data);
    setDecksLoading(false);
  }

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    await deleteDeck(auth, deletingDeck.id);
    toast.success("Deck deleted.");
    setDeletingDeck(null);
    setDeleteLoading(false);
    await loadDecks();
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
  const stats = [
    { label: "Games", value: "—" },
    { label: "Wins", value: "—" },
    { label: "Decks", value: decksLoading ? "…" : decks.length },
    { label: "Leagues", value: "—" },
  ];

  const previewDecks = decks.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <User className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{currentUser?.display_name || "—"}</p>
              <p className="text-gray-500 text-sm">{currentUser?.email || ""}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-6 pt-5 border-t border-gray-800/60">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-white font-bold text-lg">{stat.value}</p>
                <p className="text-gray-600 text-[10px] mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
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
            <div className="space-y-3">
              {previewDecks.map((deck) => (
                <DeckCard key={deck.id} deck={deck} onDelete={setDeletingDeck} />
              ))}
            </div>
            {decks.length > 3 && (
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