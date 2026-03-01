import React from "react";
import ReactDOM from "react-dom";
import { Lock, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function LoginRequiredModal({ onClose }) {

  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return null;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl ds-accent-bg ds-accent-bd border flex items-center justify-center">
            <Lock className="w-6 h-6" style={{ color: "var(--ds-primary-text)" }} />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Login required</h2>
            <p className="text-gray-400 text-sm mt-1">
              You must be logged in to do this.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button
              className="w-full ds-btn-primary text-white rounded-xl h-11"
              onClick={() => {
                onClose();
                base44.auth.redirectToLogin();
              }}
            >
              Go to Login
            </Button>
            <Button
              variant="ghost"
              className="w-full text-gray-400 hover:text-white rounded-xl h-11"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, modalRoot);
}