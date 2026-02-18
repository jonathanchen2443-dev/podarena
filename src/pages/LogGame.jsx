import React, { useState } from "react";
import { Swords, Users, CalendarDays, FileText } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/shell/PageStates";
import { Card, CardContent } from "@/components/ui/card";

export default function LogGame() {
  const [loading] = useState(false);
  const [error] = useState(null);

  if (loading) return <LoadingState message="Loading..." />;
  if (error) return <ErrorState message={error} />;

  const steps = [
    { icon: Users, label: "Choose League", description: "Select the league this game belongs to" },
    { icon: Users, label: "Add Players", description: "Add participants and their decks" },
    { icon: Swords, label: "Set Results", description: "Record placements and outcomes" },
    { icon: FileText, label: "Review & Submit", description: "Submit for participant approval" },
  ];

  return (
    <div className="space-y-6">
      {/* Helper text */}
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
        <p className="text-sm text-violet-300 leading-relaxed">
          Log a completed game. All participants will be asked to approve the result before it
          counts in the standings.
        </p>
      </div>

      {/* Placeholder form steps */}
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

      {/* Placeholder submit */}
      <button
        disabled
        className="w-full h-12 rounded-xl bg-violet-600/40 text-violet-300 text-sm font-medium cursor-not-allowed border border-violet-700/30"
      >
        Submit Game (coming soon)
      </button>
    </div>
  );
}