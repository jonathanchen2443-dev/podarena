import React from "react";
import ReactDOM from "react-dom";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DeleteDeckModal({ deck, onConfirm, onCancel, loading }) {
  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot || !deck) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-500 hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Delete deck?</h2>
            <p className="text-gray-400 text-sm mt-1">
              "<span className="text-white">{deck.name}</span>" will be permanently deleted.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl h-11"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Deleting…" : "Delete"}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-gray-400 hover:text-white rounded-xl h-11"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
}