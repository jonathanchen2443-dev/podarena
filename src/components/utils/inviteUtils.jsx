/**
 * Single source of truth for invite message formatting.
 * Reads template from AppSettings if present, falls back to hardcoded default.
 */
import { getSettings } from "@/components/services/appSettingsService";

const DEFAULT_TEMPLATE = `You're invited to join "{{leagueName}}" on PodArea.\nInvited by: {{inviterName}}\n\nTap to join:\n{{inviteUrl}}`;

function applyTemplate(template, vars) {
  return template
    .replace(/\{\{leagueName\}\}/g, vars.leagueName || "")
    .replace(/\{\{inviterName\}\}/g, vars.inviterName || "A PodArea user")
    .replace(/\{\{inviteUrl\}\}/g, vars.inviteUrl || "");
}

export function formatLeagueInviteMessage({ leagueName, inviterName, inviteUrl }) {
  // Sync fallback — settings may not be loaded yet; callers that want async can use formatLeagueInviteMessageAsync
  return applyTemplate(DEFAULT_TEMPLATE, { leagueName, inviterName, inviteUrl });
}

export async function formatLeagueInviteMessageAsync({ leagueName, inviterName, inviteUrl }) {
  let template = DEFAULT_TEMPLATE;
  try {
    const s = await getSettings();
    if (s?.templates?.invite_message) template = s.templates.invite_message;
  } catch (_) {}
  return applyTemplate(template, { leagueName, inviterName, inviteUrl });
}