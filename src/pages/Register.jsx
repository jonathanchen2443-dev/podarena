import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { getOrCreateProfile } from "@/components/services/gameService";
import { Sparkles, Mail, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Register() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.auth.isAuthenticated().then((auth) => {
      if (auth) navigate(createPageUrl("Home"), { replace: true });
    });
  }, []);

  async function handleRegister(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register(email, password, displayName);
      await getOrCreateProfile();
      navigate(createPageUrl("Home"), { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    base44.auth.redirectToLogin();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-bold text-xl">MTG Tracker</span>
      </div>

      <div className="w-full max-w-sm">
        <h1 className="text-white font-bold text-2xl text-center mb-1">Create account</h1>
        <p className="text-gray-400 text-sm text-center mb-8">Join your playgroup on MTG Tracker</p>

        {/* Google */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 border-gray-700 text-gray-200 hover:bg-gray-800 rounded-xl mb-4"
          onClick={handleGoogleLogin}
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 text-xs">or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Display Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full h-11 bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full h-11 bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                className="w-full h-11 bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                className="w-full h-11 bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg p-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium mt-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <button onClick={() => base44.auth.redirectToLogin()} className="text-violet-400 hover:text-violet-300 font-medium">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}