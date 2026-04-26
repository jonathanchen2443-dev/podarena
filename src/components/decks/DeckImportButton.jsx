import React, { useState } from "react";
import { Download, RefreshCw, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * DeckImportButton — owner-only import / refresh control for a deck's card list.
 *
 * Shows:
 *   - "Import Deck List" if never imported
 *   - "Refresh Deck List" if already imported
 *
 * After action: shows inline success/error message with dismiss.
 *
 * Props:
 *   deck           – Deck record (must have id, external_deck_link, deck_list_import_status)
 *   onImportDone   – callback(updatedStatus) after successful import
 */
export default function DeckImportButton({ deck, onImportDone }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { ok: bool, message: string } | null

  const hasLink = !!deck?.external_deck_link;
  const isImported = deck?.deck_list_import_status === 'imported';
  const label = isImported ? 'Refresh Deck List' : 'Import Deck List';
  const Icon = isImported ? RefreshCw : Download;

  async function handleImport() {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('deckImport', {
        action: 'importDeckList',
        deckId: deck.id,
      });
      const data = res.data;
      if (data?.error) {
        setResult({ ok: false, message: data.error });
      } else if (data?.status === 'imported') {
        setResult({ ok: true, message: data.message || 'Deck list imported successfully!' });
        if (onImportDone) onImportDone(data);
      } else if (data?.status === 'unsupported_source') {
        setResult({ ok: false, message: data.message || 'This source is not yet supported for import.' });
      } else if (data?.status === 'failed') {
        setResult({ ok: false, message: data.message || 'Import failed. Please try again.' });
      } else {
        setResult({ ok: false, message: 'Unexpected response. Please try again.' });
      }
    } catch (e) {
      setResult({ ok: false, message: e?.message || 'Import failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  if (!hasLink) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={handleImport}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 text-sm font-medium transition-colors disabled:opacity-50"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          : <Icon className="w-4 h-4 text-gray-400" />
        }
        {loading ? (isImported ? 'Refreshing…' : 'Importing…') : label}
      </button>

      {result && (
        <div
          className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs leading-snug ${
            result.ok
              ? 'bg-green-500/10 border border-green-500/20 text-green-300'
              : 'bg-red-500/10 border border-red-500/20 text-red-300'
          }`}
        >
          {result.ok
            ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          }
          <span className="flex-1">{result.message}</span>
          <button
            onClick={() => setResult(null)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}