import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, ChevronRight, Globe, Lock } from "lucide-react";
import { LoadingState, EmptyState, ErrorState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";

// Placeholder league items for skeleton
const placeholderLeagues = [
  { id: 1, name: "Friday Night Commander", is_public: true, member_count: 8 },
  { id: 2, name: "The Inner Circle", is_public: false, member_count: 4 },
];

export default function LeaguesList() {
  const [loading] = useState(false);
  const [error] = useState(null);

  if (loading) return <LoadingState message="Loading leagues..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-400">{placeholderLeagues.length} leagues</p>
        <button className="text-sm text-violet-400 font-medium">+ New League</button>
      </div>

      {placeholderLeagues.length === 0 ? (
        <EmptyState
          title="No leagues yet"
          description="Create a league to start tracking games with your playgroup."
        />
      ) : (
        <div className="space-y-3">
          {placeholderLeagues.map((league) => (
            <Card
              key={league.id}
              className="bg-gray-900/60 border-gray-800/50 hover:border-violet-800/40 transition-all"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{league.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {league.is_public ? (
                        <Globe className="w-3 h-3 text-gray-500" />
                      ) : (
                        <Lock className="w-3 h-3 text-gray-500" />
                      )}
                      <span className="text-xs text-gray-500">
                        {league.is_public ? "Public" : "Private"} · {league.member_count} members
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}