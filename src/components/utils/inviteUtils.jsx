/**
 * Single source of truth for invite message formatting.
 */

export function formatLeagueInviteMessage({ leagueName, inviterName, inviteUrl }) {
  const name = inviterName || "A PodArea user";
  return `You're invited to join "${leagueName}" on PodArea.
Invited by: ${name}

Tap to join:
${inviteUrl}`;
}