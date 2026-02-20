import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { Plus, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { LoadingState, EmptyState } from "@/components/shell/PageStates";
import DeckCard from "@/components/decks/DeckCard";
import DeckForm from "@/components/decks/DeckForm";
import DeleteDeckModal from "@/components/decks/DeleteDeckModal";
import { listMyDecks, getMyDeckById, createDeck, updateDeck, deleteDeck } from "@/components/services/deckService";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

// Determine sub-route from URL
function getSubRoute() {
  const path = window.location.pathname.toLowerCase();
  // /profile-decks/:id/edit
  const editMatch = path.match(/profile-decks\/([^/]+)\/edit/);
  if (editMatch) return { mode: "edit", deckId: editMatch[1] };
  // /profile-decks/new
  if (path.includes("/profile-decks/new")) return { mode: "new" };
  // /profile-decks (list)
  return { mode: "list" };
}

export default function ProfileDecks() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { isGuest, authLoading } = auth;
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingDeck, setDeletingDeck] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDeck, setEditDeck] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

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
  }, [authLoading, isGuest, window.location.pathname]);

  async function loadDecks() {
    setLoading(true);
    const data = await listMyDecks(auth);
    setDecks(data);
    setLoading(false);
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
    navigate(ROUTES.PROFILE_DECKS);
    setSaving(false);
  }

  async function handleUpdate(payload) {
    setSaving(true);
    await updateDeck(auth, subRoute.deckId, payload);
    toast.success("Deck updated!");
    navigate(ROUTES.PROFILE_DECKS);
    setSaving(false);
  }

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    await deleteDeck(auth, deletingDeck.id);
    toast.success("Deck deleted.");
    setDeletingDeck(null);
    setDeleteLoading(false);
    await loadDecks();
  }

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
    return (
      <div className="space-y-5">
        <button
          onClick={() => navigate(ROUTES.PROFILE_DECKS)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Decks
        </button>
        <h1 className="text-xl font-bold text-white">Edit Deck</h1>
        <DeckForm initialValues={editDeck} onSave={handleUpdate} saving={saving} />
      </div>
    );
  }

  // ── Deck list ────────────────────────────────────────────────────────────────
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

      {decks.length === 0 ? (
        <EmptyState
          title="No decks yet"
          description="Create your first Commander deck to get started."
        />
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} onDelete={setDeletingDeck} />
          ))}
        </div>
      )}

      <DeleteDeckModal
        deck={deletingDeck}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingDeck(null)}
        loading={deleteLoading}
      />
    </div>
  );
}