# SafePass MVP — Implementation Plan

**Project:** Primark SafePass — Visitor Registration & Access Management
**Spec Version:** Draft v2.0 | February 2026
**Target:** Single pilot site, React SPA + Supabase

---

## Overview

SafePass is built as a React + TypeScript SPA backed by Supabase (Postgres + Auth + Realtime). There is no separate API server — all data access goes through the Supabase JS client. The build is split into six phases, ordered so that every phase produces something runnable and testable before the next begins.

---

## Phase 1 — Project Scaffold & Infrastructure

**Goal:** Working dev environment with database, routing skeleton, and auth context in place.

### 1.1 Scaffold the project

```
npm create vite@latest primark-safepass -- --template react-ts
cd primark-safepass
npm install
```

Install dependencies:
```
npm install @supabase/supabase-js react-router-dom react-markdown bcryptjs
npm install -D tailwindcss postcss autoprefixer @types/bcryptjs
npx tailwindcss init -p
```

Install charting (ready for dashboard stats):
```
npm install recharts
```

### 1.2 Tailwind configuration

Apply the Primark brand theme extensions to `tailwind.config.js` exactly as specified in Section 4.4 of the spec — colours, fontFamily, minHeight, boxShadow.

Add `@tailwind` directives to `src/index.css`. Import Inter font via a `<link>` in `index.html`.

### 1.3 Supabase project

- Create a new Supabase project (free tier is sufficient for MVP)
- Note the project URL and anon key
- Create `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Create `.env.example` with placeholder values

Create `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### 1.4 Database setup

Create `/supabase/schema.sql` — all CREATE TABLE statements from Section 5.1 in dependency order:
1. `sites`
2. `users`
3. `visitors`
4. `visits`
5. `visit_host_contacts`
6. `visit_documents`
7. `induction_records`
8. `pre_approvals`
9. `deny_list`
10. `notifications`
11. `evacuation_events`
12. `audit_log`

Create `/supabase/indexes.sql` — all CREATE INDEX statements from Section 5.6.

Create `/supabase/seed.ts` — a Node script that uses `bcryptjs` to hash PINs (1234, 5678, 9012, 3456) at runtime and inserts all seed data via the Supabase client. This avoids embedding pre-computed bcrypt hashes in SQL and makes the seed PINs immediately testable. Seed data covers: 1 site, 4 users, 4 visitors, 4 visits (mixed statuses), 1 pre-approval, 1 deny list entry, sample notifications, visit host contacts.

Run order: `schema.sql` → `indexes.sql` → `seed.ts`

### 1.5 Core library files

Create these files in `src/lib/`:

| File | Contents |
|------|----------|
| `types.ts` | All TypeScript interfaces from Section 8 |
| `constants.ts` | `AuditAction`, `AuditEntityType`, `NotificationType` types + values from Section 9 |
| `permissions.ts` | `ROLE_LEVELS` map, `hasMinRole()` function |
| `auth.ts` | `verifyPin(plain, hash)` wrapper around `bcryptjs.compare()` and `hashPin(plain)` wrapper around `bcryptjs.hash()` |
| `utils.ts` | `formatDate(date, style)`, `getDisplayStatus(visit)` |

### 1.6 Auth context

Create `src/context/AuthContext.tsx` implementing the `AuthContext` interface from Section 11:
- State: `site`, `user` (SafeUser — no pin_hash), `activeEvacuation`, `unreadNotificationCount`
- `login(username, pin)`: fetch user by username, call `verifyPin()`, store in state on success, return boolean
- `logout()`: clear all state
- `isHost`, `isReception`, `isSiteAdmin` computed from role using `hasMinRole()`
- Supabase Realtime subscription on mount: watch `notifications` (recipient = current user) for unread count; watch `evacuation_events` (site_id, closed_at IS NULL) for active evacuation banner
- Session timeout: `useEffect` sets a 30-minute inactivity timer that calls `logout()` on expiry; reset on any user interaction

Create `src/hooks/useAuth.ts` — re-exports `useContext(AuthContext)` with a null-check guard.

### 1.7 Routing skeleton

Create `src/App.tsx` with React Router v6 `<Routes>`:

```
/login                → LoginScreen
/self-service/:token  → SelfServiceScreen (no auth)
/* (authenticated)    → ProtectedLayout wrapping all remaining routes:
  /                   → HomeScreen
  /visitors           → VisitorSearchScreen
  /visitors/new       → VisitorFormScreen
  /visitors/:id       → VisitorProfileScreen
  /schedule           → ScheduleVisitScreen
  /checkin/:visitId   → CheckInScreen
  /inbox              → InboxScreen
  /pre-approvals      → PreApprovalScreen
  /deny-list          → DenyListScreen       (site_admin only)
  /site-config        → SiteConfigScreen     (site_admin only)
  /evacuation         → EvacuationScreen     (site_admin only)
  /admin              → AdminScreen          (site_admin only)
```

`ProtectedLayout` component: checks auth context, redirects to `/login` if not authenticated; checks `hasMinRole()` for role-protected routes; renders `<NavBar>`, `<EvacuationBanner>` (when active), `<Outlet>`, `<BottomNav>`.

**Phase 1 Deliverable:** App runs locally, navigates to `/login`, all routes defined (screens are stubs), Supabase connected, database seeded.

---

## Phase 2 — Login & Navigation Shell

**Goal:** Working PIN login, nav bar, bottom nav, evacuation banner — the persistent chrome that wraps every screen.

### 2.1 LoginScreen (`src/screens/LoginScreen.tsx`)

- Centred card on `bg-light-grey`
- "PRIMARK" brand text (uppercase, tracking-widest, font-bold, text-primark-blue, text-2xl)
- "SafePass" subtitle in text-mid-grey
- Site selector dropdown (active sites, pre-selected for single-site MVP)
- Username text input
- `<PinPad>` component (see below)
- On correct PIN: `auth.login()` → navigate to `/`
- On incorrect: shake animation (CSS keyframe on the card), "Incorrect PIN" message, clear PIN

### 2.2 PinPad component (`src/components/ui/PinPad.tsx`)

- 3×4 numpad grid (1–9, 0, backspace, enter)
- Digits render as filled circles (●) — never show actual digits
- `onComplete(pin: string)` callback when 4 digits entered
- `error` prop triggers red border + shake

### 2.3 NavBar (`src/components/layout/NavBar.tsx`)

- 64px height, `bg-navy`
- Left: "PRIMARK" text (text-primark-blue, uppercase, tracking-[0.15em], font-bold) + "SafePass" subtitle (text-mid-grey)
- Right: user name + role badge (colour by role) + site name + notification bell (with unread count badge from auth context) + logout button
- Notification bell navigates to `/inbox`

### 2.4 BottomNav (`src/components/layout/BottomNav.tsx`)

- Fixed bottom bar on mobile/tablet
- Items: Home (`/`), Visitors (`/visitors`), Inbox (`/inbox`), Admin (`/admin` — site_admin only)
- Active item highlighted with text-primark-blue

### 2.5 EvacuationBanner (`src/components/layout/EvacuationBanner.tsx`)

- Full-width red banner, `bg-danger`, white text
- Text: "⚠ EVACUATION IN PROGRESS — Check-ins and sign-outs are suspended"
- Link to `/evacuation`
- Rendered at the top of `ProtectedLayout` when `auth.activeEvacuation` is non-null

### 2.6 PageHeader, ConfirmDialog, EmptyState, StatCard, StatusPill

Build foundational UI components:

- **`<PageHeader>`** — title, optional subtitle, optional back button, optional right-side action buttons
- **`<ConfirmDialog>`** — modal overlay, title, message, confirm/cancel buttons, `variant` prop for danger (red confirm button) vs default
- **`<EmptyState>`** — centred icon + heading + message + optional CTA button
- **`<StatCard>`** — large number + label + colour accent + optional icon. Used on the dashboard.
- **`<StatusPill>`** — rounded-full pill with colour variants: `scheduled` (grey), `checked_in_unescorted` (green), `checked_in_awaiting_escort` (amber), `overdue` (red), `departed` (blue), `cancelled` (grey outline)

**Phase 2 Deliverable:** Login works with PIN pad, session persists, nav bar shows role and site, evacuation banner wires up to Supabase Realtime.

---

## Phase 3 — Dashboard & Visitor Management

**Goal:** Home screen operational for reception, visitor search, profile view, and visit scheduling.

### 3.1 Hooks

**`useVisits.ts`** — queries `visits` joined with `visitors` and `users` for the current site. Supabase Realtime subscription on `visits` (site_id = current site) refreshes data automatically. Exposes: `todaysVisits`, `checkedInVisits`, `awaitingEscortVisits`, `overdueVisits`.

**`useVisitors.ts`** — search visitors by name/email, create visitor, get visitor by ID.

**`useInduction.ts`** — check if a visitor has a valid induction record for the current site/version; create induction record.

### 3.2 HomeScreen (`src/screens/HomeScreen.tsx`)

**Top — Summary stats (4 `<StatCard>` components):**

| Stat | Query | Colour logic |
|------|-------|-------------|
| Expected Today | `planned_arrival` date = today | primark-blue |
| Currently On-Site | `status = 'checked_in'` | amber if > 0, green if 0 |
| Awaiting Escort | `access_status = 'awaiting_escort'` | red if > 0, green if 0 |
| Overdue | `checked_in` AND `planned_departure < now()` | red if > 0, green if 0 |

**Middle — Expected Visitors List:**
- All today's `scheduled` visits sorted by `planned_arrival`
- `<SearchBar>` with 300ms debounce
- `<VisitorRow>` per visit: time, name, company, visitor type pill, host name, purpose, pre-arrival status icons (induction ✓/✗, docs ✓/✗)
- Hosts only see their own visits
- Tap row → `/checkin/:visitId`

**Middle — Live Status Board (reception + site_admin only):**
- Grouped sections: Pending | Active Unescorted | Awaiting Escort | Overdue | Departed (collapsible)
- Awaiting Escort section shows host name, acknowledgement status, elapsed wait time
- Realtime subscription keeps board live

**Bottom — Quick Actions:**
- "Register Walk-In" button (reception + site_admin) → opens walk-in flow modal or navigates to `/visitors/new?walkin=true`
- "Emergency Evacuation" button (red, site_admin only) → `<ConfirmDialog>` → activates evacuation → navigate to `/evacuation`

### 3.3 VisitorRow (`src/components/visitors/VisitorRow.tsx`)

Reusable row component used in the expected visitors list and search results.

### 3.4 SearchBar + VisitorSearchScreen

**`<SearchBar>`** — debounced text input, 300ms.

**`VisitorSearchScreen`** (`/visitors`) — search existing visitors by name or email, list results, "Create New Visitor" button. Tap a visitor → `/visitors/:id`.

### 3.5 VisitorForm (`src/components/visitors/VisitorForm.tsx`)

Form fields: name (required), email (required), phone, company, visitor type (Internal Staff / Third Party). Used in both create (`/visitors/new`) and edit contexts.

Duplicate detection: on submit, query `LOWER(name) + LOWER(email)` against existing non-anonymised visitors. If matched, show warning with option to use existing profile or override and create new.

### 3.6 VisitorProfileScreen (`src/screens/VisitorProfileScreen.tsx`)

- Full profile details (read-only)
- Visit history table: date, site, purpose, host, status pill, induction ✓/✗, docs ✓/✗
- Pre-approval status badge for current site
- Deny list red banner (if active entry exists)
- "Anonymise Visitor" button (site_admin only) → `<ConfirmDialog>` → calls anonymise logic → shows confirmation

### 3.7 ScheduleVisitScreen (`src/screens/ScheduleVisitScreen.tsx`)

- Visitor search/autocomplete or "Create New Visitor" button
- Site (pre-filled, read-only for MVP)
- `<DateTimePicker>` for planned arrival and departure
- Purpose free-text input
- Host contacts: primary (pre-filled with current user), optional backup dropdown (all active users at site)
- Document attachment: "Attach NDA/Document" button opens modal with document name field + Markdown textarea. Multiple documents supported.
- "Schedule Visit" button → inserts `visit` + `visit_host_contacts` + `visit_documents` rows → inserts `visit_scheduled` notification for visitor (including `/self-service/{access_token}` action_url) → audit_log entry → navigate to dashboard

### 3.8 DateTimePicker (`src/components/ui/DateTimePicker.tsx`)

HTML `<input type="datetime-local">` wrapped with Primark styling and a label. Value stored as ISO 8601 string.

**Phase 3 Deliverable:** Reception can see today's visitor list, search for visitors, create profiles, schedule visits, view profiles. Dashboard stats update in real time.

---

## Phase 4 — Check-In Flow & Notifications

**Goal:** Full check-in flow for all visitor types, host notification and escalation, departure.

### 4.1 Hooks

**`useNotifications.ts`** — fetch notifications for current user (or visitor), mark as read, acknowledge. Supabase Realtime subscription for new notifications → unread count + toast.

**`useEscalation.ts`** — client-side polling every 30 seconds. On each tick: query for `escort_required` notifications where `requires_acknowledgement = true`, `acknowledged_at IS NULL`, `escalated = false`, and `created_at < now() - site.notification_escalation_minutes`. Triggers escalation by inserting a new `escalation` notification to the backup contact (or `escalation_reception` if no backup) and marking the original notification `escalated = true`. Logs to `audit_log`. Only runs when a reception/admin user is on the dashboard.

**`useDenyList.ts`** — expose deny list check function implementing the matching logic from Section 5.4 (visitor_id match first, then LOWER(email) fallback).

### 4.2 InductionViewer (`src/components/visits/InductionViewer.tsx`)

- Renders site H&S content:
  - `<iframe>` for `hs_video_url` (if set)
  - Markdown content rendered via `<MarkdownRenderer>` (react-markdown wrapper)
- Checkbox: "I confirm I have read and understood the Health & Safety induction"
- "Complete Induction" button → inserts `induction_records` row, updates `visits.induction_completed`, logs `induction_completed` to `audit_log`

### 4.3 DocumentViewer (`src/components/visits/DocumentViewer.tsx`)

- For each unaccepted `visit_document`:
  - Document name as heading
  - Markdown content rendered via `<MarkdownRenderer>`
  - "I accept the terms of this document" checkbox
- "Accept All" button (enabled when all checkboxes ticked) → updates all `visit_documents.accepted` + `accepted_at`, updates `visits.documents_accepted`, logs `document_accepted` to `audit_log`

### 4.4 MarkdownRenderer (`src/components/ui/MarkdownRenderer.tsx`)

Thin wrapper around `react-markdown` with Primark-themed `components` prop applied — headings use `text-navy`, body uses `text-charcoal`, links use `text-primark-blue`.

### 4.5 CheckInScreen — 5-step flow (`src/screens/CheckInScreen.tsx`)

The screen manages a `step` state (1–5) progressing linearly. Reception triggers it from the dashboard; internal staff trigger it from their self-service screen.

**Step 1 — Confirm Details**
- Display: visitor name, company, type, purpose, host contacts, planned arrival/departure
- "Confirm & Continue" button

**Step 2 — H&S Induction (conditional)**
- Check `induction_records` for valid record: `visitor_id + site_id + content_version = site.hs_content_version + completed_at > now() - 28 days`
- If valid record found: show green tick "H&S induction current (completed [date])", auto-advance
- If not: render `<InductionViewer>`, advance only on completion

**Step 3 — Document Acceptance (conditional)**
- If `visit_documents` exist with `accepted = false`: render `<DocumentViewer>`, advance only on "Accept All"
- If all accepted (or no documents): auto-advance

**Step 4 — Deny List Check (automatic, no UI step shown unless blocked)**
- Call deny list check logic from `useDenyList`
- If matched: replace screen with full-width red alert showing visitor name, reason; send `deny_list_alert` notification to all reception + site_admin at site; log `deny_list_check_blocked` to `audit_log`; provide "Return to Dashboard" button only
- If not matched: auto-advance silently

**Step 5 — Access Determination & Completion**
- Determine `access_status`:
  - `internal_staff` → `'unescorted'`
  - `third_party`: query `pre_approvals` (status = 'approved', expires_at > now()) → `'unescorted'` if found, else `'awaiting_escort'`
- Update `visit`: `status = 'checked_in'`, `actual_arrival = now()`, `access_status`, `checked_in_by = current user`
- Insert `checkin_host_alert` notification to all `visit_host_contacts`
- If `awaiting_escort`: insert `escort_required` notification (requires_acknowledgement = true)
- If active evacuation event: block with red alert — "Evacuation in progress — check-ins are suspended"
- Log `visit_checked_in` to `audit_log`
- Show green confirmation screen: "[Name] checked in successfully" + large access status badge

### 4.6 Walk-In Flow

Walk-in entry point is the "Register Walk-In" button on the dashboard. Reuses existing components:

1. `<SearchBar>` → search for existing visitor profile
2. If found: create new visit against existing profile → proceed to CheckInScreen
3. If not found: render `<VisitorForm>` (create new profile) → then create visit → proceed to CheckInScreen
4. Host selection dropdown (all active users at site) — select intended host
5. On check-in: insert `walk_in_host_confirm` notification to selected host (informational, no blocking)

### 4.7 InboxScreen (`src/screens/InboxScreen.tsx`)

- List all notifications for current user, newest first
- `<NotificationRow>` per item: type icon, title, body preview, timestamp, read/unread dot
- For `escort_required` with `acknowledged_at IS NULL`: "Acknowledge — I'm coming to collect" button → sets `acknowledged_at = now()`, logs `notification_acknowledged` to `audit_log`
- Tap notification: open full detail panel, mark `is_read = true`
- Notifications with `action_url`: show "View" link

### 4.8 NotificationRow (`src/components/notifications/NotificationRow.tsx`)

Reusable row with: icon by `notification_type`, title, truncated body, relative timestamp, read indicator.

### 4.9 Departure

**Internal staff:** "Sign Out" button on SelfServiceScreen → sets `visit.status = 'departed'`, `actual_departure = now()`. Blocked if active evacuation.

**Third party / manual:** Reception uses "Sign Out" action on the live status board row → same update. Blocked if active evacuation.

Overdue display: Dashboard query filters `status = 'checked_in' AND planned_departure < now()` and shows these in the red "Overdue" section. `visit.status` remains `'checked_in'` in the DB.

**Phase 4 Deliverable:** Full check-in flow operational for all visitor types including walk-in. Deny list blocks check-in. Host notifications sent. Escalation polling runs on dashboard. Departure works for both visitor types.

---

## Phase 5 — Admin Functions

**Goal:** Pre-approval workflow, deny list management, site config, evacuation mode, user management.

### 5.1 Hooks

**`usePreApprovals.ts`** — CRUD for pre-approvals, filtered by role (hosts see own, site_admin sees all).

**`useEvacuation.ts`** — activate, close evacuation events; real-time list of checked-in visitors.

**`useAuditLog.ts`** — fetch audit log entries by entity type + entity ID.

### 5.2 PreApprovalScreen (`src/screens/PreApprovalScreen.tsx`)

**Host view:**
- Search/select a third-party visitor
- Justification field
- "Request Unescorted Access" button → inserts `pre_approvals` row (status = 'pending') → sends `pre_approval_request` notification to site_admin → logs to audit_log
- Table of own pending/historical requests with status pills

**Site admin view (all requests):**
- Pending requests table: visitor, company, requested by, date
- Per row: "Approve" button (sets expiry = now + `site.pre_approval_default_days`) | "Reject" button (mandatory reason input via `<ConfirmDialog>` with text field)
- Active approvals table: revoke button (immediate, confirmation required)
- `<AuditTimeline>` for all pre-approval events

### 5.3 DenyListScreen (`src/screens/DenyListScreen.tsx`) — site_admin only

- Table: name, email, reason, status pill (active/expired), expiry, added by, date
- "Add to Deny List" button → modal:
  - Visitor search autocomplete (links `visitor_id` if found)
  - Or manual name + email entry
  - Reason (required)
  - Permanent toggle OR expiry date picker
- Edit row: change reason, expiry
- Remove row: soft-delete (`is_active = false`) with `<ConfirmDialog>`
- All actions logged to `audit_log`

### 5.4 SiteConfigScreen (`src/screens/SiteConfigScreen.tsx`) — site_admin only

- H&S content section:
  - Video URL text input
  - Markdown textarea for written content (with `<MarkdownRenderer>` preview panel)
  - "Save & Publish" button → `<ConfirmDialog>` warning: "This will require ALL visitors to re-complete their induction. Are you sure?" → increments `hs_content_version`, saves content → logs `hs_content_published` to `audit_log`
- Notification settings: escalation timeout (minutes) number input, pre-approval default days number input
- Site details (read-only for MVP): name, code, address

### 5.5 EvacuationScreen (`src/screens/EvacuationScreen.tsx`) — site_admin only

- Activation: "Emergency Evacuation" button on dashboard → `<ConfirmDialog>` → inserts `evacuation_events` row with `headcount_at_activation` = current checked-in count → sends `evacuation_activated` notification to all on-site users → logs `evacuation_activated` to `audit_log`
- Full-screen: `bg-alert-red`, white text, `animate-pulse` border, large warning icon
- Header: "EMERGENCY EVACUATION ACTIVE"
- Headcount bar: "[X] visitors on-site | [Y] accounted for"
- Visitor list grouped by type, each row: name, company, host, check-in time, "Mark Accounted" checkbox → updates `headcount_accounted` in real time
- Supabase Realtime subscription on `evacuation_events` detects closure by another admin
- Print button: `window.print()` — print-only CSS hides nav, shows clean headcount list formatted for A4
- "Close Evacuation" button → `<ConfirmDialog>` → sets `closed_at = now()`, `closed_by = current user` → logs `evacuation_closed` with full incident timeline to `audit_log`

### 5.6 AdminScreen (`src/screens/AdminScreen.tsx`) — site_admin only

**Users tab:**
- Table: name, username, email, role badge, active/inactive status, created date
- "Add User" button → modal form: name (≥2 chars), username (unique), email (optional, validated), role dropdown, 4-digit PIN (entered twice for confirmation) → hashes PIN with `hashPin()` → inserts user → logs `user_created`
- "Edit" per row → modal: edit name, email, role, reset PIN
- "Deactivate"/"Activate" toggle → `<ConfirmDialog>` → updates `is_active` → logs `user_deactivated` / `user_updated`
- Guard: cannot deactivate the last `site_admin` (check count before showing toggle)

Validation rules:
- Unique username: query on submit, show inline error if taken
- PINs: exactly 4 digits, match on confirmation
- Names: ≥ 2 characters
- Email: format validated if provided

### 5.7 AuditTimeline (`src/components/admin/AuditTimeline.tsx`)

Chronological list of `audit_log` entries for a given `entity_type` + `entity_id`. Each entry shows: action constant (formatted as a readable label), user name, timestamp, JSON details (expandable).

**Phase 5 Deliverable:** All admin functions working. Pre-approval workflow complete. Evacuation mode operational. User management functional with bcrypt-hashed PINs.

---

## Phase 6 — Visitor Self-Service & Polish

**Goal:** Self-service screen, GDPR anonymisation, final QA pass, README.

### 6.1 SelfServiceScreen (`src/screens/SelfServiceScreen.tsx`)

Route: `/self-service/:token` — no login required.

On mount: query `visitors` by `access_token`. If no result or `is_anonymised = true` → render error page: "This link has expired or is invalid." with no further navigation.

If found, render:
- Profile section (read-only): name, email, company, visitor type
- Phone number: inline edit with save button (updates `visitors.phone`)
- Upcoming scheduled visits (from `visits` where `visitor_id` matches, `status = 'scheduled'`)
- In-app notifications (from `notifications` where `recipient_visitor_id` matches)
- **Pending actions section:**
  - Pending induction: check if any upcoming visit requires induction → "Complete H&S Induction" button → opens `<InductionViewer>`
  - Pending documents: check if any `visit_documents` have `accepted = false` → "Review Documents" button → opens `<DocumentViewer>`
  - Internal staff check-in: if `visitor_type = 'internal_staff'` and a scheduled visit exists for today → "Check In" button → triggers Steps 2–5 of check-in flow inline on this screen
  - Sign out: if visitor has a `checked_in` visit and no active evacuation → "Sign Out" button → sets `status = 'departed'`, `actual_departure = now()`
- **GDPR section:**
  - "Request My Data" link → simple form (message textarea) → creates notification to `site_admin` with request details
  - "Request Data Deletion" link → same mechanism, different notification type

### 6.2 GDPR Anonymisation (site_admin, VisitorProfileScreen)

"Anonymise Visitor" button → `<ConfirmDialog>` → updates visitor record:
```
name = 'Anonymised Visitor'
email = 'anonymised-{id}@deleted.local'
phone = NULL
company = NULL
is_anonymised = true
```
Visit records, induction records, audit logs retained with anonymised visitor ID. Logs `visitor_anonymised` to `audit_log`.

### 6.3 Loading & Error States

- All data-fetching components render skeleton loaders (grey animated shimmer blocks matching the layout) while loading
- Network failure: `react-hot-toast` (or equivalent) toast notification with retry button
- Empty states: `<EmptyState>` component with appropriate message on every list view

### 6.4 Session Timeout

30-minute inactivity timer in `AuthContext`. On any window event (`mousemove`, `keydown`, `click`, `touchstart`), reset the timer. On expiry, call `logout()` and navigate to `/login`.

### 6.5 README

`README.md` covering:
1. One-paragraph overview of SafePass
2. Prerequisites (Node 18+, npm, Supabase account)
3. Setup steps: clone → `npm install` → create Supabase project → run SQL files → run seed script → set env vars → `npm run dev`
4. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. Default logins: `claire.m/1234` (reception), `sean.o/5678` (host), `mary.f/9012` (host), `pat.k/3456` (site_admin)
6. Self-service testing: query `SELECT access_token FROM visitors WHERE email = '...'` in Supabase dashboard → visit `http://localhost:5173/self-service/{token}`
7. Tech stack summary
8. Folder structure
9. MVP scope & known limitations (from Section 17 of spec)

**Phase 6 Deliverable:** Full MVP feature-complete. Self-service works for internal staff check-in. GDPR anonymisation working. README complete. All flows testable from seed data on first launch.

---

## File Structure

```
/
├── index.html
├── package.json
├── tailwind.config.js          ← Primark brand theme extensions
├── vite.config.ts
├── tsconfig.json
├── .env                        ← not committed
├── .env.example
├── README.md
├── /supabase
│   ├── schema.sql
│   ├── indexes.sql
│   └── seed.ts                 ← Node script, bcryptjs PIN hashing
└── /src
    ├── main.tsx
    ├── App.tsx                 ← Router + ProtectedLayout
    ├── index.css
    ├── /context
    │   └── AuthContext.tsx
    ├── /hooks
    │   ├── useAuth.ts
    │   ├── useVisitors.ts
    │   ├── useVisits.ts
    │   ├── useNotifications.ts
    │   ├── usePreApprovals.ts
    │   ├── useDenyList.ts
    │   ├── useEvacuation.ts
    │   ├── useInduction.ts
    │   ├── useAuditLog.ts
    │   └── useEscalation.ts
    ├── /lib
    │   ├── supabase.ts
    │   ├── types.ts
    │   ├── constants.ts
    │   ├── permissions.ts
    │   ├── auth.ts
    │   └── utils.ts
    ├── /components
    │   ├── /ui
    │   │   ├── StatCard.tsx
    │   │   ├── StatusPill.tsx
    │   │   ├── PinPad.tsx
    │   │   ├── ConfirmDialog.tsx
    │   │   ├── SearchBar.tsx
    │   │   ├── EmptyState.tsx
    │   │   ├── DateTimePicker.tsx
    │   │   └── MarkdownRenderer.tsx
    │   ├── /layout
    │   │   ├── NavBar.tsx
    │   │   ├── BottomNav.tsx
    │   │   ├── PageHeader.tsx
    │   │   └── EvacuationBanner.tsx
    │   ├── /visitors
    │   │   ├── VisitorRow.tsx
    │   │   ├── VisitorProfile.tsx
    │   │   └── VisitorForm.tsx
    │   ├── /visits
    │   │   ├── VisitForm.tsx
    │   │   ├── CheckInFlow.tsx
    │   │   ├── InductionViewer.tsx
    │   │   └── DocumentViewer.tsx
    │   ├── /notifications
    │   │   ├── NotificationRow.tsx
    │   │   └── InboxList.tsx
    │   ├── /evacuation
    │   │   ├── EvacuationScreen.tsx
    │   │   └── EvacuationList.tsx
    │   └── /admin
    │       ├── UserManagement.tsx
    │       ├── SiteConfig.tsx
    │       ├── DenyListManager.tsx
    │       ├── PreApprovalManager.tsx
    │       └── AuditTimeline.tsx
    └── /screens
        ├── LoginScreen.tsx
        ├── HomeScreen.tsx
        ├── VisitorSearchScreen.tsx
        ├── VisitorProfileScreen.tsx
        ├── ScheduleVisitScreen.tsx
        ├── CheckInScreen.tsx
        ├── InboxScreen.tsx
        ├── SelfServiceScreen.tsx
        ├── PreApprovalScreen.tsx
        ├── DenyListScreen.tsx
        ├── SiteConfigScreen.tsx
        ├── EvacuationScreen.tsx
        └── AdminScreen.tsx
```

---

## Build Order Summary

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| 1 | Scaffold, DB, auth context, routing | App runs, DB seeded, routes defined |
| 2 | Login, nav chrome, core UI components | PIN login works, nav bar/banner live |
| 3 | Dashboard, visitor management, scheduling | Reception can manage visits end-to-end |
| 4 | Check-in flow, notifications, escalation, departure | Full operational check-in for all types |
| 5 | Pre-approvals, deny list, evacuation, admin | All admin functions complete |
| 6 | Self-service, GDPR, polish, README | MVP feature-complete and documented |

---

## Key Implementation Notes

### Supabase Realtime
All Realtime subscriptions use `supabase.channel().on('postgres_changes', ...)`. Subscribe on component/hook mount, unsubscribe on unmount. Subscriptions needed:
- `visits` (site_id = current site) → dashboard live board
- `notifications` (recipient_user_id = current user) → unread count + toasts
- `evacuation_events` (site_id, closed_at IS NULL) → banner + evacuation screen

### PIN Security
- Never store, log, display, or transmit plain-text PINs
- On login: `bcryptjs.compare(enteredPin, user.pin_hash)`
- On user creation/PIN reset: `bcryptjs.hash(pin, 10)` → store hash only
- `SafeUser` type (Omit<User, 'pin_hash'>) used everywhere in the application after login

### Overdue Status
Never write `'overdue'` to the database. The `visit.status` column stays `'checked_in'`. Overdue is derived at query/display time using `getDisplayStatus(visit)` — compare `planned_departure < now()`. The dashboard query filters on this condition to populate the Overdue section.

### Evacuation Blocking
Before any check-in or sign-out operation, check `auth.activeEvacuation !== null`. If active, show a red alert and abort the operation. This check happens in both the CheckInScreen and the self-service sign-out button.

### Escalation Polling
`useEscalation` hook runs `setInterval` polling every 30 seconds, but only when the current user is `reception` or `site_admin` and the dashboard is the active screen. Clean up interval on unmount. The escalation logic:
1. Query notifications: `escort_required`, unacknowledged, not yet escalated, `created_at < now() - escalation_minutes`
2. For each: determine the backup contact(s) from `visit_host_contacts` where `is_backup = true`
3. Insert escalation notification to backup (or to reception if no backup), set `escalated = true` on original
4. Log `escalation_triggered` to `audit_log`

### Markdown
All H&S content (`sites.hs_written_content`) and document content (`visit_documents.document_content`) is stored as Markdown and rendered via `<MarkdownRenderer>` (react-markdown wrapper). The `<MarkdownRenderer>` component applies Primark typography styles via the `components` prop — it is the only place react-markdown is called directly.

### Single-Site MVP
`site_id` is determined at login (auto-selected for the single site). All queries are scoped to `site_id`. No cross-site data is accessible.
