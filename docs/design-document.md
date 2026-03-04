# Technical Design Document — Primark SafePass

**Version:** 1.0
**Date:** 2026-03-04
**Source:** Reverse-engineered from codebase

---

## 1. Purpose

Primark SafePass is a browser-based visitor management system built as an MVP for Primark retail and logistics sites. It digitises visitor registration, enforces H&S compliance at check-in, provides real-time visibility of on-site visitors, and supports emergency evacuation procedures. All persistence, real-time messaging, and authentication are delegated to Supabase, eliminating the need for a custom backend server.

---

## 2. Technical Architecture Decisions

| Decision | Choice | Rationale (inferred) |
|----------|--------|----------------------|
| Frontend framework | React 19 | Component-based UI, rich ecosystem, concurrent rendering features |
| Language | TypeScript (strict) | Type safety; `noUnusedLocals` and `noUnusedParameters` catch dead code at compile time |
| Build tool | Vite | Fast HMR and production builds (~2.5s); ES module–native |
| Backend / BaaS | Supabase (PostgreSQL + Realtime) | Eliminates a custom API server; provides REST, Realtime subscriptions, and hosted PostgreSQL from a single service |
| Auth | Custom 4-digit PIN | Simple, tablet-friendly input; no external IdP dependency for MVP; bcrypt hashing preserves security |
| State management | React Context + custom hooks | No Redux or Zustand; global auth/site/evacuation state in `AuthContext`, domain state co-located in hooks. Appropriate for this scale |
| Routing | React Router DOM v7 | Industry-standard SPA routing with nested route support |
| Styling | Tailwind CSS + custom theme | Utility-first for rapid development; brand colours and component sizing defined in `tailwind.config.js` |
| Markdown rendering | react-markdown | H&S content and visit documents are stored as Markdown in the DB; rendered safely via `MarkdownRenderer` component |
| Overdue status | Computed at runtime | Never stored to avoid stale data — `getDisplayStatus()` in `src/lib/utils.ts` derives it from `status=checked_in` + `planned_departure < now()` |
| Escalation | Client-side polling (30s) | Avoids a server-side cron job; runs only for `reception`/`site_admin` users actively using the app. Acceptable for MVP |
| Charts | recharts | Included for potential analytics; currently used for dashboard stat cards only |

---

## 3. Interface Specification

### No REST API

There are no custom REST API endpoints. All data access uses the **Supabase JavaScript client** (`@supabase/supabase-js`) with direct table queries. This library communicates with Supabase's auto-generated PostgREST API and Realtime WebSocket server.

### Supabase Data Access Pattern

```
src/lib/supabase.ts → createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
```

All hooks and screens import `supabase` from this single module. Data access follows these patterns:

| Operation | Pattern |
|-----------|---------|
| Query with joins | `.select('*, visitor:visitors(*), host:members!fkey(*)')` |
| Insert and return | `.insert(payload).select().single()` |
| Update | `.update({...updates, updated_at}).eq('id', id)` |
| Real-time subscribe | `.channel(name).on('postgres_changes', filter, callback).subscribe()` |
| Count query | `.select('id', { count: 'exact', head: true })` |

### Public Route

`GET /self-service/:token` — No authentication. Visitor identified by `visitors.access_token` UUID. If the record does not exist or `is_anonymised = true`, shows an error screen.

---

## 4. Key Workflows

### 4.1 Check-In Wizard

```mermaid
flowchart TD
  A([Reception opens /checkin/:visitId]) --> B{Evacuation active?}
  B -- Yes --> C[Show blocked message]
  B -- No --> D{H&S induction valid?\nwithin 28 days +\ncurrent version}
  D -- Yes --> E{Any unaccepted\ndocuments?}
  D -- No --> F[Step 2: Show induction\ncontent + video]
  F --> G[Visitor completes induction\nInsert induction_records]
  G --> E
  E -- Yes --> H[Step 3: Show documents]
  H --> I[Visitor accepts all\nUpdate visit_documents + visit]
  I --> J[Step 4: Deny-list check]
  E -- No --> J
  J --> K{Visitor on deny list?}
  K -- Yes --> L[Full-screen block\nNotify reception/admin\nAudit log]
  K -- No --> M{visitor_type = internal_staff\nOR valid pre_approval?}
  M -- Yes --> N[access_status = unescorted]
  M -- No --> O[access_status = awaiting_escort]
  N --> P[UPDATE visit: status=checked_in\nactual_arrival, access_status, checked_in_by]
  O --> P
  P --> Q[Notify all host contacts\ncheckin_host_alert]
  O --> R[Also notify: escort_required\nrequires_acknowledgement=true]
  P --> S[Audit log: visit_checked_in]
  S --> T([Check-in complete])
```

### 4.2 Visit Status Lifecycle

```mermaid
stateDiagram-v2
  [*] --> scheduled : Visit created (schedule or walk-in)
  scheduled --> checked_in : Check-in processed by reception\nOR self-check-in (internal_staff)
  scheduled --> cancelled : Cancelled before arrival
  checked_in --> departed : Sign-out processed by reception\nOR self sign-out via portal
  checked_in --> overdue : COMPUTED — planned_departure passed\nnever stored in DB
  overdue --> departed : Sign-out processed
```

### 4.3 Escort Escalation

```mermaid
flowchart TD
  A([30s timer fires — useEscalation]) --> B{User has reception/admin role?}
  B -- No --> Z([Skip])
  B -- Yes --> C[Query: escort_required notifications\nnot acknowledged, not escalated,\nolder than site escalation window]
  C --> D{Any stale notifications?}
  D -- No --> Z
  D -- Yes --> E{Backup contact\ndefined for visit?}
  E -- Yes --> F{Already escalated\nto backup?}
  F -- No --> G[INSERT escalation notification\nto backup contact\nrequires_acknowledgement=true]
  F -- Yes --> H{Backup also unresponsive?}
  H -- Yes --> I[INSERT escalation_reception\nto all reception/admin]
  H -- No --> Z
  E -- No --> I
  G --> J[Mark original as escalated=true]
  I --> J
  J --> K[INSERT audit_trail: escalation_triggered]
  K --> Z
```

### 4.4 Evacuation Flow

```mermaid
flowchart TD
  A([Site admin clicks Emergency Evacuation]) --> B[Confirm dialog]
  B -- Confirmed --> C[getCheckedInVisitors → headcount]
  C --> D[INSERT evacuation_events]
  D --> E[Notify all site staff:\nevacuation_activated]
  E --> F[Audit log: evacuation_activated]
  F --> G[setActiveEvacuation in AuthContext]
  G --> H[Realtime fires across all sessions\nEvacuationBanner shown everywhere\nCheck-ins + sign-outs blocked]
  H --> I([/evacuation screen — headcount register])
  I --> J[Reception checks off visitors]
  J --> K{All accounted for?}
  K -- No --> J
  K -- Yes --> L[Site admin closes evacuation\n+ adds notes]
  L --> M[UPDATE evacuation_events SET closed_at]
  M --> N[Audit log: evacuation_closed]
  N --> O[setActiveEvacuation null\nBanner removed\nNormal operations resume]
```

### 4.5 Pre-Approval → Unescorted Access

```mermaid
flowchart LR
  A[Host requests pre-approval\nfor third-party visitor] --> B[INSERT pre_approvals\nstatus=pending]
  B --> C[Site admin reviews\nin Pre-Approvals screen]
  C -- Approved --> D[UPDATE status=approved\nexpiresAt set]
  C -- Rejected --> E[UPDATE status=rejected]
  D --> F{Next check-in for this visitor}
  F --> G[Query: active approved pre_approval\nfor visitor + site]
  G -- Found --> H[access_status = unescorted]
  G -- Not found --> I[access_status = awaiting_escort]
```

---

## 5. Error Handling

- **User-facing errors:** All async operations wrap failures in `try/catch` and call `toast.error('...')` via `react-hot-toast`. Toasts appear top-right
- **Loading states:** Skeleton placeholder elements (`.skeleton` CSS class) displayed during data fetches
- **Empty states:** `EmptyState` component shown when lists have no results
- **Invalid self-service token:** Shows a dedicated "Link expired or invalid" screen with a `Link2Off` icon
- **Visit not found:** `CheckInScreen` shows a simple "Visit not found" message
- **Form validation:** Inline field-level error messages (shown below inputs) with `text-danger` colour
- **No global error boundary:** Unhandled React errors would result in a blank screen — no `ErrorBoundary` component found in the codebase

---

## 6. Security Considerations

- **PIN storage:** bcrypt hashed (`bcryptjs`). The `pin_hash` field is fetched from Supabase only during login and is immediately discarded after verification — only `SafeUser` (which `Omit`s `pin_hash`) is stored in React state
- **Self-service access:** Token-based (UUID v4). Tokens are not time-limited — the only invalidation is GDPR anonymisation (`is_anonymised = true`). Token rotation is not implemented in the MVP
- **Role guards:** `RoleGuard` component in `src/App.tsx` redirects to `/` if the user's role is insufficient. Feature-level checks use `isHost`, `isReception`, `isSiteAdmin` booleans
- **Row-level security (RLS):** Not visible in schema files — RLS policies may exist in Supabase project settings but are not defined in the checked-in SQL files
- **Input sanitisation:** React's JSX escapes HTML by default. Markdown content is rendered via `react-markdown` which does not execute scripts by default
- **XSS via Markdown:** H&S content and documents are rendered through `MarkdownRenderer`; `react-markdown` does not enable raw HTML by default, so injected `<script>` tags are not executed
- **CORS / API keys:** The Supabase anon key is a public client key. Security relies on Supabase RLS policies (not verified in codebase)
- **Inactivity timeout:** 30-minute automatic logout prevents unattended sessions on shared reception computers

---

## 7. Performance Considerations

- **Supabase indexes** (`supabase/indexes.sql`):
  - `idx_visits_site_status` — fast filtering of active visits by site
  - `idx_visits_site_date` — dashboard date-range queries
  - `idx_visitors_token` — self-service portal token lookup
  - `idx_messages_recipient_user` — unread notification count
  - `idx_deny_list_site` and `idx_deny_list_email` — fast deny-list checks at check-in
  - `idx_evacuation_events_active` (partial index `WHERE closed_at IS NULL`) — active evacuation lookup
- **Realtime subscriptions** replace polling for the dashboard and notification badge, reducing unnecessary queries
- **Escalation uses polling (not Realtime)** — 30-second interval is only active when a reception/admin user is logged in, limiting write frequency
- **Join queries** use Supabase's embedded resource syntax (e.g. `visitor:visitors(*)`) to fetch related data in a single round trip rather than N+1 queries
- **Today's visit filtering** applies `startOfDay`/`endOfDay` bounds client-side to limit the result set
- **State colocation** — hooks hold local state rather than a global store, reducing unnecessary re-renders from unrelated state changes

---

## 8. Known Limitations and Technical Debt

- **No Row-Level Security definitions** in checked-in schema files. The `anon` key has write access to all tables — RLS policies must be configured separately in Supabase to prevent unauthorised direct API calls
- **Escalation is client-dependent** — the 30-second escalation check only runs while a reception/admin user has the app open. If no qualified user is logged in, escalations are delayed until someone opens the app
- **Self-service token is permanent** — there is no token rotation or expiry mechanism. A leaked link remains valid until the visitor is anonymised
- **GDPR request handling is manual** — the portal submits a notification to site admins but does not perform the anonymisation automatically. An admin must navigate to the visitor profile and manually trigger the action
- **`input-base` CSS class** is defined inline in `src/screens/AdminScreen.tsx` (in JSX attribute) rather than as a `@layer components` utility — noted in `MEMORY.md`
- **No error boundary** — unhandled React rendering errors produce a blank screen rather than a graceful degradation
- **Walk-in check-in flow** — the `CheckInScreen` only accepts `visitId` via route param; if walk-in scheduling is done through `ScheduleVisitScreen`, the user must separately navigate to the check-in wizard. No single "schedule and immediately check in" shortcut exists
- **Escalation second-window logic** has a potential bug: `src/hooks/useEscalation.ts:62` compares `alreadyEsc.id` (UUID) as if it were a timestamp to determine the backup escalation cutoff
- **No tests** — no test files found in the repository (no `__tests__`, `*.test.*`, or `*.spec.*` files)

---

## 9. Future Enhancements (identified from code)

- **Email/SMS delivery** — notifications are currently in-app only; the `action_url` field on messages is designed to carry a deep-link for a future external delivery mechanism
- **GDPR automated anonymisation** — the GDPR deletion request currently sends a notification to admins; a direct anonymisation trigger from the visitor portal would remove the manual step
- **Analytics / reporting** — `recharts` is included as a dependency and is partially used; a dedicated reporting screen with visit trends, induction rates, and escort statistics is an obvious extension
- **Role-specific dashboard views** — the dashboard shows different sections based on role, but a more tailored experience per role type could be developed
- **Visitor badge printing** — the evacuation screen already has a print layout; a visitor badge print function at check-in would complement this
- **Token rotation** — self-service access tokens currently never expire; periodic rotation on sign-out would reduce risk from link leakage
- **Multiple sites per user** — the current model assigns each member to exactly one site; cross-site admin capability (beyond the site-admin visit scheduling) is not implemented
