import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getOrCreateProfile } from "@/components/services/gameService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // profile record

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    try {
      const authenticated = await base44.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        const profile = await getOrCreateProfile();
        setCurrentUser(profile);
      }
    } catch (e) {
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
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
    login,
    logout,
    refreshAuth: initAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}