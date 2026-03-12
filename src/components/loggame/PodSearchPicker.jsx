import React, { useState, useEffect } from "react";
import { Search, Layers } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * PodSearchPicker — lets the user search their active PODs by name or PODID.
 * Used in LogGame free-POD mode (not locked mode).
 *
 * Props:
 *   authUserId  - Auth User ID (needed to filter user's memberships)
 *   onSelect(pod) - called when user picks a POD
 */
export default function PodSearchPicker({ authUserId, onSelect }) {
  const [myPods, setMyPods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!authUserId) return;
    setLoading(true);
    async function load() {
      const memberships = await base44.entities.PODMembership.filter({
        user_id: authUserId,
        membership_status: "active",
      }).catch(() => []);
      const podIds = memberships.map((m) => m.pod_id);
      if (podIds.length === 0) { setLoading(false); return; }
      const pods = await Promise.all(
        podIds.map((id) => base44.entities.POD.get(id).catch(() => null))
      );
      setMyPods(pods.filter(Boolean).filter((p) => p.status === "active"));
      setLoading(false);
    }
    load();
  }, [authUserId]);

  const q = query.trim().toLowerCase();
  const filtered = myPods.filter(
    (p) =>
      !q ||
      p.pod_name?.toLowerCase().includes(q) ||
      p.pod_code?.toLowerCase().includes(q)
  );

  return (
    <div>
      <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
        Select POD <span className="text-red-400">*</span>
      </label>
      <div className="relative mb-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by POD name or PODID…"
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))]"
        />
      </div>

      {!authUserId || loading ? (
        <p className="text-xs text-gray-500 py-2">Loading your PODs…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-500 py-2">
          {q ? "No PODs found." : "You are not an active member of any POD."}
        </p>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map((pod) => (
            <button
              key={pod.id}
              type="button"
              onClick={() => onSelect(pod)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left"
            >
              <Layers className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">{pod.pod_name}</p>
                <p className="text-xs font-mono text-gray-500">{pod.pod_code}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}