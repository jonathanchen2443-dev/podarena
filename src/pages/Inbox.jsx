import React, { useState } from "react";
import { Bell, CheckCircle2, XCircle } from "lucide-react";
import { LoadingState, EmptyState, ErrorState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const placeholderItems = [
  {
    id: 1,
    type: "approval",
    title: "Game approval pending",
    description: "Alex Storm logged a game in Friday Night Commander",
    time: "2h ago",
    status: "pending",
  },
  {
    id: 2,
    type: "approval",
    title: "Game approved",
    description: "Your game on Jan 10 was approved by all players",
    time: "2d ago",
    status: "approved",
  },
];

export default function Inbox() {
  const [loading] = useState(false);
  const [error] = useState(null);

  if (loading) return <LoadingState message="Loading inbox..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-400">{placeholderItems.filter(i => i.status === "pending").length} pending</p>
      </div>

      {placeholderItems.length === 0 ? (
        <EmptyState
          title="All caught up!"
          description="No pending approvals or notifications."
        />
      ) : (
        <div className="space-y-3">
          {placeholderItems.map((item) => (
            <Card key={item.id} className="bg-gray-900/60 border-gray-800/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.status === "pending"
                      ? "bg-amber-500/10 border border-amber-500/20"
                      : "bg-emerald-500/10 border border-emerald-500/20"
                  }`}>
                    {item.status === "pending" ? (
                      <Bell className="w-4 h-4 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      {item.status === "pending" && (
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.time}</p>
                  </div>
                </div>
                {item.status === "pending" && (
                  <div className="flex gap-2 mt-3 ml-11">
                    <button className="flex-1 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                      Approve
                    </button>
                    <button className="flex-1 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                      Reject
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}