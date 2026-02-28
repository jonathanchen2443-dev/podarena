/**
 * Founder Service — controls who has access to the Founder Console.
 */
import { getSettings, upsertSettings, invalidateSettingsCache } from "./appSettingsService";

export async function isFounder(auth) {
  if (auth.isGuest || !auth.currentUser) return false;
  const settings = await getSettings();
  if (!settings) return false;
  return (settings.founder_user_ids || []).includes(auth.currentUser.id);
}

export async function requireFounder(auth) {
  const ok = await isFounder(auth);
  if (!ok) throw new Error("Access denied: Founder only.");
  return true;
}

export async function addFounder(auth, userId) {
  await requireFounder(auth);
  const trimmed = userId.trim();
  if (!trimmed) throw new Error("User ID cannot be empty.");
  const settings = await getSettings();
  const current = settings?.founder_user_ids || [];
  if (current.includes(trimmed)) throw new Error("This user is already a founder.");
  invalidateSettingsCache();
  return upsertSettings({ founder_user_ids: [...current, trimmed] });
}

export async function removeFounder(auth, userId) {
  await requireFounder(auth);
  const settings = await getSettings();
  const current = settings?.founder_user_ids || [];
  if (!current.includes(userId)) throw new Error("User is not a founder.");
  if (current.length <= 1) throw new Error("Cannot remove the last founder — add another founder first.");
  invalidateSettingsCache();
  return upsertSettings({ founder_user_ids: current.filter((id) => id !== userId) });
}