import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthContext";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPOD } from "@/components/services/podService";
import { ArrowLeft, Layers, Search, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function CreatePod() {
  const { currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [podName, setPodName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(8);
  const [isPublic, setIsPublic] = useState(true);
  const [inviteSearch, setInviteSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [searching, setSearching] = useState(false);
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

  async function handleSearch(q) {
    setInviteSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await base44.entities.Profile.filter({ display_name_lc: q.toLowerCase() }, "-created_date", 10);
      const filtered = results.filter(
        (p) => p.id !== currentUser.id && !invitedUsers.find((u) => u.id === p.id)
      );
      setSearchResults(filtered.slice(0, 5));
    } finally {
      setSearching(false);
    }
  }

  function addInvite(profile) {
    setInvitedUsers((prev) => [...prev, profile]);
    setInviteSearch("");
    setSearchResults([]);
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
      const authUser = await base44.auth.me();
      const pod = await createPOD({
        podName: podName.trim(),
        description: description.trim(),
        maxMembers,
        isPublic,
        creatorProfileId: currentUser.id,
        creatorAuthUserId: authUser.id,
      });

      // Create invited_pending memberships for selected users
      for (const u of invitedUsers) {
        try {
          await base44.entities.PODMembership.create({
            pod_id: pod.id,
            user_id: u.user_id || "",
            profile_id: u.id,
            role: "member",
            membership_status: "invited_pending",
            source: "invite",
            invited_at: new Date().toISOString(),
            invited_by_user_id: authUser.id,
            invited_by_profile_id: currentUser.id,
            is_favorite: false,
          });
        } catch (_) {}
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

        {/* Max Members */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Max Members</label>
          <select
            value={maxMembers}
            onChange={(e) => setMaxMembers(Number(e.target.value))}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))]"
          >
            {[2,3,4,5,6,7,8,10,12,15,20].map((n) => (
              <option key={n} value={n}>{n} members</option>
            ))}
          </select>
        </div>

        {/* Visibility */}
        <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800/50 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm text-white font-medium">Public POD</p>
            <p className="text-xs text-gray-500">Discoverable in Explore. Joining still requires your approval.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublic((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors ${isPublic ? "bg-[rgb(var(--ds-primary-rgb))]" : "bg-gray-700"} relative`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Invite Users */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Invite Players <span className="text-gray-600 normal-case">(optional)</span></label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <Input
              value={inviteSearch}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by display name…"
              className="pl-9 bg-gray-900 border-gray-700 text-white rounded-xl h-10"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              {searchResults.map((p) => (
                <button key={p.id} type="button" onClick={() => addInvite(p)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left">
                  {p.avatar_url ? <img src={p.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" /> : <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">{(p.display_name || "?")[0]}</div>}
                  <div>
                    <p className="text-white text-sm">{p.display_name}</p>
                    {p.public_user_id && <p className="text-gray-500 text-xs">#{p.public_user_id}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
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