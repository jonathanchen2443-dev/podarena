import React, { useState, useEffect } from "react";
import { FileText, Save, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upsertSettings, invalidateSettingsCache } from "@/components/services/appSettingsService";
import { toast } from "sonner";

const DEFAULT_INVITE_TEMPLATE = `You're invited to join "{{leagueName}}" on PodArea.\nInvited by: {{inviterName}}\n\nTap to join:\n{{inviteUrl}}`;
const EXAMPLE_VARS = { leagueName: "Friday Night Pod", inviterName: "Jonathan", inviteUrl: "https://podarea.app/invite?token=abc123" };

function renderPreview(template, vars) {
  return template
    .replace(/\{\{leagueName\}\}/g, vars.leagueName)
    .replace(/\{\{inviterName\}\}/g, vars.inviterName)
    .replace(/\{\{inviteUrl\}\}/g, vars.inviteUrl);
}

export default function ConfigEditorSection({ settings, onRefresh }) {
  const [inviteMsg, setInviteMsg] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInviteMsg(settings?.templates?.invite_message || DEFAULT_INVITE_TEMPLATE);
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      invalidateSettingsCache();
      await upsertSettings({ templates: { ...(settings?.templates || {}), invite_message: inviteMsg } });
      toast.success("Template saved.");
      onRefresh();
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  function handleReset() {
    setInviteMsg(DEFAULT_INVITE_TEMPLATE);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-emerald-400" />
        <h2 className="text-white font-semibold text-sm">Config Editor</h2>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500">Invite Message Template</label>
          <div className="flex gap-2">
            <button onClick={() => setShowPreview((v) => !v)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              <Eye className="w-3 h-3" /> {showPreview ? "Hide" : "Preview"}
            </button>
            <button onClick={handleReset} className="text-xs text-gray-600 hover:text-gray-400">Reset</button>
          </div>
        </div>
        <p className="text-[10px] text-gray-600 mb-1.5">
          Variables: <code className="text-gray-500">{"{{leagueName}}"}</code> <code className="text-gray-500">{"{{inviterName}}"}</code> <code className="text-gray-500">{"{{inviteUrl}}"}</code>
        </p>
        <textarea
          value={inviteMsg}
          onChange={(e) => setInviteMsg(e.target.value)}
          rows={6}
          className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 resize-none font-mono"
        />
      </div>

      {showPreview && (
        <div>
          <p className="text-xs text-gray-600 mb-1.5">Preview (example values):</p>
          <pre className="bg-gray-800/60 rounded-xl p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
            {renderPreview(inviteMsg, EXAMPLE_VARS)}
          </pre>
        </div>
      )}

      <Button className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl" onClick={handleSave} disabled={saving}>
        <Save className="w-3.5 h-3.5 mr-1.5" />
        Save Template
      </Button>
    </div>
  );
}