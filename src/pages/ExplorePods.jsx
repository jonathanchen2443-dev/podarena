import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Search, ArrowLeft, Users, Zap, Lock, ChevronRight } from "lucide-react";

function ExplorePodCard({ pod, activeMemberCount, onClick }) {
  const hasOpenSpots = pod.max_members > activeMemberCount;

  return (
    <div
      className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4 flex gap-3 cursor-pointer hover:border-gray-700/50 transition-all"
      onClick={onClick}
    >
      {pod.image_url ? (
        <img src={pod.image_url} alt={pod.pod_name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-xl ds-accent-bg ds-accent-bd border flex items-center justify-center flex-shrink-0">
          <Layers className="w-6 h-6" style={{ color: "var(--ds-primary-text)" }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-white font-semibold text-sm">{pod.pod_name}</p>
            <p className="text-gray-500 text-xs font-mono">{pod.pod_code}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
        </div>
        {pod.description && (
          <p className="text-gray-400 text-xs mt-1 line-clamp-2">{pod.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="flex items-center gap-1 text-xs bg-gray-800 text-gray-400 rounded-full px-2 py-0.5">
            <Users className="w-3 h-3" />
            {activeMemberCount}/{pod.max_members}
          </span>
          {hasOpenSpots && (
            <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2 py-0.5">
              <Zap className="w-3 h-3" />
              Open spots
            </span>
          )}
          <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
            <Lock className="w-3 h-3" />
            Approval required
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ExplorePods() {
  const { currentUser, authUserId, isGuest, authLoading } = useAuth();
  const navigate = useNavigate();
  const [pods, setPods] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOpenSpots, setFilterOpenSpots] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('publicProfiles', {
        action: 'explorePublicPods',
        callerAuthUserId: authUserId || null,
      });
      const pods = res.data?.pods || [];
      const counts = Object.fromEntries(pods.map((p) => [p.id, p.activeMemberCount]));
      setMemberCounts(counts);
      setPods(pods);
    } finally {
      setLoading(false);
    }
  }, [authUserId]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  function openPod(podId) { navigate(`${createPageUrl("Pod")}?podId=${podId}`); }

  const filtered = pods.filter((p) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!p.pod_name.toLowerCase().includes(q) && !p.pod_code.toLowerCase().includes(q)) return false;
    }
    if (filterOpenSpots && (memberCounts[p.id] || 0) >= p.max_members) return false;
    return true;
  });

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(createPageUrl("MyPods"))} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold text-white">Explore PODS</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or PODID…" className="pl-9 bg-gray-900 border-gray-700 text-white placeholder-gray-600 rounded-xl h-10" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterOpenSpots((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterOpenSpots ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800"}`}
        >
          <Zap className="w-3 h-3" />
          Open spots
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <Layers className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No public PODS found</p>
          <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pod) => (
            <ExplorePodCard key={pod.id} pod={pod} activeMemberCount={memberCounts[pod.id] || 0} onClick={() => openPod(pod.id)} />
          ))}
        </div>
      )}
    </div>
  );
}