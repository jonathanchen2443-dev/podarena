import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Swords, Users, FileText, Lock } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/auth/AuthContext";
import LoginRequiredModal from "@/components/auth/LoginRequiredModal";

const steps = [
  { icon: Users, label: "Choose League", description: "Select the league this game belongs to" },
  { icon: Users, label: "Add Players", description: "Add participants and their decks" },
  { icon: Swords, label: "Set Results", description: "Record placements and outcomes" },
  { icon: FileText, label: "Review & Submit", description: "Submit for participant approval" },
];

export default function LogGame() {
  const { isGuest, authLoading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (authLoading) return <LoadingState message="Loading..." />;

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-violet-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Login to Log a Game</h2>
          <p className="text-gray-400 text-sm mt-1">
            Sign in to record game results and track your playgroup's history.
          </p>
        </div>
        <button
          onClick={() => setShowLoginModal(true)}
          className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          Sign In
        </button>
        {showLoginModal && <LoginRequiredModal onClose={() => setShowLoginModal(false)} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
        <p className="text-sm text-violet-300 leading-relaxed">
          Log a completed game. All participants will be asked to approve the result before it
          counts in the standings.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <Card key={i} className="bg-gray-900/60 border-gray-800/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-semibold text-gray-400">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{step.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{step.description}</p>
              </div>
              <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700" />
            </CardContent>
          </Card>
        ))}
      </div>

      <button
        disabled
        className="w-full h-12 rounded-xl bg-violet-600/40 text-violet-300 text-sm font-medium cursor-not-allowed border border-violet-700/30"
      >
        Submit Game (coming soon)
      </button>
    </div>
  );
}