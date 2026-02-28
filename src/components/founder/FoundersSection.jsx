import React, { useState } from "react";
import { Plus, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addFounder, removeFounder } from "@/components/services/founderService";
import { toast } from "sonner";

export default function FoundersSection({ settings, auth, onRefresh }) {
  const [newId, setNewId] = useState("");
  const [loading, setLoading] = useState(null);

  const founders = settings?.founder_user_ids || [];

  async function handleAdd() {
    if (!newId.trim()) return;
    setLoading("add");
    try {
      await addFounder(auth, newId.trim());
      toast.success("Founder added.");
      setNewId("");
      onRefresh();
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(null); }
  }

  async function handleRemove(uid) {
    setLoading(uid);
    try {
      await removeFounder(auth, uid);
      toast.success("Founder removed.");
      onRefresh();
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(null); }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-sm">Founders</h2>
        <span className="text-xs text-gray-600">({founders.length})</span>
      </div>

      <div className="space-y-2">
        {founders.map((uid) => (
          <div key={uid} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2.5">
            <span className="flex-1 text-xs font-mono text-gray-300 truncate">{uid}</span>
            {uid === auth.currentUser?.id && (
              <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">you</span>
            )}
            <button
              onClick={() => handleRemove(uid)}
              disabled={loading === uid || founders.length <= 1}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="User ID to add as founder…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button
          size="sm"
          className="bg-violet-600 hover:bg-violet-700 rounded-xl"
          onClick={handleAdd}
          disabled={loading === "add" || !newId.trim()}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}