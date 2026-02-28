import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

const COLORS = [
  { code: "W", name: "White" },
  { code: "U", name: "Blue" },
  { code: "B", name: "Black" },
  { code: "R", name: "Red" },
  { code: "G", name: "Green" },
  { code: "C", name: "Colorless" },
];

const COLOR_STYLES = {
  W: { active: "bg-amber-200 text-amber-900 border-amber-400", inactive: "bg-gray-800 text-gray-400 border-gray-700" },
  U: { active: "bg-blue-200 text-blue-900 border-blue-400", inactive: "bg-gray-800 text-gray-400 border-gray-700" },
  B: { active: "bg-gray-600 text-white border-gray-500", inactive: "bg-gray-800 text-gray-400 border-gray-700" },
  R: { active: "bg-red-200 text-red-900 border-red-400", inactive: "bg-gray-800 text-gray-400 border-gray-700" },
  G: { active: "bg-green-200 text-green-900 border-green-400", inactive: "bg-gray-800 text-gray-400 border-gray-700" },
  C: { active: "bg-slate-500 text-white border-slate-400", inactive: "bg-gray-800 text-gray-400 border-gray-700" },
};

export default function DeckForm({ initialValues, onSave, saving }) {
  const navigate = useNavigate();
  const [name, setName] = useState(initialValues?.name || "");
  const [commanderName, setCommanderName] = useState(initialValues?.commander_name || "");
  const [commanderImageUrl, setCommanderImageUrl] = useState(initialValues?.commander_image_url || "");
  const [colorIdentity, setColorIdentity] = useState(initialValues?.color_identity || []);
  const [isActive, setIsActive] = useState(initialValues?.is_active !== undefined ? initialValues.is_active : true);
  const [error, setError] = useState("");

  function toggleColor(code) {
    setColorIdentity((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Deck name is required.");
      return;
    }
    setError("");
    onSave({
      name: name.trim(),
      commander_name: commanderName.trim(),
      commander_image_url: commanderImageUrl.trim(),
      color_identity: colorIdentity,
      is_active: isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-gray-300 text-sm">Deck Name <span className="text-red-400">*</span></Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Atraxa Superfriends"
          className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-gray-300 text-sm">Commander Name</Label>
        <Input
          value={commanderName}
          onChange={(e) => setCommanderName(e.target.value)}
          placeholder="e.g. Atraxa, Praetors' Voice"
          className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-violet-500"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-gray-300 text-sm">Color Identity</Label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(({ code, name: colorName }) => {
            const active = colorIdentity.includes(code);
            const styles = COLOR_STYLES[code];
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleColor(code)}
                title={colorName}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${active ? styles.active : styles.inactive}`}
              >
                {code}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-gray-300 text-sm font-medium">Active</p>
          <p className="text-gray-500 text-xs">Inactive decks are hidden from game logging</p>
        </div>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-11"
        >
          {saving ? "Saving…" : "Save Deck"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 rounded-xl h-11"
          onClick={() => navigate(ROUTES.PROFILE_DECKS)}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}