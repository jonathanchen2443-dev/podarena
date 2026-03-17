import React from "react";
import { User, CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

/**
 * GameApprovalCard — renders a pending game review item in the Inbox.
 * Source of truth is GameParticipant.approval_status (not GameApproval).
 * Deck display uses snapshot data from GameParticipant.
 */
export default function GameApprovalCard({ item, acting, onApprove, onReject }) {
  const isActing = acting[item.approvalId] || acting[item.gameParticipantId];
  const game = item.game;

  const dateStr = game.played_at
    ? format(new Date(game.played_at), "MMM d, yyyy")
    : "Unknown date";

  const { approved, pending, rejected, total } = game.approvalSummary;

  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
              🎲 Review Needed
            </span>
            <span className="text-xs text-gray-500">{item.contextLabel}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{dateStr}</p>
          {item.submittedByName && (
            <p className="text-xs text-gray-600 mt-0.5">Logged by {item.submittedByName}</p>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="space-y-1.5">
        {game.participants
          .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
          .map((p) => {
            const statusIcon =
              p.approval_status === "approved" ? <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" /> :
              p.approval_status === "rejected"  ? <XCircle    className="w-3 h-3 text-red-400 flex-shrink-0"     /> :
                                                  <Clock      className="w-3 h-3 text-amber-400 flex-shrink-0"   />;
            return (
              <div key={p.userId} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <User className="w-3 h-3 text-gray-500" />
                  )}
                </div>
                <span className="text-xs text-gray-300 flex-1 truncate">
                  {p.display_name}
                  {p.is_creator && <span className="text-gray-600 ml-1">(recorder)</span>}
                </span>
                {p.placement && (
                  <span className="text-xs text-gray-600">#{p.placement}</span>
                )}
                {statusIcon}
              </div>
            );
          })}
      </div>

      {/* Review progress */}
      {total > 0 && (
        <p className="text-xs text-gray-600">
          {approved}/{total} approved{rejected > 0 ? ` · ${rejected} rejected` : ""}
        </p>
      )}

      {game.notes && (
        <p className="text-xs text-gray-500 italic truncate">{game.notes}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 bg-red-600/70 hover:bg-red-600 text-white text-xs h-9 rounded-xl"
          disabled={isActing}
          onClick={() => onReject(item)}
        >
          {isActing ? "…" : "Reject"}
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-xl"
          disabled={isActing}
          onClick={() => onApprove(item)}
        >
          {isActing ? "…" : "Review & Approve"}
        </Button>
      </div>
    </div>
  );
}