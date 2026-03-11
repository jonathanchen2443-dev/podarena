import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { ROUTES } from "@/components/utils/routes";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Plus, Search, Star, Users, ChevronRight, Compass, List, Mail } from "lucide-react";
import { toggleFavorite } from "@/components/services/podService";
import { toast } from "sonner";

function PodCard({ pod, membership, onFavoriteToggle, onClick }) {
  const [toggling, setToggling] = useState(false);

  async function handleFavorite(e) {
    e.stopPropagation();
    if (!membership) return;
    setToggling(true);
    try {
      await onFavoriteToggle(membership.id, membership.is_favorite);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 last:border-0 cursor-pointer hover:bg-gray-800/30 transition-colors"
      onClick={onClick}
    >
      {pod.image_url ? (
        <img src={pod.image_url} alt={pod.pod_name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-xl ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
          <Layers className="w-5 h-5" style={{ color: "var(--ds-primary-text)" }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">{pod.pod_name}</p>
        <p className="text-gray-500 text-xs font-mono">{pod.pod_code}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleFavorite}
          disabled={toggling}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-700/50"
        >
          <Star
            className="w-4 h-4 transition-colors"
            style={membership?.is_favorite ? { color: "#F59E0B", fill: "#F59E0B" } : { color: "#6B7280" }}
          />
        </button>
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </div>
    </div>
  );
}

export default function MyPods() {
  const { currentUser, isAuthenticated, authLoading, isGuest } = useAuth();
  const navigate = useNavigate();
  const [pods, setPods] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const authUser = await base44.auth.me().catch(() => null);
      if (!authUser?.id) return;
      const myMemberships = await base44.entities.PODMembership.filter({
        user_id: authUser.id,
        membership_status: "active",
      });
      if (myMemberships.length === 0) { setPods([]); setMemberships([]); return; }
      const podIds = [...new Set(myMemberships.map((m) => m.pod_id))];
      const podResults = await Promise.all(
        podIds.map((id) => base44.entities.POD.get(id).catch(() => null))
      );
      const validPods = podResults.filter(Boolean).filter((p) => p.status === "active");
      setPods(validPods);
      setMemberships(myMemberships);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!authLoading && !isGuest) load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, isGuest, load]);

  async function handleFavoriteToggle(membershipId, currentValue) {
    await toggleFavorite(membershipId, currentValue);
    setMemberships((prev) => prev.map((m) => m.id === membershipId ? { ...m, is_favorite: !currentValue } : m));
  }

  function getMembership(podId) {
    return memberships.find((m) => m.pod_id === podId);
  }

  function openPod(podId) {
    navigate(`${createPageUrl("Pod")}?podId=${podId}`);
  }

  const filtered = pods.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.pod_name.toLowerCase().includes(q) || p.pod_code.toLowerCase().includes(q);
  });

  // Sort: favorites first, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    const af = getMembership(a.id)?.is_favorite ? 1 : 0;
    const bf = getMembership(b.id)?.is_favorite ? 1 : 0;
    if (bf !== af) return bf - af;
    return a.pod_name.localeCompare(b.pod_name);
  });

  // Show at most 5
  const displayed = sorted.slice(0, 5);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isGuest || !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
        <Layers className="w-12 h-12 text-gray-600" />
        <p className="text-gray-400 text-sm">Sign in to view your PODS.</p>
        <Button className="ds-btn-primary rounded-xl" onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">My PODS</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or PODID…"
          className="pl-9 bg-gray-900 border-gray-700 text-white placeholder-gray-600 rounded-xl h-10"
        />
      </div>

      {/* POD Cards */}
      {displayed.length === 0 ? (
        <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl px-4 py-10 text-center">
          <Layers className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No PODS yet</p>
          <p className="text-gray-600 text-xs mt-1">Create your first POD or explore public ones.</p>
        </div>
      ) : (
        <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl overflow-hidden">
          {displayed.map((pod) => (
            <PodCard
              key={pod.id}
              pod={pod}
              membership={getMembership(pod.id)}
              onFavoriteToggle={handleFavoriteToggle}
              onClick={() => openPod(pod.id)}
            />
          ))}
          {sorted.length > 5 && (
            <div className="px-4 py-2 text-center">
              <span className="text-xs text-gray-500">+{sorted.length - 5} more — see All My PODS</span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2 pt-1">
        <Button
          className="w-full ds-btn-primary h-11 rounded-xl text-sm font-semibold flex items-center gap-2"
          onClick={() => navigate(createPageUrl("CreatePod"))}
        >
          <Plus className="w-4 h-4" />
          Create a New POD
        </Button>
        <Button
          variant="outline"
          className="w-full h-11 rounded-xl text-sm border-gray-700 text-gray-300 hover:bg-gray-800 flex items-center gap-2"
          onClick={() => navigate(createPageUrl("AllPods"))}
        >
          <List className="w-4 h-4" />
          All My PODS
        </Button>
        <Button
          variant="outline"
          className="w-full h-11 rounded-xl text-sm border-gray-700 text-gray-300 hover:bg-gray-800 flex items-center gap-2"
          onClick={() => navigate(createPageUrl("ExplorePods"))}
        >
          <Compass className="w-4 h-4" />
          Explore PODS
        </Button>
      </div>
    </div>
  );
}