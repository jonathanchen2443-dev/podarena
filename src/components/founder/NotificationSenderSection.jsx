import React, { useState } from "react";
import { Bell, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { lookupProfileByEmail } from "@/components/services/founderService";
import { toast } from "sonner";

export default function NotificationSenderSection({ auth }) {
  const [recipientMode, setRecipientMode] = useState("id");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!recipient.trim() || !message.trim()) { toast.error("Recipient and message required."); return; }
    setLoading(true);
    try {
      let recipientId = recipient.trim();
      if (recipientMode === "email") {
        const profile = await lookupProfileByEmail(recipient.trim());
        if (!profile) { toast.error(`No user found with email "${recipient.trim()}".`); return; }
        recipientId = profile.id;
      }
      await base44.entities.Notification.create({
        type: "system_message",
        league_id: null,
        actor_user_id: auth.currentUser.id,
        recipient_user_id: recipientId,
        message: message.trim(),
      });
      toast.success("Notification sent.");
      setRecipient("");
      setMessage("");
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-sky-400" />
        <h2 className="text-white font-semibold text-sm">Notification Sender</h2>
      </div>

      <div className="flex gap-1.5 bg-gray-800 p-1 rounded-xl">
        {["id", "email"].map((m) => (
          <button key={m} onClick={() => setRecipientMode(m)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${recipientMode === m ? "bg-sky-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            {m === "id" ? "By User ID" : "By Email"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)}
          placeholder={recipientMode === "email" ? "user@example.com" : "Recipient Profile ID"}
          className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Message to send…" rows={3}
          className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 resize-none" />
      </div>

      <Button className="w-full bg-sky-600 hover:bg-sky-700 rounded-xl" onClick={handleSend} disabled={loading || !recipient.trim() || !message.trim()}>
        <Send className="w-3.5 h-3.5 mr-1.5" />
        {loading ? "Sending…" : "Send Notification"}
      </Button>
    </div>
  );
}