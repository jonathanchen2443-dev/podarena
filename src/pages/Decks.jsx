import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getOrCreateProfile } from "@/components/services/gameService";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Shield, Pencil, Trash2 } from "lucide-react";

const colorMap = {
  W: { label: "White", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" },
  U: { label: "Blue", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  B: { label: "Black", bg: "bg-gray-200", text: "text-gray-800", border: "border-gray-300" },
  R: { label: "Red", bg: "bg-red-100", text: "text-red-800", border: "border-red-200" },
  G: { label: "Green", bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
  C: { label: "Colorless", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

export default function Decks() {
  const [profile, setProfile] = useState(null);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDecks();
  }, []);

  async function loadDecks() {
    const authenticated = await base44.auth.isAuthenticated();
    if (!authenticated) {
      base44.auth.redirectToLogin();
      return;
    }
    const p = await getOrCreateProfile();
    setProfile(p);
    const myDecks = await base44.entities.Deck.filter({ owner_id: p.id });
    setDecks(myDecks);
    setLoading(false);
  }

  async function toggleActive(deck) {
    await base44.entities.Deck.update(deck.id, { is_active: !deck.is_active });
    setDecks((prev) =>
      prev.map((d) => (d.id === deck.id ? { ...d, is_active: !d.is_active } : d))
    );
  }

  async function deleteDeck(deck) {
    await base44.entities.Deck.delete(deck.id);
    setDecks((prev) => prev.filter((d) => d.id !== deck.id));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-40 bg-gray-800" />
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">My Decks</h1>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Deck
          </Button>
        </div>

        {decks.length === 0 ? (
          <Card className="bg-gray-900/50 border-gray-800/50">
            <CardContent className="p-12 text-center">
              <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No decks yet. Add your first Commander deck!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {decks.map((deck) => (
              <Card
                key={deck.id}
                className={`bg-gray-900/50 border-gray-800/50 transition-colors ${
                  !deck.is_active ? "opacity-50" : ""
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{deck.name}</h3>
                        {!deck.is_active && (
                          <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {deck.commander_name && (
                        <p className="text-gray-400 text-sm mb-3">Commander: {deck.commander_name}</p>
                      )}
                      {deck.color_identity?.length > 0 && (
                        <div className="flex gap-1.5">
                          {deck.color_identity.map((c) => (
                            <span
                              key={c}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[c]?.bg} ${colorMap[c]?.text} border ${colorMap[c]?.border}`}
                            >
                              {colorMap[c]?.label || c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-white"
                        onClick={() => toggleActive(deck)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-400"
                        onClick={() => deleteDeck(deck)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}