import React from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Swords, Bell, Layers } from "lucide-react";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6995f1fed0849cf726dfe04d/bea8c705b_LogoBlack.jpg";

export default function Landing() {
  const nextUrl = createPageUrl("Dashboard");

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">

        {/* Branding */}
        <div className="text-center space-y-3">
          <img
            src={LOGO_URL}
            alt="PodArena"
            className="w-16 h-16 rounded-2xl object-cover mx-auto"
          />
          <h1 className="text-3xl font-bold text-white">PodArena</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Track Commander games, manage approvals, and follow standings with your playgroup.
          </p>
        </div>

        {/* Feature bullets */}
        <div className="space-y-2.5">
          {[
            { icon: Swords,  text: "Log game results with your playgroup" },
            { icon: Bell,    text: "Approve or reject games logged by others" },
            { icon: Layers,  text: "PODS — a better way to organize coming soon" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-gray-400 text-sm">
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ds-primary-text)" }} />
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="space-y-3">
          <button
            onClick={() => base44.auth.redirectToLogin(nextUrl)}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--ds-primary-btn)" }}
          >
            {/* Google "G" SVG icon */}
            <svg className="w-4 h-4" viewBox="0 0 48 48" fill="none">
              <path d="M47.532 24.552c0-1.636-.132-3.2-.388-4.692H24.48v9.02h13.02c-.572 2.992-2.26 5.528-4.804 7.228v5.988h7.764c4.548-4.192 7.072-10.36 7.072-17.544z" fill="#4285F4"/>
              <path d="M24.48 48c6.516 0 11.988-2.16 15.984-5.9l-7.764-5.988c-2.16 1.448-4.92 2.3-8.22 2.3-6.32 0-11.668-4.264-13.584-9.996H2.876v6.188C6.856 42.508 15.1 48 24.48 48z" fill="#34A853"/>
              <path d="M10.896 28.416A14.485 14.485 0 0 1 9.96 24c0-1.54.264-3.036.736-4.416v-6.188H2.876A23.955 23.955 0 0 0 .48 24c0 3.872.928 7.536 2.396 10.604l8.02-6.188z" fill="#FBBC05"/>
              <path d="M24.48 9.588c3.556 0 6.748 1.224 9.264 3.628l6.94-6.94C36.46 2.396 30.992 0 24.48 0 15.1 0 6.856 5.492 2.876 13.396l8.02 6.188c1.916-5.732 7.264-9.996 13.584-9.996z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>

          <button
            onClick={() => base44.auth.redirectToLogin(nextUrl)}
            className="w-full h-11 rounded-xl text-sm font-semibold text-gray-300 border border-gray-700 hover:bg-gray-800 transition-colors"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}