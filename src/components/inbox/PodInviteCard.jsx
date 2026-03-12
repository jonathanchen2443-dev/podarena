import React from "react";
import { Button } from "@/components/ui/button";
import { Layers, Clock, Eye, EyeOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function PodInviteCard({ notif, acting, onAccept, onDecline, onMarkRead, onMarkUnread }) {
  const meta = notif.metadata || {};
  const isActing = !!acting[notif.id];
  const isHandled = !!notif.read_at;
  const timeAgo = notif.created_date
    ? formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })
    : "";

  return (
    <div
      className={`border rounded-2xl p-4 space-y-3 transition-opacity ${
        isHandled
          ? "bg-gray-900/30 border-gray-800/30 opacity-60"
          : "bg-gray-900/60 border-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
          <Layers className="w-5 h-5" style={{ color: "var(--ds-primary-text)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!isHandled && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
            <p className="text-white font-semibold text-sm leading-tight">
              {meta.pod_name || "POD Invite"}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {meta.pod_code && (
              <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md">
                {meta.pod_code}
              </span>
            )}
            {isHandled && (
              <span className="text-xs text-gray-500 italic">Handled</span>
            )}
          </div>
          {meta.pod_description && (
            <p className="text-gray-400 text-xs mt-1 line-clamp-2">{meta.pod_description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {timeAgo && (
            <span className="text-xs text-gray-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
          )}
          {/* Read toggle for handled invites */}
          {isHandled ? (
            <button
              onClick={() => onMarkUnread(notif)}
              disabled={isActing}
              className="text-gray-600 hover:text-gray-400 transition-colors"
              title="Mark unread"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Actions — only shown if not yet handled */}
      {!isHandled && (
        <div className="flex gap-2">
          <Button
            onClick={() => onAccept(notif)}
            disabled={isActing}
            className="flex-1 h-9 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: "rgb(var(--ds-primary-rgb))", color: "#fff" }}
          >
            {isActing ? "…" : "Accept"}
          </Button>
          <Button
            onClick={() => onDecline(notif)}
            disabled={isActing}
            variant="outline"
            className="flex-1 h-9 rounded-xl text-sm border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent"
          >
            {isActing ? "…" : "Decline"}
          </Button>
        </div>
      )}
    </div>
  );
}