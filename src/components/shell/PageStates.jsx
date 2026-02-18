import React from "react";
import { Loader2, Inbox, AlertCircle } from "lucide-react";

export function LoadingState({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
      <Loader2 className="w-7 h-7 animate-spin text-violet-400" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", description = "Content will appear here once available." }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500 px-6 text-center">
      <Inbox className="w-10 h-10 text-gray-700" />
      <p className="font-medium text-gray-400">{title}</p>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

export function ErrorState({ message = "Something went wrong." }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500 px-6 text-center">
      <AlertCircle className="w-10 h-10 text-red-500/70" />
      <p className="font-medium text-red-400">Error</p>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}