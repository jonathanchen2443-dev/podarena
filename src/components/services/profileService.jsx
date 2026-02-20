/**
 * Profile Service - Public, read-only profile lookups.
 * Never returns email or sensitive fields.
 */
import { base44 } from "@/api/base44Client";

const SAFE_FIELDS = ["id", "display_name", "avatar_url", "created_date"];

function toPublicProfile(profile) {
  return {
    id: profile.id,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url || null,
    created_date: profile.created_date || null,
  };
}

/**
 * Fetch a public profile by profile id.
 * Guests and authed users can both read — no sensitive data is returned.
 * Throws "not_found" if no profile exists.
 */
export async function getPublicProfile(userId) {
  if (!userId) throw new Error("not_found");
  const results = await base44.entities.Profile.filter({ id: userId });
  if (!results.length) throw new Error("not_found");
  return toPublicProfile(results[0]);
}