import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { getOrCreateProfile } from "@/components/services/gameService";

const AuthContext = createContext(null);

// How long to wait before the one automatic retry on profile bootstrap failure
const PROFILE_RETRY_DELAY_MS = 1500;

export function AuthProvider({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // Profile entity record
  /**
   * authUserId = Auth User ID (base44.auth.me().id / {{user.id}})
   * Derived from profile.user_id which is stamped at registration.
   * Use this for all RLS-sensitive fields: *_user_id, recipient_user_id, etc.
   * NEVER use currentUser.id (which is Profile entity UUID) for RLS queries.
   */
  const [authUserId, setAuthUserId] = useState(null);
  // profileError = true only for genuine unrecoverable failures (auth check itself failed)
  const [profileError, setProfileError] = useState(false);
  // profileBootstrapError = non-null only after all retry attempts are exhausted
  const [profileBootstrapError, setProfileBootstrapError] = useState(null);
  const hasRetriedRef = useRef(false);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    setProfileError(false);
    setProfileBootstrapError(null);
    hasRetriedRef.current = false;
    try {
      const authenticated = await base44.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        await _bootstrapProfile();
      }
    } catch (e) {
      // isAuthenticated() itself failed — this is a genuine auth infrastructure error
      console.error("[AuthContext] isAuthenticated check FAILED", e?.message || e);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setProfileError(true);
    } finally {
      setAuthLoading(false);
    }
  }

  // Separated so it can be retried independently without re-checking auth
  async function _bootstrapProfile() {
    try {
      const profile = await getOrCreateProfile();
      setCurrentUser(profile);
      // profile.user_id is the Auth User ID stamped at registration — use this for RLS queries
      setAuthUserId(profile?.user_id || null);
      setProfileBootstrapError(null);
      hasRetriedRef.current = false;
    } catch (e) {
      if (!hasRetriedRef.current) {
        // One automatic retry after a short delay — handles RLS propagation timing
        // on first login (especially Google OAuth where the session may not have
        // fully propagated when the first Profile read runs)
        hasRetriedRef.current = true;
        console.warn("[AuthContext] Profile bootstrap failed, retrying once after delay…", e?.message || e);
        await new Promise((r) => setTimeout(r, PROFILE_RETRY_DELAY_MS));
        return _bootstrapProfile(); // tail-recurse; hasRetriedRef prevents further loops
      }
      // Both attempts failed — log and surface error
      let authEmail = "unknown", authId = "unknown";
      try {
        const u = await base44.auth.me();
        authEmail = u?.email || "unknown";
        authId = u?.id || "unknown";
      } catch (_) {}
      console.error("[AuthContext] getOrCreateProfile FAILED after retry", {
        error: e?.message || e,
        authEmail,
        authId,
      });
      setCurrentUser(null);
      setProfileBootstrapError(e?.message || "Profile setup failed.");
    }
  }

  function login() {
    base44.auth.redirectToLogin();
  }

  function logout() {
    base44.auth.logout();
  }

  const value = {
    authLoading,
    isAuthenticated,
    isGuest: !isAuthenticated,
    currentUser,         // Profile entity record — use .id for Profile ID joins
    authUserId,          // Auth User ID (profile.user_id) — use for RLS fields / *_user_id queries
    profileError,
    profileBootstrapError,
    login,
    logout,
    refreshAuth: initAuth,
  };

  // Only block the entire app for a genuine auth infrastructure failure
  // (not for profile bootstrap — those degrade gracefully via profileBootstrapError)
  if (profileError) {
    return (
      <AuthContext.Provider value={value}>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="bg-gray-900 border border-red-800 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
            <div className="text-red-400 text-4xl">⚠️</div>
            <h2 className="text-white font-semibold text-lg">Connection Error</h2>
            <p className="text-gray-400 text-sm">
              Could not reach the authentication service. Please check your connection and try again.
            </p>
            <button
              onClick={initAuth}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: "var(--ds-primary-btn)" }}
            >
              Retry
            </button>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  // profileBootstrapError: authenticated but profile couldn't be provisioned after retry.
  // Render children so pages can show their own context-aware error/retry UI
  // using profileBootstrapError from context. refreshAuth() is available for manual retry.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}