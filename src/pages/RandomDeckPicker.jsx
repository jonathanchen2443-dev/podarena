import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { pickRandomDeck } from "@/components/services/randomDeckService";
import { ROUTES } from "@/components/utils/routes";
import ManaPipRow from "@/components/mtg/ManaPipRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shuffle, Share2, ChevronLeft, BookOpen, Lock } from "lucide-react";

// ── Format selector (locked to Commander) ─────────────────────────────────────
function FormatSelector() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Format</span>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700/60">
        <span className="text-sm font-semibold text-white">Commander</span>
        <Lock className="w-3 h-3 text-gray-500 ml-1" />
      </div>
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────
function DeckResult({ deck, onPickAgain }) {
  const navigate = useNavigate();

  async function handleShare() {
    const text = `🎲 Random Deck Pick: ${deck.name}${deck.commander_name ? ` — ${deck.commander_name}` : ""} (Commander)`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Random Deck Pick", text });
      } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
      } catch (_) {}
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Share button — top */}
      <Button
        variant="outline"
        className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full rounded-xl h-10 text-sm"
        onClick={handleShare}
      >
        <Share2 className="w-4 h-4 mr-1.5" />
        Share
      </Button>

      {/* Commander image */}
      <div className="w-48 h-48 rounded-2xl overflow-hidden border-2 border-gray-700/60 shadow-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
        {deck.commander_image_url ? (
          <img
            src={deck.commander_image_url}
            alt={deck.commander_name || deck.name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <BookOpen className="w-16 h-16 text-gray-600" />
        )}
      </div>

      {/* Mana pips */}
      <div className="flex justify-center">
        <ManaPipRow colors={deck.color_identity} size={24} gap={4} />
      </div>

      {/* Deck name + commander name */}
      <div className="text-center">
        <p className="text-xl font-bold text-white leading-tight">{deck.name}</p>
        {deck.commander_name && (
          <p className="text-sm text-gray-400 mt-1">{deck.commander_name}</p>
        )}
      </div>

      {/* Pick Again button — bottom */}
      <Button
        className="ds-btn-primary w-full rounded-xl h-11 text-sm font-semibold"
        onClick={onPickAgain}
      >
        <Shuffle className="w-4 h-4 mr-1.5" />
        Pick Again
      </Button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700/50 flex items-center justify-center">
        <BookOpen className="w-7 h-7 text-gray-500" />
      </div>
      <div>
        <p className="text-white font-semibold text-base">No active decks found</p>
        <p className="text-gray-400 text-sm mt-1">
          You need at least one active deck to use the Random Deck Picker.
        </p>
      </div>
      <Link to={ROUTES.PROFILE_DECKS}>
        <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl mt-1">
          Go to My Decks
        </Button>
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RandomDeckPicker() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [deck, setDeck] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(false);

  async function handlePick() {
    setLoading(true);
    setError(null);
    setEmpty(false);
    try {
      const result = await pickRandomDeck(auth);
      if (!result) {
        setEmpty(true);
        setDeck(null);
        setPicked(false);
      } else {
        setDeck(result);
        setPicked(true);
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Random Deck Picker</h1>
          <p className="text-gray-500 text-xs mt-0.5">Can't decide? Let fate choose your deck.</p>
        </div>
      </div>

      {/* Format selector */}
      <FormatSelector />

      {/* Primary pick button (shown before first pick, or alongside result for "pick again" via result card) */}
      {!picked && (
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl ds-accent-bg ds-accent-bd border flex items-center justify-center">
              <Shuffle className="w-7 h-7" style={{ color: "var(--ds-primary-text)" }} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Randomize your session</p>
              <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto">
                Pick a random deck from your active collection and get straight to the game.
              </p>
            </div>
            <Button
              className="ds-btn-primary w-full rounded-xl h-11 text-sm font-semibold"
              onClick={handlePick}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                  Picking…
                </>
              ) : (
                <>
                  <Shuffle className="w-4 h-4 mr-1.5" />
                  Pick a Random Deck
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {picked && deck && (
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-6">
            <DeckResult deck={deck} onPickAgain={handlePick} />
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {empty && (
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-0">
            <EmptyState />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
    </div>
  );
}