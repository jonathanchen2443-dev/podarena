import React, { useState } from "react";
import { updatePOD } from "@/components/services/podService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function EditPodModal({ pod, onClose, onUpdated }) {
  const [podName, setPodName] = useState(pod.pod_name || "");
  const [description, setDescription] = useState(pod.description || "");
  const [maxMembers, setMaxMembers] = useState(pod.max_members || 8);
  const [isPublic, setIsPublic] = useState(pod.is_public !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
      toast.success("POD updated!");
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to update POD.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-3xl w-full max-w-lg p-6 pb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Edit POD</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">POD Name *</label>
            <Input value={podName} onChange={(e) => setPodName(e.target.value)} maxLength={60} className="bg-gray-800 border-gray-700 text-white rounded-xl h-10" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] placeholder-gray-600" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Max Members</label>
            <select value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 h-10 text-sm focus:outline-none">
              {[2,3,4,5,6,7,8,10,12,15,20].map((n) => <option key={n} value={n}>{n} members</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm text-white font-medium">Public POD</p>
              <p className="text-xs text-gray-500">Discoverable in Explore</p>
            </div>
            <button type="button" onClick={() => setIsPublic((v) => !v)} className={`w-10 h-6 rounded-full transition-colors ${isPublic ? "bg-[rgb(var(--ds-primary-rgb))]" : "bg-gray-600"} relative`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1 h-10 rounded-xl border-gray-700 text-gray-300">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 h-10 rounded-xl ds-btn-primary">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}