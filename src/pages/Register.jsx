/**
 * Register — redirect shim.
 * The platform handles all auth (including Google OAuth) via its built-in login page.
 * A custom register page that calls redirectToLogin() causes a redirect loop
 * because the OAuth callback returns here, which triggers another redirectToLogin().
 *
 * Fix: immediately redirect to the platform login page, then after successful auth
 * the platform returns to Dashboard as the nextUrl.
 */
import { useEffect } from "react";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

export default function Register() {
  useEffect(() => {
    // Check if already authenticated — if so, go straight to Dashboard
    base44.auth.isAuthenticated().then((auth) => {
      if (auth) {
        window.location.replace(createPageUrl("Dashboard"));
      } else {
        // Redirect to the platform login, return to Dashboard after success
        base44.auth.redirectToLogin(createPageUrl("Dashboard"));
      }
    });
  }, []);

  return null;
}