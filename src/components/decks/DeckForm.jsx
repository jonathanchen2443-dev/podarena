import React, { useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import CommanderSearch from "@/components/decks/CommanderSearch";
import DeckIdentityCard from "@/components/decks/DeckIdentityCard";
import { ExternalLink, Lock } from "lucide-react";

const ALLOWED_DECK_LINK_HOSTS = [
  "moxfield.com", "www.moxfield.com",
  "archidekt.com", "www.archidekt.com",
  "edhrec.com", "www.edhrec.com",
  "tappedout.net", "www.tappedout.net",
  "deckstats.net", "www.deckstats.net",
  "mtggoldfish.com", "www.mtggoldfish.com",
  "aetherhub.com", "www.aetherhub.com",
  "scryfall.com", "www.scryfall.com",
  "cubecobra.com", "www.cubecobra.com",
];

function validateExternalDeckLink(url) {
  if (!url || !url.trim()) return { valid: true };
  let parsed;
  try { parsed = new URL(url.trim()); } catch { return { valid: false, error: "Must be a valid URL" }; }
  if (parsed.protocol !== "https:") return { valid: false, error: "Link must use https://" };
  if (!ALLOWED_DECK_LINK_HOSTS.includes(parsed.hostname)) {
    return { valid: false, error: "Link must point to a recognized site (Moxfield, Archidekt, EDHREC, MTGGoldfish, etc.)" };
  }
  return { valid: true };
}

// Confirmation dialog rendered via portal to escape overflow/z-index clipping
function DeleteConfirmDialog({ deckName, onConfirm, onCancel, loading }) {
  const content = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", padding: "0 16px" }}
    >
      <div
        style={{ width: "100%", maxWidth: 420, borderRadius: 20, background: "#111827", border: "1px solid #1f2937", padding: 24, marginBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: "#fff", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Delete Deck?</p>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            "{deckName}" will be permanently deleted. This cannot be undone.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
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
  return ReactDOM.createPortal(content, document.body);
}

export default function DeckForm({ initialValues, onSave, saving, onCancel, onDelete, isEditMode }) {
  const navigate = useNavigate();

  const [commanderName, setCommanderName] = useState(initialValues?.commander_name || "");
  const [commanderImageUrl, setCommanderImageUrl] = useState(initialValues?.commander_image_url || "");
  // colorIdentity is always derived from commander; manual editing removed
  const [colorIdentity, setColorIdentity] = useState(initialValues?.color_identity || []);
  const [name, setName] = useState(initialValues?.name || "");
  const [externalDeckLink, setExternalDeckLink] = useState(initialValues?.external_deck_link || "");
  const [externalLinkError, setExternalLinkError] = useState("");
  const [isActive, setIsActive] = useState(initialValues?.is_active !== undefined ? initialValues.is_active : true);
  const [commanderError, setCommanderError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function handleCommanderSelect({ name: cName, color_identity, commander_image_url }) {
    setCommanderName(cName);
    setColorIdentity(color_identity || []);
    setCommanderImageUrl(commander_image_url || "");
    setCommanderError("");
  }

  function handleExternalLinkChange(val) {
    setExternalDeckLink(val);
    if (val.trim()) {
      const result = validateExternalDeckLink(val);
      setExternalLinkError(result.valid ? "" : result.error);
    } else {
      setExternalLinkError("");
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!commanderName.trim()) {
      setCommanderError("Commander Name is required.");
      return;
    }
    // Validate external link before saving
    const linkCheck = validateExternalDeckLink(externalDeckLink);
    if (!linkCheck.valid) {
      setExternalLinkError(linkCheck.error);
      return;
    }
    setCommanderError("");
    onSave({
      name: name.trim(),
      commander_name: commanderName.trim(),
      commander_image_url: commanderImageUrl.trim(),
      color_identity: colorIdentity,
      is_active: isActive,
      deck_format: "commander",
      external_deck_link: externalDeckLink.trim() || null,
    });
  }

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    await onDelete();
    setDeleteLoading(false);
    setShowDeleteConfirm(false);
  }

  const canSave = !!commanderName.trim() && !externalLinkError;

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

        {/* 2. Format — locked to Commander */}
        <div className="space-y-1.5">
          <Label className="text-gray-400 text-xs uppercase tracking-widest flex items-center gap-1.5">
            Format
            <Lock className="w-3 h-3 text-gray-600" />
          </Label>
          <div className="h-10 px-3 flex items-center rounded-lg bg-gray-800/40 border border-gray-700/40 text-sm gap-2">
            <span className="text-amber-400 font-semibold">Commander</span>
            <span className="text-gray-600 text-xs">(only format supported)</span>
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

        {/* 4. Deck Identity Card — live preview */}
        <DeckIdentityCard
          commanderName={commanderName}
          commanderImageUrl={commanderImageUrl}
          deckName={name}
          colorIdentity={colorIdentity}
        />

        {/* 5. External Deck Link — optional */}
        <div className="space-y-1.5">
          <Label className="text-gray-300 text-sm flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            Decklist Link <span className="text-gray-500 font-normal text-xs">(optional)</span>
          </Label>
          <Input
            value={externalDeckLink}
            onChange={(e) => handleExternalLinkChange(e.target.value)}
            placeholder="https://moxfield.com/decks/..."
            className={`bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-[rgb(var(--ds-primary-rgb))] ${externalLinkError ? "border-red-500" : ""}`}
            inputMode="url"
            autoCapitalize="none"
          />
          {externalLinkError ? (
            <p className="text-red-400 text-xs">{externalLinkError}</p>
          ) : (
            <p className="text-gray-600 text-xs">Moxfield, Archidekt, EDHREC, MTGGoldfish, etc.</p>
          )}
        </div>

        {/* 6. Active toggle */}
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
          <Button
            type="submit"
            disabled={saving || !canSave}
            className="w-full ds-btn-primary text-white rounded-xl h-12 text-base font-semibold disabled:opacity-40"
          >
            {saving ? "Saving…" : isEditMode ? "Update Deck" : "Save Deck"}
          </Button>

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