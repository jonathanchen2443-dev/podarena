import React from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const COLOR_LABELS = { W: "W", U: "U", B: "B", R: "R", G: "G", C: "C" };
const COLOR_STYLES = {
  W: "bg-amber-100 text-amber-800 border-amber-300",
  U: "bg-blue-100 text-blue-800 border-blue-300",
  B: "bg-gray-700 text-gray-100 border-gray-600",
  R: "bg-red-100 text-red-800 border-red-300",
  G: "bg-green-100 text-green-800 border-green-300",
  C: "bg-slate-700 text-slate-200 border-slate-600",
};

export default function DeckCard({ deck, onDelete }) {
  return (
    <Card className="bg-gray-900/60 border-gray-800/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-semibold text-sm truncate">{deck.name}</p>
              {!deck.is_active && (
                <Badge variant="outline" className="bg-gray-700/40 text-gray-400 border-gray-600 text-[10px] px-1.5 py-0">
                  Inactive
                </Badge>
              )}
            </div>
            {deck.commander_name && (
              <p className="text-gray-400 text-xs mt-0.5 truncate">{deck.commander_name}</p>
            )}
            {deck.color_identity?.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {deck.color_identity.map((c) => (
                  <span
                    key={c}
                    className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-bold border ${COLOR_STYLES[c] || "bg-gray-700 text-gray-300 border-gray-600"}`}
                  >
                    {COLOR_LABELS[c] || c}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-violet-400 hover:bg-violet-500/10"
              asChild
            >
              <Link to={ROUTES.PROFILE_DECK_EDIT(deck.id)}>
                <Pencil className="w-3.5 h-3.5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
              onClick={() => onDelete(deck)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}