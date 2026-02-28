import React, { useState, useEffect } from "react";
import { ToggleLeft, Save, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upsertSettings, invalidateSettingsCache, DEFAULT_FEATURE_FLAGS } from "@/components/services/appSettingsService";
import { toast } from "sonner";

const FLAG_LABELS = {
  enableCasualGames:        "Casual Games",
  enableDeckInsightsModal:  "Deck Insights Modal",
  requireDeckOnApprove:     "Require Deck on Approve",
  enableLeagueInvites:      "League Invites",
  enableLeagueCapacity:     "League Capacity Limits",
  enableInboxNotifications: "Inbox Notifications",
};

export default function FeatureFlagsSection({ settings, onRefresh }) {
  const [flags, setFlags] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFlags({ ...DEFAULT_FEATURE_FLAGS, ...(settings?.feature_flags || {}) });
  }, [settings]);

  function toggle(key) {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      invalidateSettingsCache();
      await upsertSettings({ feature_flags: flags });
      toast.success("Feature flags saved.");
      onRefresh();
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  const allKeys = [...new Set([...Object.keys(DEFAULT_FEATURE_FLAGS), ...Object.keys(flags)])];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-sm">Feature Flags</h2>
      </div>

      <div className="space-y-2">
        {allKeys.map((key) => (
          <div key={key} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-sm text-white">{FLAG_LABELS[key] || key}</p>
              <p className="text-[10px] font-mono text-gray-600">{key}</p>
            </div>
            <button
              onClick={() => toggle(key)}
              className={`relative w-10 h-5.5 rounded-full transition-colors flex items-center px-0.5 ${
                flags[key] ? "bg-violet-600" : "bg-gray-700"
              }`}
              style={{ height: "22px", minWidth: "40px" }}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  flags[key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        className="w-full bg-violet-600 hover:bg-violet-700 rounded-xl"
        onClick={handleSave}
        disabled={saving}
      >
        <Save className="w-3.5 h-3.5 mr-1.5" />
        Save Flags
      </Button>
    </div>
  );
}