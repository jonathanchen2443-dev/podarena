import React from "react";
import { Trophy } from "lucide-react";

export default function Badges() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
        <Trophy className="w-8 h-8 text-amber-400" />
      </div>
      <h1 className="text-white font-bold text-xl">Badges</h1>
      <p className="text-gray-400 text-sm">Coming soon</p>
    </div>
  );
}