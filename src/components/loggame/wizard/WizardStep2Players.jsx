/**
 * Step 2 — Players & Results
 * Deck selection (top), participant pool, placement assignment.
 * Reuses: CasualParticipantPicker, ParticipantPicker, ParticipantSetupCard
 */
import React, { useMemo } from "react";
import { ChevronDown, User } from "lucide-react";
import CasualParticipantPicker from "@/components/loggame/CasualParticipantPicker";
import ParticipantPicker from "@/components/loggame/ParticipantPicker";
import ParticipantSetupCard from "@/components/loggame/ParticipantSetupCard";

function FieldLabel({ children }) {
  return (
    <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-2">{children}</p>
  );
}

// Compact deck selector for the logger's own deck
function MyDeckPicker({ decks, value, onChange }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(var(--ds-primary-rgb),0.06)", border: "1px solid rgba(var(--ds-primary-rgb),0.18)" }}
    >
      <FieldLabel>Your deck for this game</FieldLabel>
      {decks.length === 0 ? (
        <p className="text-gray-600 text-xs">No active decks — deck not tracked.</p>
      ) : (
        <div className="relative">
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full appearance-none rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ds-primary-rgb))] pr-8"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(var(--ds-primary-rgb),0.25)",
              color: value ? "#f3f4f6" : "#6b7280",
              colorScheme: "dark",
            }}
          >
            <option value="">No deck / not tracked</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.commander_name ? ` — ${d.commander_name}` : ""}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: "var(--ds-primary-text)", opacity: 0.6 }}
          />
        </div>
      )}
    </div>
  );
}

export default function WizardStep2Players({
  mode,
  pod,
  podMembers,
  podMembersLoading,
  participants,
  memberData,
  placements,
  participantCount,
  currentUser,
  myDecks,
  myDeckId,
  onMyDeckChange,
  onAddPodParticipant,
  onRemovePodParticipant,
  onAddCasualParticipant,
  onRemoveCasualParticipant,
  onPlacementChange,
}) {
  const usedPlacements = useMemo(
    () => new Set(Object.values(placements).filter(Boolean).map(Number)),
    [placements]
  );

  const membersForSetup = participants.map((id) => ({
    userId: id,
    display_name: memberData[id]?.display_name || id,
    avatar_url: memberData[id]?.avatar_url || null,
  }));

  const assignedCount = Object.values(placements).filter(Boolean).length;
  const needCount = Math.min(participantCount, participants.length);

  return (
    <div className="space-y-5">

      {/* Your deck — top of step */}
      <MyDeckPicker decks={myDecks} value={myDeckId} onChange={onMyDeckChange} />

      {/* Participant pool */}
      <div>
        <FieldLabel>
          Players{" "}
          <span className="normal-case font-normal text-gray-700">
            ({participants.length} / {participantCount} selected)
          </span>
        </FieldLabel>
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
          {mode === "casual" ? (
            <CasualParticipantPicker
              selectedIds={participants}
              onAdd={onAddCasualParticipant}
              onRemove={onRemoveCasualParticipant}
              currentUserProfileId={currentUser?.id}
              currentUserProfile={
                currentUser
                  ? { display_name: currentUser.display_name, avatar_url: currentUser.avatar_url || null }
                  : null
              }
            />
          ) : (
            <ParticipantPicker
              members={podMembers}
              selectedIds={participants}
              onAdd={onAddPodParticipant}
              onRemove={onRemovePodParticipant}
              currentUserId={currentUser?.id}
              membersLoading={podMembersLoading}
            />
          )}
        </div>
      </div>

      {/* Placement assignment — only shown once we have 2+ participants */}
      {participants.length >= 2 && (
        <div>
          <FieldLabel>
            Final Placements{" "}
            <span className="normal-case font-normal text-gray-700">
              ({assignedCount}/{participants.length} assigned)
            </span>
          </FieldLabel>
          <div className="space-y-2">
            {participants.map((uid) => {
              const member = membersForSetup.find((m) => m.userId === uid);
              const isCurrentUser = uid === currentUser?.id;
              return (
                <ParticipantSetupCard
                  key={uid}
                  uid={uid}
                  member={member}
                  isCurrentUser={isCurrentUser}
                  placement={placements[uid] || ""}
                  participantCount={participants.length}
                  usedPlacements={usedPlacements}
                  onPlacementChange={(val) => onPlacementChange(uid, val)}
                  myDecks={[]} // deck handled separately at top of step
                  selectedDeckId=""
                  onDeckChange={null}
                />
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}