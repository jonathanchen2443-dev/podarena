import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Shield, Swords, Users, Trophy, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/shell/PageStates";

const features = [
  {
    icon: Users,
    title: "Leagues",
    description: "Create or join leagues with your playgroup. Track standings and history.",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Swords,
    title: "Game Logging",
    description: "Log games with full participant tracking, deck choices, and results.",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: Shield,
    title: "Approval System",
    description: "All games require participant approval before they count in standings.",
    color: "from-emerald-500 to-green-600",
  },
  {
    icon: Trophy,
    title: "Deck Tracking",
    description: "Manage your Commander decks with color identity and match history.",
    color: "from-sky-500 to-blue-600",
  },
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.isAuthenticated().then((auth) => {
      setIsLoggedIn(auth);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState message="Loading..." />;

  return (
    <div className="space-y-6 py-2">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-gray-900/80 to-amber-600/10 border border-violet-700/20 p-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl -translate-y-8 translate-x-8" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-4">
            <Sparkles className="w-3 h-3" />
            Commander League Tracker
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">
            Track Your<br />
            <span className="bg-gradient-to-r from-violet-400 to-amber-400 bg-clip-text text-transparent">
              MTG Battles
            </span>
          </h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            Organize leagues, log games, track decks — with built-in approval so every result is fair.
          </p>
          <div className="mt-4">
            {isLoggedIn ? (
              <Link to={createPageUrl("LeaguesList")}>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-9">
                  View Leagues <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                onClick={() => base44.auth.redirectToLogin()}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-9"
              >
                Sign In to Get Started <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-2 gap-3">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="bg-gray-900/60 border-gray-800/50 hover:border-gray-700/50 transition-all"
          >
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3`}>
                <feature.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-white font-semibold text-sm">{feature.title}</p>
              <p className="text-gray-500 text-xs mt-1 leading-snug">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}