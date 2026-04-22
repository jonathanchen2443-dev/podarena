/**
 * Step 4 — Review & Submit (corrected)
 * Visually resembles the match summary display.
 * Podium/ranking style, deck info, prop callout.
 */
import React from "react";
import { Pencil, User, Layers } from "lucide-react";
import { format } from "date-fns";
import { PRAISE_META } from "@/components/services/praiseService";
import { PRAISE_ICONS } from "@/components/praise/PraiseHelpModal";
import ManaPipRow from "@/components/mtg/ManaPipRow";

function formatName(name) {
  if (!name) return "Player";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function formatDateDisplay(iso) {
  if (!iso) return "—";
  try { return format(new Date(iso.replace("T", " ")), "MMM d, yyyy · HH:mm"); } catch { return iso; }
}

// Edit chip shown in section headers
function EditChip({ onEdit }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-300 transition-colors px-2 py-0.5 rounded-lg"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      <Pencil className="w-2.5 h-2.5" />
      Edit
    </button>
  );
}

// Rank configs for visual treatment
const RANK_CONFIG = {
  1: { medal: "🥇", barH: "h-20", barColor: "rgba(251,191,36,0.55)", bg: "rgba(251,191,36,0.09)", border: "rgba(251,191,36,0.30)", nameColor: "#fbbf24", glow: "0 0 18px rgba(251,191,36,0.15)" },
  2: { medal: "🥈", barH: "h-14", barColor: "rgba(156,163,175,0.45)", bg: "rgba(156,163,175,0.06)", border: "rgba(156,163,175,0.22)", nameColor: "#9ca3af", glow: "none" },
  3: { medal: "🥉", barH: "h-10", barColor: "rgba(217,119,6,0.45)", bg: "rgba(217,119,6,0.06)", border: "rgba(217,119,6,0.22)", nameColor: "#d97706", glow: "none" },
};
function getRankCfg(rank) {
  return RANK_CONFIG[rank] || { medal: null, barH: "h-8", barColor: "rgba(255,255,255,0.08)", bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.08)", nameColor: "#9ca3af", glow: "none" };
}

// ── Podium card (top 3 shown prominently) ─────────────────────────────────────
function PodiumRow({ rank, profile, isYou, deckLabel }) {
  const cfg = getRankCfg(rank);
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3 transition-all"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: cfg.glow }}
    >
      {/* Medal / rank */}
      <div className="w-8 flex-shrink-0 text-center">
        {cfg.medal ? (
          <span className="text-xl leading-none">{cfg.medal}</span>
        ) : (
          <span className="text-sm font-bold text-gray-600">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/10" />
      ) : (
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <User className="w-4 h-4 text-gray-600" />
        </div>
      )}

      {/* Name + deck */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate leading-none" style={{ color: cfg.nameColor }}>
          {isYou ? "You" : formatName(profile?.display_name)}
          {isYou && <span className="text-gray-600 text-xs font-normal ml-1.5">(you)</span>}
        </p>
        {deckLabel && (
          <p className="text-[11px] text-gray-600 truncate mt-0.5">{deckLabel}</p>
        )}
      </div>

      {/* Winner crown */}
      {rank === 1 && (
        <span className="text-yellow-400 text-lg flex-shrink-0">👑</span>
      )}
    </div>
  );
}

export default function WizardStep4Review({
  mode,
  pod,
  participants,
  memberData,
  placements,
  myDeckId,
  myDecks,
  playedAt,
  notes,
  praiseReceiver,
  praiseType,
  currentUser,
  onEditStep,
}) {
  const sorted = [...participants].sort((a, b) => (placements[a] || 99) - (placements[b] || 99));
  const myDeck = myDecks.find((d) => d.id === myDeckId) || null;
  const praiseMeta = praiseType ? PRAISE_META[praiseType] : null;
  const praiseReceiverName = praiseReceiver ? memberData[praiseReceiver]?.display_name : null;

  return (
    <div className="space-y-4 pt-2">

      {/* ── Game context ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-4 py-3 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {mode === "pod" && pod ? (
            <>
              <Layers className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">POD Game</p>
                <p className="text-sm text-white font-bold truncate">{pod.pod_name}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <span className="text-[10px]">⚔️</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Casual Game</p>
                <p className="text-sm text-white font-bold">Commander</p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[11px] text-gray-600">{formatDateDisplay(playedAt)}</p>
            <p className="text-[10px] text-gray-700">{participants.length} players</p>
          </div>
          <EditChip onEdit={() => onEditStep(1)} />
        </div>
      </div>

      {/* ── Your deck callout ─────────────────────────────────────────────── */}
      {myDeck && (
        <div
          className="flex items-center gap-3 rounded-2xl px-3 py-3"
          style={{
            background: "rgba(var(--ds-primary-rgb),0.07)",
            border: "1px solid rgba(var(--ds-primary-rgb),0.20)",
          }}
        >
          {myDeck.commander_image_url ? (
            <img src={myDeck.commander_image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-gray-600 text-xs">?</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Your Deck</p>
            <p className="text-sm font-bold text-white truncate">{myDeck.commander_name || myDeck.name}</p>
            {myDeck.commander_name && myDeck.name !== myDeck.commander_name && (
              <p className="text-[11px] text-gray-600 truncate">{myDeck.name}</p>
            )}
            <ManaPipRow colors={myDeck.color_identity || []} size={11} gap={2} />
          </div>
        </div>
      )}

      {/* ── Results — ranking list ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Results</p>
          <EditChip onEdit={() => onEditStep(2)} />
        </div>
        <div className="space-y-2">
          {sorted.map((uid) => {
            const rank = placements[uid] || 0;
            const profile = memberData[uid] || {};
            const isYou = uid === currentUser?.id;
            const deckLabel = isYou && myDeck
              ? (myDeck.commander_name || myDeck.name)
              : null;
            return (
              <PodiumRow
                key={uid}
                rank={rank}
                profile={profile}
                isYou={isYou}
                deckLabel={deckLabel}
              />
            );
          })}
        </div>
      </div>

      {/* ── Props ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Props</p>
          <EditChip onEdit={() => onEditStep(3)} />
        </div>
        {praiseReceiver && praiseMeta ? (
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              background: "rgba(var(--ds-primary-rgb),0.08)",
              border: "1px solid rgba(var(--ds-primary-rgb),0.25)",
            }}
          >
            <img src={PRAISE_ICONS[praiseType]} alt={praiseMeta.label} className="w-10 h-10 object-contain flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--ds-primary-text)" }}>{praiseMeta.label}</p>
              {praiseReceiverName && (
                <p className="text-xs text-gray-500 mt-0.5">awarded to {formatName(praiseReceiverName)}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl px-4 py-3 text-gray-700 text-sm italic"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            No props awarded
          </div>
        )}
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      {notes && (
        <div
          className="rounded-2xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-600 mb-1">Notes</p>
          <p className="text-gray-400 text-sm leading-relaxed">{notes}</p>
        </div>
      )}

      {/* ── Approval note ─────────────────────────────────────────────────── */}
      <p className="text-center text-gray-600 text-xs pb-1 leading-relaxed">
        All participants will receive a review request. The game counts once everyone approves.
      </p>

    </div>
  );
}