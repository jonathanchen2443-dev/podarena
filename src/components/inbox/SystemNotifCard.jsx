import React from "react";
import { MessageSquare, Clock, Eye, EyeOff, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function SystemNotifCard({ notif, acting, onMarkRead, onMarkUnread, onDelete }) {
  const isActing = !!acting[notif.id];
  const isRead = !!notif.read_at;
  const timeAgo = notif.created_date
    ? formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })
    : "";

  return (
    <div
      className={`border rounded-2xl p-4 space-y-2 transition-opacity ${
        isRead
          ? "bg-gray-900/30 border-gray-800/30 opacity-60"
          : "bg-gray-900/60 border-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!isRead && <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />}
            <p className="text-white text-sm font-medium leading-tight line-clamp-2">
              {notif.message || "System notification"}
            </p>
          </div>
          {timeAgo && (
            <span className="text-xs text-gray-600 flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => isRead ? onMarkUnread(notif) : onMarkRead(notif)}
            disabled={isActing}
            className="text-gray-600 hover:text-gray-400 transition-colors p-1"
            title={isRead ? "Mark unread" : "Mark read"}
          >
            {isRead ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDelete(notif)}
            disabled={isActing}
            className="text-gray-600 hover:text-red-400 transition-colors p-1"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}