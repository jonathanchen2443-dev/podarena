/**
 * Lightweight event bus so Inbox page can tell TopBar badge to refresh immediately.
 * Dispatches a custom DOM event "inbox-updated" after read/delete operations.
 */

export function notifyInboxUpdated() {
  window.dispatchEvent(new Event("inbox-updated"));
}

export function onInboxUpdated(handler) {
  window.addEventListener("inbox-updated", handler);
  return () => window.removeEventListener("inbox-updated", handler);
}