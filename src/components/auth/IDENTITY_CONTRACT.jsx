# PodArena Identity Contract
## Version 2.0 — Locked

This is the authoritative source of truth for all identity-related field naming
and usage patterns in PodArena. Every new feature must follow this contract.

---

## Two Identity Types

### 1. Auth User ID  (`authUserId`)
- **Value**: The auth provider UID from `base44.auth.me().id` (Supabase user.id)
- **Source**: `profile.user_id` — stamped at registration, never changes
- **In context**: `useAuth().authUserId`
- **Used for**: RLS permission checks, backend record ownership, *_user_id fields
- **NEVER use as**: a display key, a join key, or to look up profiles

### 2. Profile ID  (`profileId` / `currentUser.id`)
- **Value**: The Profile entity UUID (the row's `.id` field from the database)
- **Source**: `profile.id` in the Profile entity table
- **In context**: `useAuth().profileId`  ← explicit alias  OR  `useAuth().currentUser.id`
- **Used for**: all app-level joins, UI display, stats, search, deck ownership, leaderboard
- **NEVER use as**: an RLS field, an approver_user_id, or any *_user_id field

---

## Field Naming Rules

| Field pattern    | Must contain   |
|------------------|----------------|
| `*_user_id`      | Auth User ID   |
| `*_profile_id`   | Profile ID     |
| `created_by_*`   | see entity     |

---

## Entity Field Audit (Locked)

### Profile
- `user_id` = Auth User ID (stamped once at registration)
- `id` = Profile ID (entity UUID, used as join key everywhere)

### POD
- `created_by_user_id` = Auth User ID
- `created_by_profile_id` = Profile ID
- `admin_user_id` = Auth User ID
- `admin_profile_id` = Profile ID

### PODMembership
- `user_id` = Auth User ID ← RLS field
- `profile_id` = Profile ID
- `invited_by_user_id` = Auth User ID
- `invited_by_profile_id` = Profile ID

### Game
- `created_by_user_id` = Auth User ID
- `created_by_profile_id` = Profile ID

### GameParticipant
- `participant_user_id` = Auth User ID ← RLS field
- `participant_profile_id` = Profile ID ← join/display key

### GameApproval
- `approver_user_id` = Auth User ID ← RLS field
- `approver_profile_id` = Profile ID
- `requester_user_id` = Auth User ID
- `requester_profile_id` = Profile ID

### Notification
- `actor_user_id` = Auth User ID
- `recipient_user_id` = Auth User ID ← RLS field, used for inbox filtering

### Deck
- `owner_id` = Profile ID ← note: no _user_id/_profile_id suffix, always Profile ID

### ⚠️ LEGACY EXCEPTION — LeagueMember
- `user_id` = **Profile ID** ← intentional legacy exception, NOT Auth User ID
- This is a known naming inconsistency from the original league system.
- Do NOT migrate this field without a full data migration.
- All new entities must follow the contract (Auth User ID in *_user_id fields).

---

## AuthContext — What to Destructure

```js
const { currentUser, authUserId, profileId } = useAuth();
// currentUser = full Profile entity record
// authUserId  = Auth User ID (profile.user_id) — use for *_user_id fields / RLS
// profileId   = currentUser?.id shorthand — use for joins, display, deck lookups
```

---

## Common Mistakes to Avoid

❌ `filter({ user_id: currentUser.id })` on PODMembership/GameParticipant/GameApproval
   → WRONG: currentUser.id is Profile ID; these fields expect Auth User ID
   → FIX: use `authUserId` from context

❌ `filter({ profile_id: authUserId })`
   → WRONG: profile_id fields expect Profile ID
   → FIX: use `currentUser.id` or `profileId` from context

❌ `await base44.auth.me()` inside page render / service calls
   → WRONG: creates redundant network calls on every render
   → FIX: read `authUserId` from `useAuth()` — it's already resolved

❌ Naming a local variable `userId` without a type qualifier
   → AMBIGUOUS: always name it `authUserId` or `profileId` explicitly

---

## Query Contract Per Entity

| Entity            | Filter field            | ID type used      |
|-------------------|-------------------------|-------------------|
| PODMembership     | `user_id`               | Auth User ID      |
| GameParticipant   | `participant_user_id`   | Auth User ID      |
| GameApproval      | `approver_user_id`      | Auth User ID      |
| Notification      | `recipient_user_id`     | Auth User ID      |
| Deck              | `owner_id`              | Profile ID        |
| LeagueMember      | `user_id`               | Profile ID ⚠️ LEGACY |
| Profile           | `user_id`               | Auth User ID      |
| Profile           | `id`                    | Profile ID        |