/**
 * inboxCountService — single source of truth for inbox unread counts.
 *
 * Both the TopBar badge and the Inbox page must use this service so the counts
 * are always consistent. The backend inboxSummary action does the authoritative
 * computation via asServiceRole (bypasses RLS), so both surfaces read the same data.
 */
import { base44 } from "@/api/base44Client";

/**
 * fetchInboxSummary — calls the backend inboxSummary action.
 * Returns { totalUnread, pendingApprovalsCount, unreadInvites, unreadSystem }
 */
export async function fetchInboxSummary(authUserId, profileId) {
  if (!authUserId || !profileId) return { totalUnread: 0, pendingApprovalsCount: 0, unreadInvites: 0, unreadSystem: 0 };
  const res = await base44.functions.invoke('publicProfiles', {
    action: 'inboxSummary',
    callerAuthUserId: authUserId,
    callerProfileId: profileId,
  });
  return res.data || { totalUnread: 0, pendingApprovalsCount: 0, unreadInvites: 0, unreadSystem: 0 };
}