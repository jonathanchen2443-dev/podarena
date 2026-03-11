import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { updatePOD, inviteUserToPOD } from "@/components/services/podService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, AlertCircle } from "lucide-react";
import PlayerSearchInput from "@/components/pods/PlayerSearchInput";
import { toast } from "sonner";

export default function EditPodModal({ pod, onClose, onUpdated }) {
  const { currentUser } = useAuth();
  const [podName, setPodName] = useState(pod.pod_name || "");
  const [description, setDescription] = useState(pod.description || "");
  const [maxMembers, setMaxMembers] = useState(pod.max_members || 8);
  const [isPublic, setIsPublic] = useState(pod.is_public !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [activeMemberProfileIds, setActiveMemberProfileIds] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [toAdd, setToAdd] = useState([]);

  useEffect(() => {
    base44.entities.PODMembership.list("-created_date", 100)
      .then((all) => {
        const active = all.filter((m) => m.pod_id === pod.id && m.membership_status === "active");
        setActiveMemberProfileIds(active.map((m) => m.profile_id).filter(Boolean));
      })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [pod.id]);

  function addPlayer(profile) {
    if (toAdd.find((u) => u.id === profile.id)) return;
    setToAdd((prev) => [...prev, profile]);
  }

  function removeFromAdd(id) {
    setToAdd((prev) => prev.filter((u) => u.id !== id));
  }

  const currentCount = activeMemberProfileIds.length;
  const canAddMore = currentCount + toAdd.length < maxMembers;

  async function handleSave(e) {
    e.preventDefault();
    if (!podName.trim()) { setError("POD name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await updatePOD(pod.id, {
        pod_name: podName.trim(),
        description: description.trim(),
        max_members: maxMembers,
        is_public: isPublic,
      });

      if (toAdd.length > 0) {
        const authUser = await base44.auth.me();
        const updatedPodData = {
          id: pod.id,
          pod_name: podName.trim(),
          pod_code: pod.pod_code,
          description: description.trim(),
        };
        for (const u of toAdd) {
          await inviteUserToPOD(updatedPodData, u, authUser.id, currentUser?.id || null);
        }
      }

      toast.success("POD updated!");
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to update POD.");
    } finally {
      setSaving(false);
    }
  }

  const excludeIds = [
    ...(currentUser ? [currentUser.id] : []),
    ...activeMemberProfileIds,
    ...toAdd.map((u) => u.id),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-t-3xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Fixed header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-800/50 flex-shrink-0">
          <h2 className="text-white font-bold text-lg">Edit POD</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">POD Name *</label>
            <Input
              value={podName}
              onChange={(e) => setPodName(e.target.value)}
              maxLength={60}
              className="bg-gray-800 border-gray-700 text-white rounded-xl h-10"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] placeholder-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Max Members</label>
            <select
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 h-10 text-sm focus:outline-none"
            >
              {[2,3,4,5,6,7,8,10,12,15,20].map((n) => (
                <option key={n} value={n}>{n} members</option>
              ))}
            </select>
          </div>

          {/* Public toggle */}
          <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">Public POD</p>
              <p className="text-xs text-gray-500">Discoverable in Explore</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
              style={{ backgroundColor: isPublic ? "rgb(var(--ds-primary-rgb))" : "#4B5563" }}
            >
              <span
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: isPublic ? "translateX(22px)" : "translateX(4px)" }}
              />
            </button>
          </div>

          {/* Add Players */}
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
              Invite Players <span className="text-gray-600 normal-case">(optional)</span>
            </label>
            {membersLoading ? (
              <div className="py-2 text-gray-500 text-sm">Loading members…</div>
            ) : canAddMore ? (
              <PlayerSearchInput
                excludeProfileIds={excludeIds}
                onSelect={addPlayer}
                placeholder="Search by name or #UserID…"
              />
            ) : (
              <p className="text-xs text-amber-400 py-2">POD is at max capacity ({maxMembers} members).</p>
            )}
            {toAdd.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {toAdd.map((u) => (
                  <div key={u.id} className="flex items-center gap-1.5 bg-gray-800 rounded-full pl-2 pr-1 py-1">
                    <span className="text-white text-xs">{u.display_name}</span>
                    <button
                      type="button"
                      onClick={() => removeFromAdd(u.id)}
                      className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-700"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {toAdd.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">These players will receive a POD invite in their Inbox.</p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Sticky footer — always visible above bottom nav */}
        <div className="flex-shrink-0 border-t border-gray-800/50 px-5 py-4 bg-gray-900">
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 h-11 rounded-xl border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex-1 h-11 rounded-xl ds-btn-primary font-semibold"
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}