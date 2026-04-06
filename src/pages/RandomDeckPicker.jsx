import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import confetti from "canvas-confetti";
import { pickRandomDeck } from "@/components/services/randomDeckService";
import { ROUTES } from "@/components/utils/routes";
import ManaPipRow from "@/components/mtg/ManaPipRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shuffle, Share2, BookOpen, Lock } from "lucide-react";

// ── Mana color → confetti hex map ─────────────────────────────────────────────
const MANA_CONFETTI_COLORS = {
  W: "#f9fafb",
  U: "#3b82f6",
  B: "#a855f7",
  R: "#ef4444",
  G: "#22c55e",
  C: "#9ca3af",
};

function getConfettiColors(colorIdentity) {
  if (!colorIdentity || colorIdentity.length === 0) return ["#9ca3af", "#e5e7eb"];
  return colorIdentity.map((c) => MANA_CONFETTI_COLORS[c] || "#9ca3af");
}

// ── Reveal stages ─────────────────────────────────────────────────────────────
// stage 0 = hidden/pre-reveal
// stage 1 = small image, 100% shadowed (brightness 0%)
// stage 2 = medium image, 90% shadowed (brightness 10%)
// stage 3 = full image, 80% shadowed (brightness 20%)
// stage 4 = full image, fully revealed center-outward
// stage 5 = details + buttons visible

const STAGE_IMAGE_SIZE = {
  0: 0,
  1: 100,
  2: 148,
  3: 192,
  4: 192,
  5: 192,
};

const STAGE_BRIGHTNESS = {
  0: 0,
  1: 0.0,
  2: 0.10,
  3: 0.20,
  4: 1.0,
  5: 1.0,
};

// ── Keyframe style for center-outward reveal ──────────────────────────────────
const REVEAL_KEYFRAME_STYLE = `
@keyframes revealFromCenter {
  from {
    -webkit-mask-size: 0% 0%;
    mask-size: 0% 0%;
  }
  to {
    -webkit-mask-size: 300% 300%;
    mask-size: 300% 300%;
  }
}
`;

// ── Format selector ───────────────────────────────────────────────────────────
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

// ── Reveal card ───────────────────────────────────────────────────────────────
function DeckReveal({ deck, onPickAgain }) {
  const [stage, setStage] = useState(0);
  const timers = useRef([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function after(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }

  useEffect(() => {
    clearTimers();
    // Stage 1 starts almost immediately
    after(() => setStage(1), 80);
    // ~1.2s between each stage
    after(() => setStage(2), 1280);
    after(() => setStage(3), 2480);
    after(() => setStage(4), 3680);
    // Details appear shortly after full reveal
    after(() => setStage(5), 4280);

    // Confetti fires just as details appear
    after(() => {
      const colors = getConfettiColors(deck.color_identity);
      confetti({
        particleCount: 45,
        spread: 65,
        origin: { y: 0.5 },
        colors,
        gravity: 1.3,
        ticks: 150,
      });
    }, 4350);

    return clearTimers;
  }, [deck]);

  async function handleShare() {
    const text = `🎲 Random Deck Pick: ${deck.name}${deck.commander_name ? ` — ${deck.commander_name}` : ""} (Commander)`;
    if (navigator.share) {
      try { await navigator.share({ title: "Random Deck Pick", text }); } catch (_) {}
    } else {
      try { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); } catch (_) {}
    }
  }

  const imgSize = STAGE_IMAGE_SIZE[stage] || 0;
  const brightness = STAGE_BRIGHTNESS[stage] ?? 0;
  const showImage = stage >= 1;
  const showDetails = stage >= 5;

  return (
    // Fixed-height container so the card never shifts during the reveal
    <div className="flex flex-col items-center" style={{ minHeight: 380 }}>
      <style>{REVEAL_KEYFRAME_STYLE}</style>

      {/* Commander image — fixed outer container at final size, image grows inside */}
      <div
        className="relative rounded-2xl overflow-hidden border-2 border-gray-700/60 shadow-xl bg-gray-800 flex items-center justify-center flex-shrink-0 mt-2"
        style={{ width: 192, height: 192 }}
      >
        {/* Invisible slot keeps container at final size; image grows from center */}
        <div
          style={{
            width: imgSize,
            height: imgSize,
            transition: stage === 4
              ? "width 350ms cubic-bezier(0.34,1.3,0.64,1), height 350ms cubic-bezier(0.34,1.3,0.64,1), filter 700ms ease-out"
              : "width 320ms cubic-bezier(0.34,1.4,0.64,1), height 320ms cubic-bezier(0.34,1.4,0.64,1)",
            overflow: "hidden",
            borderRadius: "inherit",
            visibility: showImage ? "visible" : "hidden",
            // Stages 1-3: brightness filter for silhouette effect
            // Stage 4: switch to a radial mask expanding from center to reveal image
            filter: stage < 4 ? `brightness(${brightness})` : "brightness(1)",
            WebkitMaskImage: stage >= 4
              ? "radial-gradient(circle, white 0%, white 100%)"
              : undefined,
            maskImage: stage >= 4
              ? "radial-gradient(circle, white 0%, white 100%)"
              : undefined,
            WebkitMaskSize: stage === 4 ? "400% 400%" : "100% 100%",
            maskSize: stage === 4 ? "400% 400%" : "100% 100%",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            ...(stage === 4 ? {
              animation: "revealFromCenter 600ms ease-out forwards",
            } : {}),
          }}
        >
          {deck.commander_image_url ? (
            <img
              src={deck.commander_image_url}
              alt={deck.commander_name || deck.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-gray-600" />
            </div>
          )}
        </div>
      </div>

      {/* Mana pips */}
      <div
        className="mt-4"
        style={{
          opacity: showDetails ? 1 : 0,
          transform: showDetails ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 280ms ease-out, transform 280ms ease-out",
        }}
      >
        <ManaPipRow colors={deck.color_identity} size={22} gap={3} />
      </div>

      {/* Deck name + commander name */}
      <div
        className="text-center mt-2.5"
        style={{
          opacity: showDetails ? 1 : 0,
          transform: showDetails ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 320ms ease-out 60ms, transform 320ms ease-out 60ms",
        }}
      >
        <p className="text-lg font-bold text-white leading-tight">{deck.name}</p>
        {deck.commander_name && (
          <p
            className="text-sm text-gray-400 mt-0.5"
            style={{
              opacity: showDetails ? 1 : 0,
              transition: "opacity 320ms ease-out 130ms",
            }}
          >
            {deck.commander_name}
          </p>
        )}
      </div>

      {/* Share + Pick Again — only in final state */}
      <div
        className="w-full flex flex-col gap-2.5 mt-4"
        style={{
          opacity: showDetails ? 1 : 0,
          pointerEvents: showDetails ? "auto" : "none",
          transition: "opacity 280ms ease-out 200ms",
        }}
      >
        <Button
          variant="outline"
          className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full rounded-xl h-10 text-sm"
          onClick={handleShare}
        >
          <Share2 className="w-4 h-4 mr-1.5" />
          Share
        </Button>
        <Button
          className="ds-btn-primary w-full rounded-xl h-11 text-sm font-semibold"
          onClick={onPickAgain}
        >
          <Shuffle className="w-4 h-4 mr-1.5" />
          Pick Again
        </Button>
      </div>

    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-gray-800 border border-gray-700/50 flex items-center justify-center">
        <BookOpen className="w-6 h-6 text-gray-500" />
      </div>
      <div>
        <p className="text-white font-semibold text-base">No active decks found</p>
        <p className="text-gray-400 text-sm mt-1">
          You need at least one active deck to use the Random Deck Picker.
        </p>
      </div>
      <Link to={ROUTES.PROFILE_DECKS}>
        <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl">
          Go to My Decks
        </Button>
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RandomDeckPicker() {
  const [deck, setDeck] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revealKey, setRevealKey] = useState(0);

  async function handlePick() {
    setLoading(true);
    setError(null);
    setEmpty(false);
    setDeck(null);
    try {
      const result = await pickRandomDeck();
      if (!result) {
        setEmpty(true);
      } else {
        setRevealKey((k) => k + 1);
        setDeck(result);
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Page title — tight */}
      <div>
        <h1 className="text-xl font-bold text-white">Random Deck Picker</h1>
        <p className="text-gray-400 text-sm mt-0.5">Can't decide? Let fate choose your deck.</p>
      </div>

      {/* Format selector — compact */}
      <FormatSelector />

      {/* Primary pick prompt */}
      {!deck && !empty && (
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl ds-accent-bg ds-accent-bd border flex items-center justify-center">
              <img
                src="https://media.base44.com/images/public/6995f1fed0849cf726dfe04d/ea67a07bb_dice_8732022.png"
                alt="dice"
                className="w-6 h-6 object-contain"
              />
            </div>
            <p className="text-gray-400 text-xs max-w-xs mx-auto">
              Pick a random deck from your active collection and get straight to the game.
            </p>
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

      {/* Result with reveal animation */}
      {deck && (
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-5">
            <DeckReveal key={revealKey} deck={deck} onPickAgain={handlePick} />
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