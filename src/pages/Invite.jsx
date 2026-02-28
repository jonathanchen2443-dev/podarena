import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Invite() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) { setError("No invite token provided."); return; }
    resolveInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function resolveInvite() {
    try {
      const results = await base44.entities.LeagueInvite.filter({ token, is_active: true });
      const invite = results[0];
      if (!invite) { setError("This invite link is invalid or expired."); return; }
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setError("This invite link is invalid or expired.");
        return;
      }
      // Redirect to full league URL with invite param (replace so back works cleanly)
      navigate(`${ROUTES.LEAGUE_DETAILS(invite.league_id)}&invite=${token}`, { replace: true });
    } catch (e) {
      setError("Failed to validate invite link. Please try again.");
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">Invite invalid</h2>
          <p className="text-gray-400 text-sm mt-1">{error}</p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-11 px-6"
          onClick={() => navigate(ROUTES.LEAGUES, { replace: true })}
        >
          Browse Leagues
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading invite…</span>
      </div>
    </div>
  );
}