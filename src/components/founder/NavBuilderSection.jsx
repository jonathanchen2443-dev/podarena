import React, { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, RotateCcw, Save, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upsertSettings, invalidateSettingsCache, DEFAULT_NAV_CONFIG } from "@/components/services/appSettingsService";
import { toast } from "sonner";

export default function NavBuilderSection({ settings, onRefresh }) {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cfg = settings?.bottom_nav_config;
    setItems(cfg && cfg.length > 0 ? cfg : DEFAULT_NAV_CONFIG);
  }, [settings]);

  function move(idx, dir) {
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setItems(next);
  }

  function toggle(idx) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, enabled: !item.enabled } : item));
  }

  async function handleSave() {
    setSaving(true);
    try {
      invalidateSettingsCache();
      await upsertSettings({ bottom_nav_config: items });
      toast.success("Navigation saved.");
      onRefresh();
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  async function handleReset() {
    setSaving(true);
    try {
      invalidateSettingsCache();
      await upsertSettings({ bottom_nav_config: DEFAULT_NAV_CONFIG });
      setItems(DEFAULT_NAV_CONFIG);
      toast.success("Navigation reset to defaults.");
      onRefresh();
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Navigation className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-sm">Navigation Builder</h2>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.key} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="text-gray-600 hover:text-gray-300 disabled:opacity-20"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => move(idx, 1)}
                disabled={idx === items.length - 1}
                className="text-gray-600 hover:text-gray-300 disabled:opacity-20"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
            <span className="flex-1 text-sm text-white">{item.label}</span>
            <span className="text-xs font-mono text-gray-600">{item.icon}</span>
            <button
              onClick={() => toggle(idx)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                item.enabled
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-gray-700 text-gray-500 hover:bg-gray-600 hover:text-gray-300"
              }`}
            >
              {item.enabled ? "On" : "Off"}
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-400 hover:bg-gray-800 rounded-xl"
          onClick={handleReset}
          disabled={saving}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Reset
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-violet-600 hover:bg-violet-700 rounded-xl"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Save Navigation
        </Button>
      </div>
    </div>
  );
}