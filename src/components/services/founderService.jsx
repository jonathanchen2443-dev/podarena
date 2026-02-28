/**
 * Founder Service — controls who has access to the Founder Console.
 */
import { base44 } from "@/api/base44Client";
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

/** Resolve a profile by email — searches Profile entity by email field */
export async function lookupProfileByEmail(email) {
  const trimmed = email.trim().toLowerCase();
  const profiles = await base44.entities.Profile.list("-created_date", 200);
  return profiles.find((p) => (p.email || "").toLowerCase() === trimmed) || null;
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

export async function addFounderByEmail(auth, email) {
  await requireFounder(auth);
  const profile = await lookupProfileByEmail(email);
  if (!profile) throw new Error(`No user found with email "${email.trim()}".`);
  return addFounder(auth, profile.id);
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