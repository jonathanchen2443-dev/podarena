import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Shield, Swords, Users, Trophy, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.isAuthenticated().then((auth) => {
      setIsLoggedIn(auth);
      setLoading(false);
    });
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-amber-600/10" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              Commander League Tracker
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Track Your
              </span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
                MTG Battles
              </span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl leading-relaxed">
              Organize leagues, log games, track decks, and keep your playgroup's
              history alive — all with built-in approval so every result is fair.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              {isLoggedIn ? (
                <Link to={createPageUrl("Dashboard")}>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 h-12 text-base rounded-xl shadow-lg shadow-violet-500/25"
                  >
                    Go to Dashboard
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={() => base44.auth.redirectToLogin()}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 h-12 text-base rounded-xl shadow-lg shadow-violet-500/25"
                  >
                    Sign In
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                  <Link to={createPageUrl("Leagues")}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-gray-700 text-gray-300 hover:bg-gray-800/50 px-8 h-12 text-base rounded-xl"
                    >
                      Browse as Guest
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm hover:border-gray-700/50 transition-all duration-300 group"
            >
              <CardContent className="p-8">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}