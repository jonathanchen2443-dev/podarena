/**
 * DeckLinkSourcesSection — Founder-only management of approved deck-link hosts.
 *
 * Allows founders to:
 *  - view current approved sources (baseline + founder-managed)
 *  - add a new host manually or extract it from a sample URL
 *  - enable / disable managed entries
 *
 * Baseline hosts are shown as read-only (always enabled).
 * Founder-managed hosts are stored in AppSettings.approved_deck_link_hosts.
 */
import React, { useState, useEffect } from "react";
import { Globe, Plus, Trash2, ToggleLeft, ToggleRight, Link as LinkIcon, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BASELINE_DECK_LINK_HOSTS, extractHost } from "@/components/services/deckLinkService";
import { getSettings, upsertSettings, invalidateSettingsCache } from "@/components/services/appSettingsService";

// Deduplicate baseline for display — only bare domain, no www. duplicates
const BASELINE_DISPLAY = [...new Set(
  BASELINE_DECK_LINK_HOSTS.map((h) => h.replace(/^www\./, ""))
)].sort();

export default function DeckLinkSourcesSection() {
  const [managedEntries, setManagedEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add-new form state
  const [newHost, setNewHost] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [sampleUrl, setSampleUrl] = useState("");
  const [extractedHost, setExtractedHost] = useState(null);
  const [addError, setAddError] = useState("");

  useEffect(() => { loadEntries(); }, []);

  async function loadEntries() {
    setLoading(true);
    try {
      const s = await getSettings();
      setManagedEntries(s?.approved_deck_link_hosts || []);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntries(entries) {
    setSaving(true);
    try {
      invalidateSettingsCache();
      await upsertSettings({ approved_deck_link_hosts: entries });
      setManagedEntries(entries);
    } finally {
      setSaving(false);
    }
  }

  // Extract host from sample URL (convenience only — does NOT auto-add)
  function handleExtractHost() {
    const h = extractHost(sampleUrl);
    if (!h) {
      setExtractedHost(null);
      setAddError("Could not extract a valid https host from that URL.");
      return;
    }
    const bare = h.replace(/^www\./, "");
    setExtractedHost(bare);
    setNewHost(bare);
    setAddError("");
  }

  function handleAddSource() {
    const host = newHost.trim().toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "");
    if (!host) { setAddError("Host is required."); return; }
    // Basic sanity check — must look like a domain
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
      setAddError("Enter a valid domain (e.g. manabox.app).");
      return;
    }
    // Don't allow duplicates in baseline
    if (BASELINE_DISPLAY.includes(host)) {
      setAddError(`${host} is already in the baseline list.`);
      return;
    }
    // Don't allow duplicates in managed list
    if (managedEntries.some((e) => e.host === host)) {
      setAddError(`${host} is already in the managed list.`);
      return;
    }
    const newEntry = {
      host,
      label: newLabel.trim() || host,
      enabled: true,
      added_at: new Date().toISOString(),
    };
    const updated = [...managedEntries, newEntry];
    saveEntries(updated);
    setNewHost("");
    setNewLabel("");
    setSampleUrl("");
    setExtractedHost(null);
    setAddError("");
  }

  function handleToggle(host) {
    const updated = managedEntries.map((e) =>
      e.host === host ? { ...e, enabled: !e.enabled } : e
    );
    saveEntries(updated);
  }

  function handleRemove(host) {
    const updated = managedEntries.filter((e) => e.host !== host);
    saveEntries(updated);
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white font-semibold text-sm">Approved Deck Link Sources</h3>
        <p className="text-gray-500 text-xs mt-0.5">
          Controls which external deck-link hosts are accepted in deck forms. Baseline hosts are always enabled.
        </p>
      </div>

      {/* ── Baseline hosts (read-only) ─────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-gray-600 text-[10px] uppercase tracking-widest font-semibold">Baseline (always on)</p>
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl divide-y divide-gray-800/40 overflow-hidden">
          {BASELINE_DISPLAY.map((host) => (
            <div key={host} className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Globe className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                <span className="text-gray-300 text-sm font-mono">{host}</span>
              </div>
              <CheckCircle className="w-3.5 h-3.5 text-green-500/70 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Founder-managed hosts ──────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-gray-600 text-[10px] uppercase tracking-widest font-semibold">Founder-managed</p>
        {loading ? (
          <p className="text-gray-600 text-xs py-3 text-center">Loading…</p>
        ) : managedEntries.length === 0 ? (
          <div className="bg-gray-900/30 border border-gray-800/40 rounded-xl px-4 py-5 text-center">
            <p className="text-gray-600 text-xs">No custom sources added yet.</p>
          </div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl divide-y divide-gray-800/40 overflow-hidden">
            {managedEntries.map((entry) => (
              <div key={entry.host} className="flex items-center gap-3 px-3 py-2.5">
                <Globe className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-gray-300 text-sm font-mono truncate block">{entry.host}</span>
                  {entry.label && entry.label !== entry.host && (
                    <span className="text-gray-600 text-[10px]">{entry.label}</span>
                  )}
                </div>
                {entry.enabled ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500/70 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
                )}
                <button
                  onClick={() => handleToggle(entry.host)}
                  disabled={saving}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  title={entry.enabled ? "Disable" : "Enable"}
                >
                  {entry.enabled
                    ? <ToggleRight className="w-4 h-4 text-green-400" />
                    : <ToggleLeft className="w-4 h-4 text-gray-600" />
                  }
                </button>
                <button
                  onClick={() => handleRemove(entry.host)}
                  disabled={saving}
                  className="text-gray-700 hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add new source ─────────────────────────────────────────────── */}
      <div className="space-y-3 bg-gray-900/30 border border-gray-800/50 rounded-xl p-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Add Source</p>

        {/* Sample URL extractor */}
        <div className="space-y-1.5">
          <label className="text-gray-500 text-xs flex items-center gap-1.5">
            <LinkIcon className="w-3 h-3" /> Sample URL (optional — extracts host for you)
          </label>
          <div className="flex gap-2">
            <Input
              value={sampleUrl}
              onChange={(e) => { setSampleUrl(e.target.value); setExtractedHost(null); }}
              placeholder="https://example.app/decks/..."
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-600 text-sm h-9 flex-1"
              inputMode="url"
              autoCapitalize="none"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-400 hover:text-white h-9 flex-shrink-0"
              onClick={handleExtractHost}
            >
              Extract
            </Button>
          </div>
          {extractedHost && (
            <p className="text-green-400 text-xs flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Detected: <strong>{extractedHost}</strong> — copied to Host field
            </p>
          )}
        </div>

        {/* Host + label fields */}
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-gray-500 text-xs">Host / Domain <span className="text-red-400">*</span></label>
            <Input
              value={newHost}
              onChange={(e) => { setNewHost(e.target.value); setAddError(""); }}
              placeholder="example.app"
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-600 text-sm h-9 font-mono"
              autoCapitalize="none"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-gray-500 text-xs">Label (optional)</label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Example"
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-600 text-sm h-9"
            />
          </div>
        </div>

        {addError && <p className="text-red-400 text-xs">{addError}</p>}

        <Button
          type="button"
          onClick={handleAddSource}
          disabled={saving || !newHost.trim()}
          className="w-full ds-btn-primary text-white rounded-xl h-9 text-sm font-semibold disabled:opacity-40"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {saving ? "Saving…" : "Add Source"}
        </Button>
      </div>
    </div>
  );
}