import React, { useState, useRef } from "react";
import { Download, RefreshCw, Loader2, CheckCircle2, AlertCircle, X, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * DeckImportButton — owner-only import / refresh controls for a deck's card list.
 *
 * Two import paths:
 *   1. Link import  — invokes deckImport.importDeckList using the deck's external_deck_link
 *   2. TXT upload   — reads a local .txt file and invokes deckImport.importDeckListFromTxt
 *
 * Both paths share the same status feedback UI.
 *
 * Props:
 *   deck          – Deck record (id, external_deck_link, deck_list_import_status)
 *   onImportDone  – callback(result) after any successful import
 */
export default function DeckImportButton({ deck, onImportDone }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { ok, isUnsupported?, message }
  const fileInputRef = useRef(null);

  const hasLink = !!deck?.external_deck_link;
  const isImported = deck?.deck_list_import_status === 'imported';

  // ── helpers ────────────────────────────────────────────────────────────────

  function handleResult(data) {
    if (data?.error) {
      setResult({ ok: false, message: data.error });
    } else if (data?.status === 'imported') {
      setResult({ ok: true, message: 'Deck list imported successfully.' });
      if (onImportDone) onImportDone(data);
    } else if (data?.status === 'unsupported_source') {
      setResult({ ok: false, isUnsupported: true, message: data.message || 'This source is not supported for import yet.' });
    } else if (data?.status === 'failed') {
      setResult({ ok: false, message: data.message || 'Failed to import the deck list.' });
    } else {
      setResult({ ok: false, message: 'Unexpected response. Please try again.' });
    }
  }

  // ── link import ────────────────────────────────────────────────────────────

  async function handleLinkImport() {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('deckImport', {
        action: 'importDeckList',
        deckId: deck.id,
      });
      handleResult(res.data);
    } catch (e) {
      setResult({ ok: false, message: e?.message || 'Import failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  // ── TXT file import ────────────────────────────────────────────────────────

  function handleTxtClick() {
    setResult(null);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected after an error
    e.target.value = '';
    if (!file) return;

    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      setResult({ ok: false, isUnsupported: true, message: 'Please upload a .txt file (e.g. ManaBox TXT export).' });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const txtContent = await file.text();
      const res = await base44.functions.invoke('deckImport', {
        action: 'importDeckListFromTxt',
        deckId: deck.id,
        txtContent,
      });
      handleResult(res.data);
    } catch (e) {
      setResult({ ok: false, message: e?.message || 'File import failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  // Nothing to show if no link AND TXT upload isn't meaningful without a deck
  if (!deck?.id) return null;

  return (
    <div className="space-y-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className={`flex gap-2 ${hasLink ? '' : 'flex-col'}`}>
        {/* Link import — only shown when deck has an external_deck_link */}
        {hasLink && (
          <button
            onClick={handleLinkImport}
            disabled={loading}
            className="flex items-center justify-center gap-2 flex-1 h-10 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              : isImported ? <RefreshCw className="w-4 h-4 text-gray-400" /> : <Download className="w-4 h-4 text-gray-400" />
            }
            {loading ? (isImported ? 'Refreshing…' : 'Importing…') : (isImported ? 'Refresh List' : 'Import List')}
          </button>
        )}

        {/* TXT upload button — always shown for deck owners */}
        <button
          onClick={handleTxtClick}
          disabled={loading}
          className={`flex items-center justify-center gap-2 h-10 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 text-sm font-medium transition-colors disabled:opacity-50 ${hasLink ? 'flex-1' : 'w-full'}`}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            : <Upload className="w-4 h-4 text-gray-400" />
          }
          Upload TXT
        </button>
      </div>

      {/* Status feedback */}
      {result && (
        <div
          className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs leading-snug ${
            result.ok
              ? 'bg-green-500/10 border border-green-500/20 text-green-300'
              : result.isUnsupported
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
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