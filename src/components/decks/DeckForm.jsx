import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import CommanderSearch from "@/components/decks/CommanderSearch";
import ManaPip from "@/components/mtg/ManaPip";

const COLOR_ORDER = ["W", "U", "B", "R", "G", "C"];
const WUBRG_ORDER = ["W", "U", "B", "R", "G"];

// Normalize: dedupe, filter to WUBRG only, sort in WUBRG order
function normalizeColors(colors) {
  if (!colors) return [];
  const unique = [...new Set(colors)].filter((c) => WUBRG_ORDER.includes(c));
  return WUBRG_ORDER.filter((c) => unique.includes(c));
}

const COLOR_NAME_MAP = {
  // 2-color Guilds
  "WU": "Azorius", "UB": "Dimir", "BR": "Rakdos", "RG": "Gruul", "GW": "Selesnya",
  "WB": "Orzhov",  "UR": "Izzet", "BG": "Golgari", "RW": "Boros", "GU": "Simic",
  // 3-color Shards
  "GWU": "Bant", "WUB": "Esper", "UBR": "Grixis", "BRG": "Jund", "RGW": "Naya",
  // 3-color Wedges
  "WBG": "Abzan", "URW": "Jeskai", "BGU": "Sultai", "RWB": "Mardu", "GUR": "Temur",
  // 4-color Nephilim
  "WUBR": "Glint-Eye", "UBRG": "Dune-Brood", "BRGW": "Ink-Treader",
  "RGWU": "Witch-Maw", "GWUB": "Yore-Tiller",
  // 5-color
  "WUBRG": "WUBRG",
};

function getColorName(colors) {
  const norm = normalizeColors(colors);
  if (norm.length < 2) return "";
  return COLOR_NAME_MAP[norm.join("")] || "";
}

// Confirmation dialog rendered inline
function DeleteConfirmDialog({ deckName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
      <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-white font-semibold text-base">Delete Deck?</p>
          <p className="text-gray-400 text-sm">
            "{deckName}" will be permanently deleted. This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl h-11"
            onClick={onCancel}
            disabled={loading}
          >
            Keep Deck
          </Button>
          <Button
            type="button"
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-11"
            onClick={onConfirm}
          >
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DeckForm({ initialValues, onSave, saving, onCancel, onDelete, isEditMode }) {
  const navigate = useNavigate();

  const [commanderName, setCommanderName] = useState(initialValues?.commander_name || "");
  const [commanderImageUrl, setCommanderImageUrl] = useState(initialValues?.commander_image_url || "");
  const [colorIdentity, setColorIdentity] = useState(initialValues?.color_identity || []);
  const [colorManual, setColorManual] = useState(false); // manual override mode
  const [name, setName] = useState(initialValues?.name || "");
  const [isActive, setIsActive] = useState(initialValues?.is_active !== undefined ? initialValues.is_active : true);
  const [commanderError, setCommanderError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const guild = getGuild(colorIdentity);

  function handleCommanderSelect({ name, color_identity, commander_image_url }) {
    setCommanderName(name);
    setColorIdentity(color_identity || []);
    setCommanderImageUrl(commander_image_url || "");
    setColorManual(false); // reset to auto when a new commander is selected
    setCommanderError("");
  }

  function toggleColor(code) {
    setColorIdentity((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!commanderName.trim()) {
      setCommanderError("Commander Name is required.");
      return;
    }
    setCommanderError("");
    onSave({
      name: name.trim(),
      commander_name: commanderName.trim(),
      commander_image_url: commanderImageUrl.trim(),
      color_identity: colorIdentity,
      is_active: isActive,
    });
  }

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    await onDelete();
    setDeleteLoading(false);
    setShowDeleteConfirm(false);
  }

  const canSave = !!commanderName.trim();

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Commander Name — required, first */}
        <div className="space-y-1.5">
          <Label className="text-gray-300 text-sm">
            Commander Name <span className="text-red-400">*</span>
          </Label>
          <CommanderSearch
            value={commanderName}
            onChange={(val) => { setCommanderName(val); if (val) setCommanderError(""); }}
            onSelect={handleCommanderSelect}
          />
          {commanderError && (
            <p className="text-red-400 text-xs mt-1">{commanderError}</p>
          )}
        </div>

        {/* 2. Guild — read-only, auto-filled for 2-color only */}
        <div className="space-y-1.5">
          <Label className="text-gray-400 text-xs uppercase tracking-widest">Guild</Label>
          <div className="h-10 px-3 flex items-center rounded-lg bg-gray-800/50 border border-gray-700/50 text-sm">
            {guild ? (
              <span className="text-white font-medium">{guild}</span>
            ) : (
              <span className="text-gray-600 italic">—</span>
            )}
          </div>
        </div>

        {/* 3. Deck Name — optional nickname */}
        <div className="space-y-1.5">
          <Label className="text-gray-300 text-sm">
            Deck Name <span className="text-gray-500 font-normal text-xs">(optional nickname)</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Atraxa Superfriends"
            className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-[rgb(var(--ds-primary-rgb))]"
          />
        </div>

        {/* Commander image thumbnail only — URL input hidden */}
        {commanderImageUrl && (
          <div className="w-20 rounded-xl overflow-hidden border border-gray-700 bg-gray-800">
            <img
              src={commanderImageUrl}
              alt="Commander"
              className="w-full object-cover"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          </div>
        )}

        {/* 4. Color Identity — mana pip icons */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-gray-300 text-sm">Color Identity</Label>
            <button
              type="button"
              onClick={() => setColorManual((m) => !m)}
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: colorManual ? "var(--ds-primary-text)" : "#6b7280" }}
            >
              {colorManual ? "Auto-fill" : "Pick manually"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {COLOR_ORDER.map((code) => {
              const selected = colorIdentity.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  disabled={!colorManual}
                  onClick={() => colorManual && toggleColor(code)}
                  className="transition-all focus:outline-none rounded-full"
                  style={{
                    opacity: selected ? 1 : 0.25,
                    cursor: colorManual ? "pointer" : "default",
                    transform: selected && colorManual ? "scale(1.15)" : "scale(1)",
                  }}
                  title={code}
                >
                  <ManaPip symbol={code} size={28} />
                </button>
              );
            })}
          </div>
          {colorManual && (
            <p className="text-gray-500 text-xs">Tap pips to toggle. Highlighted = selected.</p>
          )}
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400" : "bg-gray-500"}`} />
              <p className="text-gray-300 text-sm font-medium">{isActive ? "Active" : "Retired"}</p>
            </div>
            <p className="text-gray-500 text-xs mt-0.5">Retired decks are hidden from game logging</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        {/* Bottom buttons */}
        <div className="space-y-3 pt-2">
          {/* Full-width primary SAVE */}
          <Button
            type="submit"
            disabled={saving || !canSave}
            className="w-full ds-btn-primary text-white rounded-xl h-12 text-base font-semibold disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Deck"}
          </Button>

          {/* CANCEL + DELETE row */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl h-11"
              onClick={() => onCancel ? onCancel() : navigate(ROUTES.PROFILE_DECKS)}
              disabled={saving}
            >
              Cancel
            </Button>
            {isEditMode && (
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-red-800/50 text-red-400 hover:bg-red-900/20 rounded-xl h-11"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
              >
                Delete Deck
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          deckName={commanderName || name || "this deck"}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
          loading={deleteLoading}
        />
      )}
    </>
  );
}