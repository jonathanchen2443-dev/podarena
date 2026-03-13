import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPOD, inviteUserToPOD } from "@/components/services/podService";
import { ArrowLeft, Layers, X, AlertCircle } from "lucide-react";
import PlayerSearchInput from "@/components/pods/PlayerSearchInput";
import { toast } from "sonner";

export default function CreatePod() {
  const { currentUser, authUserId, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [podName, setPodName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(4);
  const [isPublic, setIsPublic] = useState(true);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
        <AlertCircle className="w-10 h-10 text-red-400/70" />
        <p className="text-gray-400 text-sm">You must be signed in to create a POD.</p>
      </div>
    );
  }

  function addInvite(profile) {
    if (invitedUsers.find((u) => u.id === profile.id)) return;
    setInvitedUsers((prev) => [...prev, profile]);
  }

  function removeInvite(id) {
    setInvitedUsers((prev) => prev.filter((u) => u.id !== id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!podName.trim()) { setError("POD name is required."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const pod = await createPOD({
        podName: podName.trim(),
        description: description.trim(),
        maxMembers,
        isPublic,
        creatorProfileId: currentUser.id,  // Profile ID for display/joins
        creatorAuthUserId: authUserId,      // Auth User ID for RLS fields
      });

      // Invite selected users: creates PODMembership + Notification in one call
      for (const u of invitedUsers) {
        await inviteUserToPOD(
          { id: pod.id, pod_name: pod.pod_name, pod_code: pod.pod_code, description: pod.description || "" },
          u,
          authUserId,       // inviter Auth User ID
          currentUser.id    // inviter Profile ID
        );
      }

      toast.success(`POD "${pod.pod_name}" created! PODID: ${pod.pod_code}`);
      navigate(`${createPageUrl("Pod")}?podId=${pod.id}`);
    } catch (err) {
      setError(err.message || "Failed to create POD.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(createPageUrl("MyPods"))} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Create New POD</h1>
          <p className="text-xs text-gray-500">PODID will be generated automatically</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* POD Name */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">POD Name *</label>
          <Input value={podName} onChange={(e) => setPodName(e.target.value)} placeholder="e.g. The Wednesday Crew" maxLength={60} className="bg-gray-900 border-gray-700 text-white rounded-xl h-10" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Description <span className="text-gray-600 normal-case">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Describe your playgroup…"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] placeholder-gray-600"
          />
        </div>

        {/* Max Members + Visibility row */}
        <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-4 space-y-4">
          {/* Max Members slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Max Members</label>
              <span className="text-sm font-semibold text-white">{maxMembers} members</span>
            </div>
            <input
              type="range"
              min={2}
              max={6}
              step={1}
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "rgb(var(--ds-primary-rgb))" }}
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              {[2,3,4,5,6].map((n) => <span key={n}>{n}</span>)}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800/50" />

          {/* Public / Private toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white font-medium">{isPublic ? "Public POD" : "Private POD"}</p>
              <p className="text-xs text-gray-500">{isPublic ? "Discoverable in Explore. Joining requires approval." : "Not listed publicly. Invite only."}</p>
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
        </div>

        {/* Invite Users */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Invite Players <span className="text-gray-600 normal-case">(optional)</span></label>
          <PlayerSearchInput
            excludeProfileIds={[currentUser.id, ...invitedUsers.map((u) => u.id)]}
            onSelect={addInvite}
            placeholder="Search by name or #UserID…"
          />
          {invitedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {invitedUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-1.5 bg-gray-800 rounded-full pl-2 pr-1 py-1">
                  <span className="text-white text-xs">{u.display_name}</span>
                  <button type="button" onClick={() => removeInvite(u.id)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-700">
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={submitting || !podName.trim()} className="w-full ds-btn-primary h-11 rounded-xl text-sm font-semibold">
          {submitting ? "Creating POD…" : "Create POD"}
        </Button>
      </form>
    </div>
  );
}