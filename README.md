# Primark SafePass

SafePass is a web-based visitor registration and access management application for Primark sites. It replaces the paper sign-in process with a digital, auditable system that manages the arrival and departure of all visitors across physical locations, linked directly to site-specific health and safety induction. Built as a React SPA backed by Supabase, it supports reception staff, site hosts, and site administrators through a role-based dashboard and a self-service portal for visitors.

---

## Setup

### Prerequisites

- Node.js 18+
- A Supabase account (free tier sufficient for MVP)

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd primark-safepass
npm install

# 2. Create a Supabase project at https://supabase.com
#    Note your project URL and anon key

# 3. Set environment variables
cp .env.example .env
# Edit .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Run the database schema in Supabase SQL editor:
#    Paste and run: supabase/schema.sql
#    Then: supabase/indexes.sql

# 5. Seed the database
npm run seed

# 6. Start the dev server
npm run dev
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase project anon/public key |

---

## Default Logins

After running the seed script, the following accounts are available:

| Username | PIN | Role |
|---|---|---|
| `claire.m` | `1234` | Reception |
| `sean.o` | `5678` | Host |
| `mary.f` | `9012` | Host |
| `pat.k` | `3456` | Site Admin |

---

## Testing the Self-Service Portal

Visitors access the self-service portal via a token-based URL — no login required.

To test it:

1. Run the seed script (`npm run seed`) — it prints all visitor self-service URLs in the terminal output.
2. Or, query the token from Supabase directly:

```sql
SELECT name, email, access_token FROM visitors;
```

3. Visit: `http://localhost:5173/self-service/{access_token}`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS (Primark brand theme) |
| Backend / Database | Supabase (Postgres + Realtime) |
| Markdown | react-markdown |
| PIN Hashing | bcryptjs |
| Routing | React Router v7 |
| Toasts | react-hot-toast |
| Hosting | Vite — deploy to Vercel or Netlify |

---

## Folder Structure

```
/src
  /components
    /ui           StatCard, StatusPill, PinPad, ConfirmDialog, SearchBar,
                  EmptyState, DateTimePicker, MarkdownRenderer
    /layout       NavBar, BottomNav, PageHeader, EvacuationBanner
    /visitors     VisitorRow, VisitorForm
    /visits       InductionViewer, DocumentViewer
    /notifications NotificationRow
    /evacuation   (EvacuationScreen is a top-level screen)
  /screens        All screen-level components (13 screens)
  /hooks          Data hooks (useVisits, useVisitors, useNotifications, etc.)
  /lib            supabase.ts, types.ts, constants.ts, permissions.ts,
                  auth.ts (bcrypt wrappers), utils.ts
  /context        AuthContext.tsx
/supabase
  schema.sql      CREATE TABLE statements
  indexes.sql     CREATE INDEX statements
  seed.ts         Node seed script (hashes PINs at runtime)
```

---

## MVP Scope & Known Limitations

**In scope:**
- Single pilot site (Dublin Mary Street — DUB01)
- Host-led visit scheduling; reception-managed check-in
- H&S induction with version tracking and 28-day validity
- Document attachment and acceptance
- Pre-approval workflow for unescorted third-party access
- Deny list with visitor_id and email matching
- In-app notification inbox (no email/SMS)
- Client-side escalation polling (30-second interval)
- Emergency evacuation mode with real-time headcount
- GDPR anonymisation
- Visitor self-service portal (token-based, no login)
- Full audit log

**Out of scope for MVP:**
- SSO / Active Directory integration
- Email, SMS, or push notification delivery
- Multi-site aggregated dashboard
- Server-side escalation scheduler (client polling used)
- QR code scanning
- Supabase Row Level Security
- Token expiry for visitor self-service links
- Offline / degraded-connectivity mode
- Dark mode
- Mobile-native app
- Visitor analytics and reporting
