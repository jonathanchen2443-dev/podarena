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
  W: "#f9fafb", // white
  U: "#3b82f6", // blue
  B: "#6b21a8", // black/purple
  R: "#ef4444", // red
  G: "#22c55e", // green
  C: "#9ca3af", // colorless
};

function getConfettiColors(colorIdentity) {
  if (!colorIdentity || colorIdentity.length === 0) return ["#9ca3af", "#e5e7eb"];
  return colorIdentity.map((c) => MANA_CONFETTI_COLORS[c] || "#9ca3af");
}

// ── Reveal animation states ───────────────────────────────────────────────────
// idle → pulse1 → pulse2 → pulse3 → uncover → details → done
const REVEAL_STEPS = ["idle", "pulse1", "pulse2", "pulse3", "uncover", "details", "done"];

// px sizes for the three pulse steps and final
const PULSE_SIZES = { pulse1: 80, pulse2: 128, pulse3: 172, uncover: 192, done: 192 };

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
  const [step, setStep] = useState("idle");
  const timerRef = useRef([]);

  function clearTimers() {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  }

  function schedule(fn, delay) {
    const id = setTimeout(fn, delay);
    timerRef.current.push(id);
  }

  // Start the reveal sequence as soon as this component mounts
  useEffect(() => {
    clearTimers();

    // 3-step pulse sequence: small → medium → large, each with a brief settle
    schedule(() => setStep("pulse1"), 50);   // almost immediately: small
    schedule(() => setStep("pulse2"), 350);  // 300ms settle → medium
    schedule(() => setStep("pulse3"), 700);  // 350ms settle → large
    // At full size but still dark: hold briefly
    schedule(() => setStep("uncover"), 1050); // 350ms settle → fade dark overlay away
    // After overlay fades (300ms transition), show text details
    schedule(() => setStep("details"), 1400);
    // Final stable state
    schedule(() => setStep("done"), 1750);

    // Confetti after details appear
    schedule(() => {
      const colors = getConfettiColors(deck.color_identity);
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.55 },
        colors,
        gravity: 1.2,
        ticks: 180,
      });
    }, 1500);

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

  const isDone = step === "done";
  const showDetails = step === "details" || step === "done";
  const overlayVisible = step === "pulse1" || step === "pulse2" || step === "pulse3";
  const imgSize = PULSE_SIZES[step] || 0;
  const showImage = step !== "idle";

  return (
    <div className="flex flex-col items-center gap-5">

      {/* Commander image with reveal animation */}
      <div
        className="relative rounded-2xl overflow-hidden border-2 border-gray-700/60 shadow-xl bg-gray-800 flex items-center justify-center flex-shrink-0"
        style={{
          width: imgSize || 192,
          height: imgSize || 192,
          transition: "width 240ms cubic-bezier(0.34,1.56,0.64,1), height 240ms cubic-bezier(0.34,1.56,0.64,1)",
          visibility: showImage ? "visible" : "hidden",
        }}
      >
        {deck.commander_image_url ? (
          <img
            src={deck.commander_image_url}
            alt={deck.commander_name || deck.name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <BookOpen className="w-16 h-16 text-gray-600" />
        )}

        {/* Dark overlay — fades away at "uncover" step */}
        <div
          className="absolute inset-0 bg-black rounded-2xl"
          style={{
            opacity: overlayVisible ? 1 : 0,
            transition: overlayVisible ? "none" : "opacity 320ms ease-out",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Mana pips — fade in after image reveal */}
      <div
        style={{
          opacity: showDetails ? 1 : 0,
          transform: showDetails ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 280ms ease-out, transform 280ms ease-out",
        }}
      >
        <ManaPipRow colors={deck.color_identity} size={24} gap={4} />
      </div>

      {/* Deck name + commander name — staggered after mana */}
      <div
        className="text-center"
        style={{
          opacity: showDetails ? 1 : 0,
          transform: showDetails ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 320ms ease-out 80ms, transform 320ms ease-out 80ms",
        }}
      >
        <p className="text-xl font-bold text-white leading-tight">{deck.name}</p>
        {deck.commander_name && (
          <p
            className="text-sm text-gray-400 mt-1"
            style={{
              opacity: showDetails ? 1 : 0,
              transition: "opacity 320ms ease-out 160ms",
            }}
          >
            {deck.commander_name}
          </p>
        )}
      </div>

      {/* Share + Pick Again — only visible in final done state */}
      <div
        className="w-full flex flex-col gap-3"
        style={{
          opacity: isDone ? 1 : 0,
          pointerEvents: isDone ? "auto" : "none",
          transition: "opacity 240ms ease-out",
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
  const [deck, setDeck] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // revealKey increments on every pick — forces DeckReveal to remount and restart animation
  const [revealKey, setRevealKey] = useState(0);

  async function handlePick() {
    setLoading(true);
    setError(null);
    setEmpty(false);
    setDeck(null); // hide previous result while fetching
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
    <div className="space-y-6 pb-8">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-white">Random Deck Picker</h1>
        <p className="text-gray-400 text-sm mt-0.5">Can't decide? Let fate choose your deck.</p>
      </div>

      {/* Format selector */}
      <FormatSelector />

      {/* Primary pick prompt — shown before any pick */}
      {!deck && !empty && (
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

      {/* Result with reveal animation */}
      {deck && (
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-6">
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