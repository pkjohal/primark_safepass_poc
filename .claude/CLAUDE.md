# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Type-check + production build (tsc -b && vite build)
npm run lint         # ESLint
npm run seed         # Run DB seed script via npx tsx supabase/seed.ts
npx tsc -p tsconfig.app.json --noEmit   # Type-check without building
```

The seed script requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set. It prints visitor self-service URLs on completion.

## Architecture

**Single-page React app with Supabase as the only backend.** There is no API server — all data access goes through the Supabase JS client in `src/lib/supabase.ts`.

### Auth & Roles

`src/context/AuthContext.tsx` is the auth hub. Login fetches a `users` row, verifies the 4-digit PIN with bcryptjs (`src/lib/auth.ts`), then stores only `SafeUser` (= `Omit<User, 'pin_hash'>`) in React state — `pin_hash` is never held in memory after verification.

Role hierarchy (`src/lib/permissions.ts`): `host (1) < reception (2) < site_admin (3)`. Use `hasMinRole(role, required)` for access checks.

`AuthContext` also:
- Starts Supabase Realtime subscriptions for unread notifications and active evacuation events
- Runs a 30-minute inactivity timer (resets on mouse/key/touch events) that auto-logs out

### Routing

`src/App.tsx` — all routes except `/login` and `/self-service/:token` are wrapped in `ProtectedLayout` (redirects to `/login` if unauthenticated) and `RoleGuard` (renders a "not authorised" message if role insufficient). The self-service portal is fully public.

### Data layer (hooks in `src/hooks/`)

Each hook is a thin wrapper over Supabase queries. Key patterns:
- `useVisits` maintains a Realtime subscription on the `visits` table filtered by `site_id` and re-fetches on changes.
- `useNotifications` subscribes per `recipient_user_id` (visitor-id or user-id).
- `useEvacuation` subscribes to `evacuation_events` for the current site.
- `useEscalation` uses `setInterval` (30 s) — not Realtime — to poll for overdue escort notifications and insert escalation notifications. Only active for reception/site_admin.

### Visit status

`visit.status` values stored in DB: `scheduled | checked_in | departed | cancelled`. The `overdue` status is **never stored** — it is computed at display time by `getDisplayStatus()` in `src/lib/utils.ts` (checked_in + `planned_departure < now()` = overdue). Use `getDisplayStatus` everywhere you need to show status to the user.

### Check-in flow (`src/screens/CheckInScreen.tsx`)

5-step wizard: confirm details → H&S induction (skip if valid record ≤28 days) → document acceptance (skip if none pending) → deny-list check (full-screen block if matched) → access determination (internal_staff → unescorted; third_party → check pre_approvals → unescorted or awaiting_escort). All steps write to `audit_log`.

### Evacuation mode

`activeEvacuation` in `AuthContext` gates check-in and sign-out writes. `EvacuationScreen` shows a full-screen red overlay with real-time headcount. Closing an evacuation event logs a full incident timeline.

### Self-service portal (`src/screens/SelfServiceScreen.tsx`)

Token-based, no login. Visitor identified via `visitors.access_token` UUID in the URL (`/self-service/:token`). Supports: view/edit profile, upcoming visits, H&S induction, document acceptance, self check-in (internal_staff only), sign-out, notifications, GDPR data/deletion requests.

### Content model

H&S induction content and visit documents are stored as Markdown in the DB. Always render through `<MarkdownRenderer>` (`src/components/ui/MarkdownRenderer.tsx`), which wraps `react-markdown`.

### Audit logging

Every significant write calls `useAuditLog().log(action, entityType, entityId, userId, metadata?)`. Action and entity type strings are defined as union types in `src/lib/constants.ts`.

## TypeScript strictness

`tsconfig.app.json` enables `noUnusedLocals` and `noUnusedParameters`. Prefix intentionally unused parameters with `_` (e.g. `_name`). Remove unused imports immediately — the build will fail otherwise.
