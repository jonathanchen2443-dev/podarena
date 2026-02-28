import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { Plus, Lock, ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { LoadingState, EmptyState } from "@/components/shell/PageStates";
import DeckTile from "@/components/decks/DeckTile";
import DeckForm from "@/components/decks/DeckForm";
import DeleteDeckModal from "@/components/decks/DeleteDeckModal";
import DeckFilters from "@/components/decks/DeckFilters";
import DeckInsightsModal from "@/components/decks/DeckInsightsModal";
import { getMyDeckById, createDeck, updateDeck, deleteDeck } from "@/components/services/deckService";
import { getMyDecksWithStats, invalidateDeckStatsCache } from "@/components/services/deckStatsService";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

// Determine sub-route from query params: ?mode=new | ?mode=edit&deckId=xxx&returnTo=profile
function getSubRoute() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const returnTo = params.get("returnTo");
  if (mode === "edit") return { mode: "edit", deckId: params.get("deckId"), returnTo };
  if (mode === "new") return { mode: "new", returnTo };
  return { mode: "list", returnTo: null };
}

const DEFAULT_FILTERS = { favOnly: false, status: "all", colors: [] };

function applyFilters(decks, filters) {
  return decks.filter((d) => {
    if (filters.favOnly && !d.is_favorite) return false;
    if (filters.status === "active" && d.is_active === false) return false;
    if (filters.status === "retired" && d.is_active !== false) return false;
    if (filters.colors.length > 0) {
      const dc = d.color_identity || [];
      // ANY match: deck must include at least one selected color
      if (!filters.colors.some((c) => dc.includes(c))) return false;
    }
    return true;
  });
}

function sortDecks(decks) {
  return [...decks].sort((a, b) => {
    // favorites first
    const af = a.is_favorite ? 1 : 0;
    const bf = b.is_favorite ? 1 : 0;
    if (bf !== af) return bf - af;
    // then most played
    const ag = a.gamesWithDeck || 0;
    const bg = b.gamesWithDeck || 0;
    if (bg !== ag) return bg - ag;
    // then A-Z by commander name
    return (a.commander_name || a.name || "").localeCompare(b.commander_name || b.name || "");
  });
}

export default function ProfileDecks() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { isGuest, authLoading } = auth;
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingDeck, setDeletingDeck] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDeck, setEditDeck] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [insightsDeck, setInsightsDeck] = useState(null);
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const fetchingRef = useRef(false);

  const subRoute = getSubRoute();

  useEffect(() => {
    if (authLoading) return;
    if (isGuest) { setLoading(false); return; }
    if (subRoute.mode === "edit" && subRoute.deckId) {
      loadEditDeck(subRoute.deckId);
    } else if (subRoute.mode === "list") {
      loadDecks();
    } else {
      setLoading(false);
    }
  }, [authLoading, isGuest, window.location.search]);

  async function loadDecks() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await getMyDecksWithStats(auth);
      setDecks(sortDecks(data));
    } catch (e) {
      const isRate = e?.message?.toLowerCase().includes("rate") || e?.message?.toLowerCase().includes("429");
      setError(isRate ? "Too many requests right now. Please wait a few seconds and try again." : e.message || "Failed to load decks.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  async function loadEditDeck(deckId) {
    setEditLoading(true);
    setLoading(true);
    const deck = await getMyDeckById(auth, deckId);
    setEditDeck(deck);
    setEditLoading(false);
    setLoading(false);
  }

  async function handleCreate(payload) {
    setSaving(true);
    await createDeck(auth, payload);
    toast.success("Deck created!");
    if (auth.currentUser?.id) invalidateDeckStatsCache(auth.currentUser.id);
    navigate(ROUTES.PROFILE_DECKS);
    setSaving(false);
  }

  async function handleUpdate(payload) {
    setSaving(true);
    await updateDeck(auth, subRoute.deckId, payload);
    toast.success("Deck updated!");
    if (auth.currentUser?.id) invalidateDeckStatsCache(auth.currentUser.id);
    navigate(subRoute.returnTo === "profile" ? ROUTES.PROFILE : ROUTES.PROFILE_DECKS);
    setSaving(false);
  }

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    await deleteDeck(auth, deletingDeck.id);
    toast.success("Deck deleted.");
    setDeletingDeck(null);
    setDeleteLoading(false);
    if (auth.currentUser?.id) invalidateDeckStatsCache(auth.currentUser.id);
    fetchingRef.current = false;
    await loadDecks();
  }

  function handleFavoriteToggle(deck, newFav) {
    setDecks((prev) =>
      sortDecks(prev.map((d) => d.id === deck.id ? { ...d, is_favorite: newFav } : d))
    );
  }

  // Client-side filtered + sorted list
  const filteredDecks = useMemo(() => applyFilters(decks, filters), [decks, filters]);

  // Reset pagination when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filters]);

  const visibleDecks = filteredDecks.slice(0, visibleCount);

  // ── Guest gate ──────────────────────────────────────────────────────────────
  if (authLoading || loading) return <LoadingState message="Loading decks…" />;

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-violet-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Login to manage decks</h2>
          <p className="text-gray-400 text-sm mt-1">Sign in to create and manage your Commander decks.</p>
        </div>
        <button
          onClick={() => base44.auth.redirectToLogin()}
          className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  // ── Create form ─────────────────────────────────────────────────────────────
  if (subRoute.mode === "new") {
    return (
      <div className="space-y-5">
        <button
          onClick={() => navigate(ROUTES.PROFILE_DECKS)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Decks
        </button>
        <h1 className="text-xl font-bold text-white">New Deck</h1>
        <DeckForm onSave={handleCreate} saving={saving} />
      </div>
    );
  }

  // ── Edit form ────────────────────────────────────────────────────────────────
  if (subRoute.mode === "edit") {
    if (editLoading || !editDeck) return <LoadingState message="Loading deck…" />;
    const backTarget = subRoute.returnTo === "profile" ? ROUTES.PROFILE : ROUTES.PROFILE_DECKS;
    const backLabel = subRoute.returnTo === "profile" ? "Back to Profile" : "Back to Decks";
    return (
      <div className="space-y-5">
        <button
          onClick={() => navigate(backTarget)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </button>
        <h1 className="text-xl font-bold text-white">Edit Deck</h1>
        <DeckForm
          initialValues={editDeck}
          onSave={handleUpdate}
          saving={saving}
          onCancel={() => navigate(backTarget)}
        />
      </div>
    );
  }

  // ── Deck list ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={() => { fetchingRef.current = false; loadDecks(); }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(ROUTES.PROFILE)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Profile
        </button>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-9 text-sm px-4"
          onClick={() => navigate(ROUTES.PROFILE_DECK_NEW)}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Deck
        </Button>
      </div>

      <h1 className="text-xl font-bold text-white">My Decks</h1>

      {/* Filters */}
      {decks.length > 0 && (
        <DeckFilters
          filters={filters}
          onChange={setFilters}
          totalCount={filteredDecks.length}
        />
      )}

      {filteredDecks.length === 0 && decks.length > 0 ? (
        <EmptyState title="No decks match filters" description="Try clearing some filters." />
      ) : filteredDecks.length === 0 ? (
        <EmptyState title="No decks yet" description="Create your first Commander deck to get started." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {visibleDecks.map((deck) => (
              <DeckTile
                key={deck.id}
                deck={deck}
                onDelete={setDeletingDeck}
                isGuest={isGuest}
                onFavoriteToggle={handleFavoriteToggle}
                onInsights={setInsightsDeck}
              />
            ))}
          </div>
          {visibleCount < filteredDecks.length && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full py-2.5 rounded-xl border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800/50 text-sm transition-colors"
            >
              Load more ({filteredDecks.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}

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