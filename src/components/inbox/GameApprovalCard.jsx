import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Users, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function GameApprovalCard({ item, acting, onApprove, onReject }) {
  const isActing = !!acting[item.approvalId];
  const dateStr = item.game.played_at
    ? formatDistanceToNow(new Date(item.game.played_at), { addSuffix: true })
    : "";

  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white text-sm font-semibold">{item.leagueName}</span>
            <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
              {item.contextType}
            </span>
            {item.podId && item.contextType === "pod" && (
              <span className="text-[10px] bg-gray-800/80 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                {item.podCode || ""}
              </span>
            )}
          </div>
          {item.submittedByName && (
            <p className="text-xs text-gray-500 mt-0.5">
              Submitted by {item.submittedByName}
            </p>
          )}
        </div>
        {dateStr && (
          <span className="text-xs text-gray-600 flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {dateStr}
          </span>
        )}
      </div>

      {/* Participants */}
      <div className="flex flex-wrap gap-2">
        {item.game.participants.map((p) => (
          <div
            key={p.userId}
            className="flex items-center gap-1.5 bg-gray-800/70 rounded-xl px-2 py-1"
          >
            {p.avatar_url ? (
              <img src={p.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                <Users className="w-2.5 h-2.5 text-gray-500" />
              </div>
            )}
            <span className="text-xs text-white">{p.display_name}</span>
            {p.placement && <span className="text-xs text-gray-500">#{p.placement}</span>}
          </div>
        ))}
      </div>

      {item.game.notes ? (
        <p className="text-xs text-gray-500 italic">"{item.game.notes}"</p>
      ) : null}

      <p className="text-xs text-gray-600">
        {item.game.approvalSummary.approved}/{item.game.approvalSummary.total} approved
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={() => onApprove(item)}
          disabled={isActing}
          className="flex-1 h-9 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "rgb(var(--ds-primary-rgb))", color: "#fff" }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {isActing ? "…" : "Approve"}
        </Button>
        <Button
          onClick={() => onReject(item)}
          disabled={isActing}
          variant="outline"
          className="flex-1 h-9 rounded-xl text-sm border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent"
        >
          <XCircle className="w-3.5 h-3.5" />
          {isActing ? "…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}