import React, { useState } from "react";
import { User, Trophy, Swords, Shield, ChevronRight } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  { label: "Games Played", value: "—" },
  { label: "Wins", value: "—" },
  { label: "Decks", value: "—" },
  { label: "Leagues", value: "—" },
];

const actions = [
  { icon: Shield, label: "My Decks", description: "Manage your Commander decks" },
  { icon: Trophy, label: "My Leagues", description: "View leagues you're a member of" },
  { icon: Swords, label: "Game History", description: "Browse all your logged games" },
];

export default function Profile() {
  const [loading] = useState(false);
  const [error] = useState(null);

  if (loading) return <LoadingState message="Loading profile..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      {/* Profile card placeholder */}
      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <User className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">—</p>
              <p className="text-gray-500 text-sm">Not signed in</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mt-6 pt-5 border-t border-gray-800/60">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-white font-bold text-lg">{stat.value}</p>
                <p className="text-gray-600 text-[10px] mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-2">
        {actions.map((action) => (
          <Card key={action.label} className="bg-gray-900/60 border-gray-800/50 hover:border-violet-800/40 transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center border border-gray-700">
                <action.icon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{action.label}</p>
                <p className="text-xs text-gray-500">{action.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sign in placeholder */}
      <button
        disabled
        className="w-full h-12 rounded-xl bg-violet-600/40 text-violet-300 text-sm font-medium cursor-not-allowed border border-violet-700/30"
      >
        Sign In (coming soon)
      </button>
    </div>
  );
}