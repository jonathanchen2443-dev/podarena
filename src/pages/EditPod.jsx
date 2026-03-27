import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { updatePOD, inviteUserToPOD } from "@/components/services/podService";
import { ROUTES } from "@/components/utils/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, AlertCircle } from "lucide-react";
import PlayerSearchInput from "@/components/pods/PlayerSearchInput";
import { toast } from "sonner";

export default function EditPod() {
  const { currentUser, authUserId, isGuest, authLoading } = useAuth();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const podId = params.get("podId");

  const [pod, setPod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Editable fields
  const [podName, setPodName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(4);
  const [isPublic, setIsPublic] = useState(true);

  // Initial snapshot for dirty detection
  const [initial, setInitial] = useState(null);

  // Invite players
  const [activeMemberProfileIds, setActiveMemberProfileIds] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [toAdd, setToAdd] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load POD data and verify admin access
  useEffect(() => {
    if (authLoading) return;
    if (!podId) { setLoadError("no_pod"); setLoading(false); return; }
    if (isGuest) { setLoadError("forbidden"); setLoading(false); return; }

    async function load() {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('publicProfiles', {
          action: 'podPageData',
          podId,
          callerAuthUserId: authUserId || null,
          callerProfileId: currentUser?.id || null,
        });
        const data = res.data || {};
        if (data.notFound || data.error) { setLoadError("not_found"); return; }
        if (data.forbidden) { setLoadError("forbidden"); return; }
        if (!data.isAdmin) { setLoadError("forbidden"); return; }

        const p = data.pod;
        setPod(p);

        const snap = {
          pod_name: p.pod_name || "",
          description: p.description || "",
          max_members: Math.min(20, Math.max(2, p.max_members || 4)),
          is_public: p.is_public !== false,
        };
        setInitial(snap);
        setPodName(snap.pod_name);
        setDescription(snap.description);
        setMaxMembers(snap.max_members);
        setIsPublic(snap.is_public);
      } catch (e) {
        setLoadError("error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, podId, authUserId, currentUser?.id, isGuest]);

  // Load active members for invite section
  useEffect(() => {
    if (!podId || !currentUser?.id) return;
    base44.entities.PODMembership.list("-created_date", 100)
      .then((all) => {
        const active = all.filter((m) => m.pod_id === podId && m.membership_status === "active");
        setActiveMemberProfileIds(active.map((m) => m.profile_id).filter(Boolean));
      })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [podId, currentUser?.id]);

  const isDirty = initial && (
    podName.trim() !== initial.pod_name ||
    description.trim() !== initial.description ||
    maxMembers !== initial.max_members ||
    isPublic !== initial.is_public
  );

  const canSave = isDirty || toAdd.length > 0;

  function goBackToPod() {
    if (podId) {
      navigate(`${ROUTES.POD(podId)}&tab=info`);
    } else {
      navigate(ROUTES.MY_PODS);
    }
  }

  async function handleSave() {
    if (!podName.trim()) { setError("POD name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await updatePOD(podId, {
        pod_name: podName.trim(),
        description: description.trim(),
        max_members: maxMembers,
        is_public: isPublic,
      });

      if (toAdd.length > 0) {
        const updatedPodData = {
          id: podId,
          pod_name: podName.trim(),
          pod_code: pod.pod_code,
          description: description.trim(),
        };
        for (const u of toAdd) {
          await inviteUserToPOD(updatedPodData, u, authUserId, currentUser?.id || null);
        }
      }

      toast.success("POD updated!");
      goBackToPod();
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
  const currentCount = activeMemberProfileIds.length;
  const canAddMore = currentCount + toAdd.length < maxMembers;

  // ── Loading / error states ────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError === "forbidden") {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <h2 className="text-white font-semibold text-lg">Access Denied</h2>
        <p className="text-gray-400 text-sm">Only POD admins can edit this POD.</p>
        <Button onClick={goBackToPod} variant="outline" className="gap-2 text-sm border-gray-700 text-gray-300">
          <ArrowLeft className="w-4 h-4" /> Back to POD
        </Button>
      </div>
    );
  }

  if (loadError || !pod) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center px-6">
        <p className="text-gray-400 text-sm">Could not load POD. Please try again.</p>
        <Button onClick={goBackToPod} variant="outline" className="gap-2 text-sm border-gray-700 text-gray-300">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>
    );
  }

  // ── Edit screen ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBackToPod}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-white font-bold text-lg">Edit POD</h1>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* POD Name */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">POD Name *</label>
          <Input
            value={podName}
            onChange={(e) => setPodName(e.target.value)}
            maxLength={60}
            className="bg-gray-800 border-gray-700 text-white rounded-xl h-10"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={300}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] placeholder-gray-600"
          />
        </div>

        {/* Max Members + Privacy */}
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 space-y-4">
          {/* Max Members slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Max Members</label>
              <span className="text-sm font-semibold text-white">{maxMembers} members</span>
            </div>
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "rgb(var(--ds-primary-rgb))" }}
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>2</span>
              <span>20</span>
            </div>
          </div>

          <div className="border-t border-gray-700/50" />

          {/* Private POD checkbox */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!isPublic}
                onChange={(e) => setIsPublic(!e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 cursor-pointer"
                style={{ accentColor: "rgb(var(--ds-primary-rgb))" }}
              />
              <span className="text-sm text-white font-medium">Private POD</span>
            </label>
            <p className="text-xs text-gray-500 mt-1.5 ml-7">
              Private PODs can only be joined via invite link. They do not show a request to join button.
            </p>
          </div>
        </div>

        {/* Invite Players */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
            Invite Players <span className="text-gray-600 normal-case">(optional)</span>
          </label>
          {membersLoading ? (
            <div className="py-2 text-gray-500 text-sm">Loading members…</div>
          ) : canAddMore ? (
            <PlayerSearchInput
              excludeProfileIds={excludeIds}
              onSelect={(profile) => {
                if (!toAdd.find((u) => u.id === profile.id)) {
                  setToAdd((prev) => [...prev, profile]);
                }
              }}
              placeholder="Search by name or #UserID…"
            />
          ) : (
            <p className="text-xs text-amber-400 py-2">POD is at max capacity ({maxMembers} members).</p>
          )}
          {toAdd.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {toAdd.map((u) => (
                <div key={u.id} className="flex items-center gap-1.5 bg-gray-800 rounded-full pl-3 pr-1 py-1">
                  <span className="text-white text-xs">{u.display_name}</span>
                  <button
                    type="button"
                    onClick={() => setToAdd((prev) => prev.filter((x) => x.id !== u.id))}
                    className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-700 text-gray-400"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {toAdd.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">These players will receive a POD invite in their Inbox.</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            onClick={goBackToPod}
            variant="outline"
            className="flex-1 h-11 rounded-xl border-gray-700 text-gray-300 hover:bg-gray-800 text-sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || !canSave}
            onClick={handleSave}
            variant="outline"
            className="flex-1 h-11 rounded-xl border-gray-700 text-gray-300 hover:bg-gray-800 text-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}