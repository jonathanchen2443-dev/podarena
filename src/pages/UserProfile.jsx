/**
 * UserProfile — public read-only profile page.
 * Shows identity, stats, badges (icon-only), and read-only decks.
 * If the viewer is viewing their own profile, offers a "Go to My Profile" CTA.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/shell/PageStates";
import { useAuth } from "@/components/auth/AuthContext";
import { getPublicProfile, getPublicProfileStats, getPublicProfileDecks } from "@/components/services/profileService.jsx";
import { ROUTES } from "@/components/utils/routes";
import PublicStatRings from "@/components/profile/PublicStatRings";
import PublicBadges from "@/components/profile/PublicBadges";
import PublicDeckGrid from "@/components/profile/PublicDeckGrid";

export default function UserProfile() {
  const navigate = useNavigate();
  const { currentUser, authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [decksLoading, setDecksLoading] = useState(true);
  const [error, setError] = useState(null);

  const userId = new URLSearchParams(window.location.search).get("userId");

  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setError("not_found"); setLoading(false); return; }
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const p = await getPublicProfile(userId);
      setProfile(p);
      setLoading(false);

      // Load stats + decks in parallel after identity resolved
      setStatsLoading(true);
      setDecksLoading(true);

      getPublicProfileStats(p.id)
        .then((s) => setStats(s))
        .catch(() => setStats(null))
        .finally(() => setStatsLoading(false));

      getPublicProfileDecks(p.id)
        .then((d) => setDecks(d))
        .catch(() => setDecks([]))
        .finally(() => setDecksLoading(false));

    } catch (e) {
      setError(e.message || "error");
      setLoading(false);
      setStatsLoading(false);
      setDecksLoading(false);
    }
  }

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate(ROUTES.HOME);
  }

  if (authLoading || loading) return <LoadingState message="Loading profile…" />;

  if (error === "not_found") {
    return (
      <div className="space-y-4">
        <button onClick={goBack} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <ErrorState message="Player not found." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={goBack} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <ErrorState message="Could not load this profile." />
      </div>
    );
  }

  const isOwnProfile = currentUser && currentUser.id === profile.id;

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <p className="text-xs text-gray-600 uppercase tracking-wider font-medium">Player Profile</p>

      {/* Identity card */}
      <Card className="bg-gray-900/60 border-gray-800/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-16 h-16 rounded-2xl object-cover border border-gray-700 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8" style={{ color: "var(--ds-primary-text)" }} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-lg truncate">{profile.display_name}</p>

              {profile.public_user_id && (
                <p className="text-gray-500 text-xs font-mono mt-0.5">
                  <span className="text-gray-600 uppercase tracking-widest text-[9px]">ID </span>
                  {profile.public_user_id}
                </p>
              )}

              {profile.created_date && (
                <div className="flex items-center gap-1.5 mt-1 text-gray-500 text-xs">
                  <Calendar className="w-3 h-3" />
                  <span>Joined {new Date(profile.created_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                </div>
              )}

              {isOwnProfile && (
                <span
                  className="inline-block mt-1.5 text-[10px] ds-accent-bg ds-accent-bd border rounded-full px-2 py-0.5"
                  style={{ color: "var(--ds-primary-text)" }}
                >
                  This is you
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Own profile CTA */}
      {isOwnProfile && (
        <Button
          variant="outline"
          className="w-full border-gray-700 text-gray-300 hover:text-white rounded-xl h-10"
          onClick={() => navigate(ROUTES.PROFILE)}
        >
          Go to My Profile
        </Button>
      )}

      {/* Stats */}
      <PublicStatRings stats={stats} loading={statsLoading} />

      {/* Badges (icon-only) */}
      <PublicBadges stats={stats} />

      {/* Decks */}
      <div className="space-y-3">
        <h2 className="text-white font-semibold text-base px-1">Decks</h2>
        <PublicDeckGrid decks={decks} loading={decksLoading} />
      </div>
    </div>
  );
}