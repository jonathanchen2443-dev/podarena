import React, { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, RotateCcw, Save, Navigation, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upsertSettings, invalidateSettingsCache, DEFAULT_NAV_CONFIG } from "@/components/services/appSettingsService";
import { toast } from "sonner";

// All available screens that can be added to the bottom nav
const ALL_AVAILABLE_SCREENS = [
  { key: "home",       label: "Home",       icon: "Home",        routeKey: "HOME" },
  { key: "pods",       label: "PODS",       icon: "Network",     routeKey: "PODS" },
  { key: "logGame",    label: "Log Game",   icon: "PlusCircle",  routeKey: "LOG_GAME" },
  { key: "inbox",      label: "Inbox",      icon: "Bell",        routeKey: "INBOX" },
  { key: "profile",    label: "Profile",    icon: "User",        routeKey: "PROFILE" },
  { key: "dashboard",  label: "Dashboard",  icon: "BarChart2",   routeKey: "DASHBOARD" },
  { key: "mypods",     label: "My PODs",    icon: "Layers",      routeKey: "MY_PODS" },
  { key: "explorepods",label: "Explore",    icon: "Compass",     routeKey: "EXPLORE_PODS" },
];

const MAX_NAV_ITEMS = 5;

export default function NavBuilderSection({ settings, onRefresh }) {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState("");

  useEffect(() => {
    const cfg = settings?.bottom_nav_config;
    setItems(cfg && cfg.length > 0 ? cfg : DEFAULT_NAV_CONFIG);
  }, [settings]);

  const currentKeys = new Set(items.map((i) => i.key));
  const availableToAdd = ALL_AVAILABLE_SCREENS.filter((s) => !currentKeys.has(s.key));
  const atLimit = items.length >= MAX_NAV_ITEMS;

  function move(idx, dir) {
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setItems(next);
  }

  function remove(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAdd() {
    if (!selectedToAdd || atLimit) return;
    const screen = ALL_AVAILABLE_SCREENS.find((s) => s.key === selectedToAdd);
    if (!screen || currentKeys.has(screen.key)) return;
    setItems((prev) => [...prev, { ...screen, enabled: true }]);
    setSelectedToAdd("");
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
        <Navigation className="w-4 h-4" style={{ color: "var(--ds-primary-text)" }} />
        <h2 className="text-white font-semibold text-sm">Navigation Builder</h2>
        <span className="ml-auto text-xs text-gray-500">{items.length}/{MAX_NAV_ITEMS} slots</span>
      </div>

      {/* Current nav items */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.key} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-gray-600 hover:text-gray-300 disabled:opacity-20">
                <ArrowUp className="w-3 h-3" />
              </button>
              <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="text-gray-600 hover:text-gray-300 disabled:opacity-20">
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
            <span className="flex-1 text-sm text-white">{item.label}</span>
            <span className="text-xs font-mono text-gray-600">{item.icon}</span>
            <button
              onClick={() => remove(idx)}
              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remove from nav"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add screen row */}
      <div className="space-y-2">
        {atLimit ? (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
            Navigation is full ({MAX_NAV_ITEMS} screens max). Remove one to add another.
          </p>
        ) : availableToAdd.length === 0 ? (
          <p className="text-xs text-gray-500">All available screens are already in the nav.</p>
        ) : (
          <div className="flex gap-2">
            <select
              value={selectedToAdd}
              onChange={(e) => setSelectedToAdd(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 h-9 text-sm focus:outline-none"
            >
              <option value="">Select screen to add…</option>
              {availableToAdd.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!selectedToAdd}
              className="ds-btn-primary rounded-xl h-9 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="border-gray-700 text-gray-400 hover:bg-gray-800 rounded-xl" onClick={handleReset} disabled={saving}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Reset
        </Button>
        <Button size="sm" className="flex-1 ds-btn-primary rounded-xl" onClick={handleSave} disabled={saving}>
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Save Navigation
        </Button>
      </div>
    </div>
  );
}