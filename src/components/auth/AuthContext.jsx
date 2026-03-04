import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getOrCreateProfile } from "@/components/services/gameService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // profile record
  const [profileError, setProfileError] = useState(false);
  const [profileBootstrapError, setProfileBootstrapError] = useState(null);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    setProfileError(false);
    setProfileBootstrapError(null);
    try {
      const authenticated = await base44.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        try {
          const profile = await getOrCreateProfile();
          setCurrentUser(profile);
        } catch (e) {
          // Profile bootstrap failed — stay authenticated but flag error
          let authEmail = "unknown", authId = "unknown";
          try {
            const u = await base44.auth.me();
            authEmail = u?.email || "unknown";
            authId = u?.id || "unknown";
          } catch (_) {}
          console.error("[AuthContext] getOrCreateProfile FAILED", {
            error: e?.message || e,
            authEmail,
            authId,
          });
          setCurrentUser(null);
          setProfileBootstrapError(e?.message || "Profile setup failed.");
        }
      }
    } catch (e) {
      console.error("[AuthContext] isAuthenticated check FAILED", e?.message || e);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setProfileError(true);
    } finally {
      // authLoading = false only after auth + profile bootstrap both resolve
      setAuthLoading(false);
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
    currentUser,
    profileError,
    profileBootstrapError,
    login,
    logout,
    refreshAuth: initAuth,
  };

  if (profileError) {
    return (
      <AuthContext.Provider value={value}>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="bg-gray-900 border border-red-800 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
            <div className="text-red-400 text-4xl">⚠️</div>
            <h2 className="text-white font-semibold text-lg">Profile Setup Failed</h2>
            <p className="text-gray-400 text-sm">
              Failed to initialize your profile. This may be a temporary issue.
            </p>
            <button
              onClick={initAuth}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white ds-btn-primary"
              style={{ backgroundColor: "var(--ds-primary-btn)" }}
            >
              Retry
            </button>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}