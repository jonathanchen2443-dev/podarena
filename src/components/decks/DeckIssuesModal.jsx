import React from "react";
import ReactDOM from "react-dom";
import { X, AlertTriangle, AlertCircle, Info } from "lucide-react";

/**
 * DeckIssuesModal — shows grouped validation issues for a Commander deck.
 *
 * Props:
 *   validation  – the validation object from cardActions validateDeck
 *   onClose     – () => void
 */

const GROUP_ORDER = [
  { key: 'commander', label: 'Commander' },
  { key: 'deck_size', label: 'Deck Size' },
  { key: 'duplicate_card', label: 'Duplicates' },
  { key: 'color_identity_violation', label: 'Color Identity' },
  { key: 'color_identity_unknown', label: 'Color Identity' },
  { key: 'not_commander_legal', label: 'Commander Legality' },
  { key: 'legality_missing', label: 'Missing Data' },
  { key: 'color_identity_missing', label: 'Missing Data' },
];

function groupIssues(errors, warnings) {
  const all = [
    ...errors.map((e) => ({ ...e, _sev: 'error' })),
    ...warnings.map((w) => ({ ...w, _sev: 'warning' })),
  ];

  const commanderTypes = new Set(['no_commander_selected', 'commander_not_in_list']);
  const groups = {};

  for (const issue of all) {
    let groupKey = commanderTypes.has(issue.type) ? 'commander' : issue.type;
    if (!groups[groupKey]) groups[groupKey] = { label: null, issues: [] };
    groups[groupKey].issues.push(issue);
  }

  // Apply labels from GROUP_ORDER, collect in order
  const seen = new Set();
  const result = [];
  for (const { key, label } of GROUP_ORDER) {
    if (groups[key] && !seen.has(key)) {
      seen.add(key);
      result.push({ key, label, issues: groups[key].issues });
    }
  }
  // Any remaining types not in GROUP_ORDER
  for (const [key, val] of Object.entries(groups)) {
    if (!seen.has(key)) {
      result.push({ key, label: key.replace(/_/g, ' '), issues: val.issues });
    }
  }
  return result;
}

function IssueRow({ issue }) {
  const isError = issue._sev === 'error';
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-white/[0.05] last:border-0">
      {isError
        ? <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
        : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
      }
      <p className="text-gray-300 text-xs leading-relaxed">{issue.message}</p>
    </div>
  );
}

export default function DeckIssuesModal({ validation, onClose }) {
  if (!validation) return null;

  const { errors = [], warnings = [], status, totalCards, maxCards } = validation;
  const grouped = groupIssues(errors, warnings);

  const statusLabel = status === 'legal' ? 'Commander Legal' : status === 'needs_review' ? 'Needs Review' : 'Not Legal';
  const statusColor = status === 'legal' ? 'text-green-400' : status === 'needs_review' ? 'text-amber-400' : 'text-red-400';
  const statusBg = status === 'legal' ? 'rgba(34,197,94,0.10)' : status === 'needs_review' ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)';

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{ background: "#1A1F28", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-white font-semibold text-sm">Deck Issues</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {totalCards} / {maxCards ?? 100} cards
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor}`}
              style={{ background: statusBg }}
            >
              {statusLabel}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Info className="w-6 h-6 text-gray-600" />
              <p className="text-gray-500 text-sm">No issues found.</p>
            </div>
          ) : (
            grouped.map(({ key, label, issues }) => (
              <div key={key}>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold mb-2">{label}</p>
                <div className="rounded-xl px-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                  {issues.map((issue, i) => (
                    <IssueRow key={i} issue={issue} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}