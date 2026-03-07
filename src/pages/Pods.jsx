import React from "react";
import { Layers, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Pods() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-6">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center ds-accent-bg ds-accent-bd border">
        <Layers className="w-8 h-8" style={{ color: "var(--ds-primary-text)" }} />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">PODS</h1>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">
          Leagues are being rebuilt as PODS — a more flexible way to organize your playgroup.
        </p>
      </div>

      {/* Status card */}
      <Card className="bg-gray-900/60 border-gray-800/50 w-full max-w-sm">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-white text-sm font-medium">Coming soon</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
              PODS will bring improved game tracking, standings, and playgroup management. Your existing game history is preserved and will be available when PODS launches.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}