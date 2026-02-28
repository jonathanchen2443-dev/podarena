import React, { useState } from "react";
import { Database, Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const ENTITIES = [
  "Profile", "League", "LeagueMember", "Deck", "Game",
  "GameParticipant", "GameApproval", "LeagueInvite", "Notification", "AppSettings"
];

const FILTER_OPTS = ["none", "id", "league_id", "user_id"];

function JsonRow({ row, selected, onSelect }) {
  const preview = JSON.stringify(row.data || row).slice(0, 80);
  return (
    <div
      onClick={() => onSelect(row)}
      className={`px-3 py-2 rounded-lg cursor-pointer text-xs border transition-colors ${
        selected ? "border-violet-500 bg-violet-500/10 text-white" : "border-transparent text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
      }`}
    >
      <span className="font-mono text-[10px] text-gray-600 mr-2">{row.id?.slice(-8)}</span>
      {preview}…
    </div>
  );
}

export default function EntityBrowserSection() {
  const [entity, setEntity] = useState("Profile");
  const [filterType, setFilterType] = useState("none");
  const [filterValue, setFilterValue] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  async function handleQuery() {
    setLoading(true);
    setSelected(null);
    try {
      let rows;
      if (filterType === "none" || !filterValue.trim()) {
        rows = await base44.entities[entity].list("-created_date", 50);
      } else if (filterType === "id") {
        rows = await base44.entities[entity].filter({ id: filterValue.trim() });
      } else {
        rows = await base44.entities[entity].filter({ [filterType]: filterValue.trim() }, "-created_date", 50);
      }
      setResults(rows);
    } catch (e) {
      setResults([]);
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-sm">Entity Browser</h2>
        <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">read-only</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <select
            value={entity}
            onChange={(e) => { setEntity(e.target.value); setResults(null); }}
            className="bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-2 pr-7 appearance-none focus:outline-none focus:border-violet-500"
          >
            {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-2 pr-7 appearance-none focus:outline-none focus:border-violet-500"
          >
            {FILTER_OPTS.map((o) => <option key={o} value={o}>{o === "none" ? "No filter" : o}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
        </div>
        {filterType !== "none" && (
          <input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="value…"
            className="flex-1 min-w-28 bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
            onKeyDown={(e) => e.key === "Enter" && handleQuery()}
          />
        )}
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 rounded-xl" onClick={handleQuery} disabled={loading}>
          <Search className="w-3.5 h-3.5 mr-1" />
          {loading ? "Loading…" : "Query"}
        </Button>
      </div>

      {results !== null && (
        <div className={`grid ${selected ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
          {/* Results list */}
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs text-gray-600 px-2 py-3">No results.</p>
            ) : (
              results.map((row) => (
                <JsonRow key={row.id} row={row} selected={selected?.id === row.id} onSelect={setSelected} />
              ))
            )}
          </div>

          {/* Detail view */}
          {selected && (
            <div className="relative">
              <button
                onClick={() => setSelected(null)}
                className="absolute right-2 top-2 text-gray-600 hover:text-gray-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <pre className="bg-gray-800/60 rounded-xl p-3 text-[10px] text-gray-300 overflow-auto max-h-72 leading-relaxed">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}