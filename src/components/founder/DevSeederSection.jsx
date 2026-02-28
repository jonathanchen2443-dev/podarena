import React, { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function DevSeederSection({ auth }) {
  const [loading, setLoading] = useState(null);

  async function seedCasualGame() {
    setLoading("casual");
    try {
      const game = await base44.entities.Game.create({
        context_type: "casual",
        league_id: null,
        status: "approved",
        played_at: new Date().toISOString(),
        notes: "Demo casual game seeded from Founder Console.",
      });
      await base44.entities.GameParticipant.create({
        game_id: game.id,
        user_id: auth.currentUser.id,
        result: "win",
        placement: 1,
      });
      toast.success("Demo casual game created.");
    } catch (e) {
      toast.error(e.message || "Failed to seed casual game.");
    } finally { setLoading(null); }
  }

  async function seedNotification() {
    setLoading("notif");
    try {
      await base44.entities.Notification.create({
        type: "league_join",
        league_id: "demo",
        actor_user_id: auth.currentUser.id,
        recipient_user_id: auth.currentUser.id,
        message: "Demo notification seeded from Founder Console.",
      });
      toast.success("Demo notification created (visible in Inbox).");
    } catch (e) {
      toast.error(e.message || "Failed to seed notification.");
    } finally { setLoading(null); }
  }

  function SeedBtn({ id, label, onClick }) {
    const active = loading === id;
    return (
      <Button
        variant="outline"
        size="sm"
        className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl justify-start gap-2"
        onClick={onClick}
        disabled={loading !== null}
      >
        {active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
        {label}
      </Button>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <h2 className="text-white font-semibold text-sm">Dev Seeder</h2>
        <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">additive only</span>
      </div>
      <p className="text-xs text-gray-600">These actions only create data — nothing is deleted.</p>
      <div className="space-y-2">
        <SeedBtn id="casual" label="Create demo casual game (approved)" onClick={seedCasualGame} />
        <SeedBtn id="notif"  label="Create demo inbox notification"     onClick={seedNotification} />
      </div>
    </div>
  );
}