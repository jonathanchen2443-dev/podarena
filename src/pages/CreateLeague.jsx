import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { useAuth } from "@/components/auth/AuthContext";
import { createLeague } from "@/components/services/leagueService";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Lock, Loader2, LogIn } from "lucide-react";

// ── Guest gate ────────────────────────────────────────────────────────────────
function GuestGate() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center px-4">
      <div className="w-14 h-14 rounded-2xl ds-accent-bg ds-accent-bd border flex items-center justify-center">
        <Lock className="w-6 h-6" style={{ color: "var(--ds-primary-text)" }} />
      </div>
      <div>
        <h2 className="text-white font-semibold text-lg">Sign in to create a league</h2>
        <p className="text-gray-400 text-sm mt-1">
          Sign in to create a league and invite players.
        </p>
      </div>
      <Button
        className="bg-violet-600 hover:bg-violet-700 text-white h-11 rounded-xl px-8"
        onClick={() => base44.auth.redirectToLogin(ROUTES.CREATE_LEAGUE)}
      >
        <LogIn className="w-4 h-4 mr-2" />
        Sign In
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreateLeague() {
  const auth = useAuth();
  const { isGuest, authLoading } = auth;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState(10);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef(false);

  if (authLoading) return null;
  if (isGuest) return <GuestGate />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitRef.current) return; // prevent double submit
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) { setError("League name is required."); return; }
    if (trimmed.length > 100) { setError("League name is too long (max 100 characters)."); return; }

    submitRef.current = true;
    setSubmitting(true);
    try {
      const { league } = await createLeague(auth, {
        name: trimmed,
        description,
        is_public: isPublic,
        max_members: maxMembers,
      });
      toast.success("League created!");
      navigate(ROUTES.LEAGUE_DETAILS(league.id) + "&tab=info");
    } catch (err) {
      const msg = err.message || "";
      const isRate = msg.toLowerCase().includes("rate") || msg.includes("429");
      setError(isRate
        ? "Too many requests right now. Please wait a few seconds and try again."
        : msg || "Failed to create league. Please try again.");
      submitRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 py-2">
      <div>
        <h1 className="text-xl font-bold text-white">Create a League</h1>
        <p className="text-gray-400 text-sm mt-0.5">Set up a new league for your playgroup.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="block text-xs text-gray-400 font-medium">
            League Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Friday Night Commander"
            maxLength={100}
            className="w-full h-11 bg-gray-900 border border-gray-700 rounded-xl px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs text-gray-400 font-medium">Description <span className="text-gray-600">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this league about?"
            rows={3}
            maxLength={500}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
          />
        </div>

        {/* Visibility */}
        <div className="space-y-1.5">
          <label className="block text-xs text-gray-400 font-medium">Visibility</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`flex items-center gap-2 h-11 px-4 rounded-xl border text-sm font-medium transition-colors ${
                isPublic
                  ? "border-violet-500 bg-violet-500/10 text-violet-300"
                  : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
              }`}
            >
              <Globe className="w-4 h-4" />
              Public
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`flex items-center gap-2 h-11 px-4 rounded-xl border text-sm font-medium transition-colors ${
                !isPublic
                  ? "border-violet-500 bg-violet-500/10 text-violet-300"
                  : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
              }`}
            >
              <Lock className="w-4 h-4" />
              Private
            </button>
          </div>
          <p className="text-xs text-gray-600">
            {isPublic ? "Anyone can browse and view this league." : "Only invited members can see this league."}
          </p>
        </div>

        {/* Max members */}
        <div className="space-y-1.5">
          <label className="block text-xs text-gray-400 font-medium">
            Max members <span className="text-gray-600">(2–10)</span>
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={2}
              max={10}
              step={1}
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="flex-1 accent-violet-500"
            />
            <span className="text-white font-semibold text-sm w-6 text-center">{maxMembers}</span>
          </div>
          <p className="text-xs text-gray-600">League will stop accepting new members when full.</p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create League"}
        </Button>
      </form>
    </div>
  );
}