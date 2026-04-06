/**
 * randomDeckService — thin client wrapper for the randomDeckPicker backend function.
 *
 * All eligibility logic (owner filter, is_active filter, random selection)
 * is handled server-side. This wrapper just invokes the function and normalises the response.
 */
import { base44 } from "@/api/base44Client";

/**
 * pickRandomDeck — calls the backend and returns a randomly selected eligible deck,
 * or null if the user has no active decks.
 *
 * @returns {Promise<object|null>}
 */
export async function pickRandomDeck() {
  const res = await base44.functions.invoke('randomDeckPicker', {});
  if (res.data?.error) throw new Error(res.data.error);
  return res.data?.deck ?? null;
}