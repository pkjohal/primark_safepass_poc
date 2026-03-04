# Primark SafePass — Demo Script

> **Audience:** Internal stakeholders / Senior management / Security & operations teams
> **Duration:** ~18–20 minutes
> **Last updated:** 2026-03-04

---

## Elevator Pitch

SafePass replaces Primark's paper visitor book with a real-time digital system that tracks every person on-site, enforces health and safety compliance at check-in, controls third-party access, and gives site admins a live headcount they can trust in an emergency. This demo walks through the complete visitor journey — from a visitor preparing before they arrive, to reception checking them in, to a site admin activating an evacuation.

---

## Demo Personas

| Persona | Name | Username | PIN | Role | Used In |
|---------|------|----------|-----|------|---------|
| Reception | Claire Murphy | `claire.m` | `1234` | reception | Scenes 1–4, 7 |
| Host | Sean O'Brien | `sean.o` | `1234` | host | Scene 5 (notification receiver) |
| Host | Mary Flanagan | `mary.f` | `1234` | host | Scene 5 (escort notification) |
| Site Admin | Pat Kelly | `pat.k` | `1234` | site_admin | Scenes 6, 7, 8 |
| Visitor (3rd party, pre-approved) | John Smith | self-service URL | — | visitor | Scene 2 (self-service portal) |
| Visitor (3rd party, no induction) | Lisa Chen | — | — | visitor | Scene 3 (check-in wizard) |
| Visitor (deny listed) | Dave Problematic | — | — | visitor | Scene 4 (deny list block) |

---

## Demo Data Setup

Run `npm run seed` before the demo starts. This creates all the records below. The seed is idempotent — re-running it resets the data to a clean state.

### Records Created by Seed

- [x] **Site:** Primark Dublin Mary Street (`DUB01`) — H&S content v1, escalation 10 min, pre-approvals 90 days
- [x] **Members:** Claire Murphy (reception), Sean O'Brien (host), Mary Flanagan (host), Pat Kelly (site_admin) — all PIN `1234`
- [x] **Visitors:**
  - John Smith / Acme Contractors (third_party, pre-approved, induction done yesterday)
  - Emma Watson / Primark (internal_staff, currently checked in, unescorted)
  - Raj Patel / Securitas (third_party, currently checked in, awaiting escort)
  - Lisa Chen / FireServ Ltd (third_party, scheduled for today, induction NOT done)
- [x] **Visits:**
  - John Smith — scheduled +2h from now, induction complete
  - Lisa Chen — scheduled +3h from now, no induction on record
  - Emma Watson — checked in 45 min ago, unescorted
  - Raj Patel — checked in 15 min ago, awaiting escort (Mary Flanagan to collect)
- [x] **Pre-approval:** John Smith — approved, 60 days remaining
- [x] **Deny list:** Dave Problematic (`dave@example.com`) — permanent ban
- [x] **Notifications:** escort_required for Mary Flanagan (Raj Patel)

### Before Demo: Manual Step

- [ ] **For Scene 4 (deny list demo):** Create a visitor profile for `Dave Problematic` with email `dave@example.com` and schedule a visit for today. This visitor will be blocked at check-in. (Can be done live as part of Scene 3.)
- [ ] App running at `http://localhost:5173`
- [ ] Browser is in incognito / logged out state
- [ ] Screen resolution set to at least 1280px wide for dashboard columns to display correctly

> Verify before demo: confirm the self-service URL for John Smith is available from the seed script's console output (`/self-service/<token>`). Copy it to a notes doc to paste quickly during Scene 2.

---

## Scene Overview

| # | Scene | Route | Persona | What it demonstrates |
|---|-------|-------|---------|----------------------|
| 1 | Live Dashboard | `/` | Claire (reception) | Real-time on-site board, stat cards, today's schedule |
| 2 | Visitor Self-Service Portal | `/self-service/:token` | John Smith (visitor) | Pre-arrival induction, document review, visit overview |
| 3 | Guided Check-In Wizard | `/checkin/:visitId` | Claire (reception) | 5-step check-in, H&S induction step, access determination |
| 4 | Deny List Block | `/checkin/:visitId` | Claire (reception) | Full-screen denial, automatic staff alert |
| 5 | Inbox & Escort Flow | `/inbox`, `/` | Mary (host) | Escort notification, acknowledgement, mark escorted |
| 6 | Pre-Approvals & Visitor Profile | `/pre-approvals`, `/visitors/:id` | Pat (site_admin) | Unescorted access management, full visitor history |
| 7 | Site Configuration & H&S Publishing | `/site-config` | Pat (site_admin) | H&S content authoring, version bump, notification settings |
| 8 | Emergency Evacuation | `/` → `/evacuation` | Pat (site_admin) | Activation, live headcount register, printable roll, close |

---

## Scene Scripts

---

### Scene 1 — Live Dashboard

**Screen:** `/` (HomeScreen)
**Logged in as:** Claire Murphy (`claire.m` / `1234`) — reception
**Goal:** Show the real-time operational picture reception staff see every morning.

**Actions:**
1. Open the app at `http://localhost:5173`
2. Enter username `claire.m` and PIN `1234` on the PIN pad login screen
3. Land on the dashboard — point to the four stat cards at the top
4. Scroll down to the **Expected Today** table — highlight John Smith and Lisa Chen
5. Point to the **On-Site Now** columns: Emma Watson (unescorted), Raj Patel (awaiting escort)

**Talking points:**

> "This is what Claire, our reception manager, sees every morning when she opens SafePass. The four cards across the top give her an instant pulse of the site — how many visitors are expected, who's currently on-site, whether anyone is waiting for an escort, and whether anyone has overstayed their planned departure time."

> "The Expected Today table shows every visitor booked in for today, with their pre-arrival status — you can see at a glance whether their H&S induction is done and whether any documents are pending. That means reception isn't scrambling to gather information when the visitor walks in."

> "Below that, the live status board updates in real time. Emma Watson from Primark HQ is already on-site with unescorted access — she's internal staff, so no escort needed. Raj Patel from Securitas is awaiting his escort — Mary Flanagan hasn't collected him yet. We'll come back to that."

**Highlight:** The "Awaiting Escort" column with Raj Patel — the amber badge and the host name make it immediately clear what action is needed.

---

### Scene 2 — Visitor Self-Service Portal

**Screen:** `/self-service/:token` (SelfServiceScreen — public, no login)
**Logged in as:** John Smith (visitor, via self-service URL)
**Goal:** Show the visitor's experience before they arrive — completing induction and reviewing visit details from any device.

**Actions:**
1. Open a new browser tab and paste John Smith's self-service URL (from seed output)
2. Show the visitor's profile card — name, company, visitor type badge ("Third Party")
3. Navigate to **H&S Induction** — show induction status card (already valid, days remaining bar)
4. Navigate to **Upcoming Visits** — show John's visit for today, host name, site, time
5. Show the **Privacy & Data** section — point to the GDPR data request buttons

**Talking points:**

> "Visitors get a personal link — no account, no password. John Smith from Acme Contractors received this link the moment his visit was scheduled. He can open it on his phone the evening before, complete the health and safety induction from home, and review any documents his host has attached."

> "You can see John's induction is already marked valid — he completed it yesterday. The progress bar shows how many days he has left before it expires. If the site admin publishes updated H&S content, this card would immediately flip to 'Required' and prompt him to redo it."

> "For John, arriving tomorrow is going to be fast. Claire will see his induction is already done on the dashboard, the check-in wizard will skip that step entirely, and he'll be through in under a minute."

> "And at the bottom — GDPR rights. Any visitor can request a copy of their data or ask to have it deleted, directly from this screen. The request routes to the site admin. Everything is audited."

**Highlight:** The induction validity progress bar with "X days remaining" — the visual makes it clear the system tracks compliance automatically.

> Verify before demo: confirm the self-service URL for John Smith navigates correctly before starting.

---

### Scene 3 — Guided Check-In Wizard

**Screen:** `/checkin/:visitId` (CheckInScreen)
**Logged in as:** Claire Murphy (`claire.m` / `1234`) — reception
**Goal:** Walk through the full guided check-in flow for Lisa Chen (FireServ), who has no induction on record.

**Actions:**
1. Return to the dashboard (Claire's session)
2. In the **Expected Today** table, click **Check In** next to Lisa Chen
3. **Step 1 — Confirm Details:** Show visitor name, company, purpose ("Annual fire safety inspection"), host, planned arrival/departure. Note the H&S induction shows `✗` (not complete). Click **Confirm & Continue**
4. **Step 2 — H&S Induction:** Show the H&S content page (video URL + written guidance). Scroll through the written content. Click **I Have Completed the Induction**
5. **Step 3 is skipped** (no documents attached to Lisa's visit) — briefly note this
6. **Step 4 — Deny Check:** Show the "Checking security records..." spinner, then auto-advance
7. **Step 5 — Access Determination:** Show "Completing check-in..." then the success screen showing "Awaiting Escort — Host Notified" (Lisa has no pre-approval)
8. Click **Back to Dashboard** — show Lisa now in the "Awaiting Escort" column

**Talking points:**

> "When Lisa walks in, Claire clicks Check In. The wizard takes her through everything in order. Step one is a quick confirmation — is this the right person, the right purpose, the right time?"

> "Because Lisa hasn't completed her H&S induction — she didn't pre-register online — the wizard presents it inline. Claire can walk Lisa through the video and written guidance right here at reception. Once Lisa's ready, Claire confirms completion and the system records it."

> "Notice what gets skipped: there are no documents attached to this visit, so that step doesn't appear. The wizard adapts to what's actually needed. For a repeat visitor who completed induction last week, the whole thing takes about fifteen seconds."

> "Step four is the deny list check. Every single check-in, without exception, queries the deny list against the visitor's name, email, and ID. If they're banned, the system stops here — we'll see that in the next scene."

> "Because Lisa is a third-party contractor without a pre-approval, she's assigned 'Awaiting Escort'. Her host, Mary Flanagan, has been automatically notified. Back on the dashboard, Lisa is now showing in the amber 'Awaiting Escort' column — Claire can see instantly that action is needed."

**Highlight:** The automatic escort notification — the system does the work so Claire doesn't have to phone around.

---

### Scene 4 — Deny List Block

**Screen:** `/checkin/:visitId` (CheckInScreen — blocked state)
**Logged in as:** Claire Murphy (`claire.m` / `1234`) — reception
**Goal:** Demonstrate the deny list check blocking a prohibited visitor.

**Pre-step:** Either use a pre-created visit for Dave Problematic, or quickly create one live:
- Navigate to `/visitors/new`, create a visitor: **Dave Problematic**, email `dave@example.com`, Third Party
- Navigate to `/schedule`, create a walk-in visit for Dave today

**Actions:**
1. From the dashboard, click **Check In** for Dave Problematic's visit
2. **Step 1:** Confirm details, click **Confirm & Continue**
3. **Step 4 — Deny Check:** The wizard advances to the deny check — show the full-screen red alert with `THIS VISITOR IS ON THE DENY LIST` displayed in large text
4. Show the reason: "Aggressive behaviour during previous visit on 15/01/2026"
5. Point out the sub-message: "Check-in blocked. Reception and site admin have been notified."
6. Click **Return to Dashboard** — do NOT let Dave in

**Talking points:**

> "Let's say someone walks into Primark who shouldn't be there. Site admins maintain a deny list — temporary or permanent bans, with a reason recorded every time. This list is checked at every single check-in."

> "The moment Dave's email matches the deny list, check-in stops. There is no override. The screen turns red, the reason is shown — 'aggressive behaviour' — and reception can clearly see they should not proceed. At the same time, the system has already sent a notification to all reception and admin staff on site."

> "This isn't a warning you can click through. It's a hard stop. And every one of these blocked attempts is logged in the audit trail with a timestamp, the visitor's details, and who was at the desk."

**Highlight:** The full-screen red block — there's no ambiguity, no "are you sure" — the decision is made for reception.

---

### Scene 5 — Inbox and Escort Flow

**Screen:** `/inbox` then `/` (InboxScreen, HomeScreen)
**Logged in as:** Mary Flanagan (`mary.f` / `1234`) — host
**Goal:** Show how a host receives and acts on an escort notification.

**Actions:**
1. Log out as Claire, log in as Mary Flanagan (`mary.f` / `1234`)
2. Notice the unread notification badge (red dot) on the inbox icon in the navbar
3. Navigate to `/inbox` — show the escort notification for Raj Patel: "Visitor awaiting escort: Raj Patel"
4. Click the notification to mark it read and acknowledge it
5. Navigate back to the dashboard `/` — show Raj Patel in the "Awaiting Escort" column
6. Click **Mark Escorted** on Raj Patel's card — he moves to the "On-Site — Escorted" column
7. Point to the updated stat card: "Awaiting Escort" count drops to 0

**Talking points:**

> "Meanwhile, Mary Flanagan — Raj Patel's host — has a notification waiting for her. The red badge on the inbox appears the moment Raj checked in, across any device, in real time. No need for Claire to phone her."

> "The notification tells her exactly who, what for, and what she needs to do — collect Raj from reception. She acknowledges it, walks down to reception, collects Raj, and marks him as escorted directly from the dashboard."

> "If Mary had ignored that notification, the system would have escalated. After ten minutes — configurable per site — the notification would go to Raj's backup contact, Pat Kelly. After another ten minutes, it escalates to all reception and admin staff. No visitor gets left waiting at reception indefinitely without someone being chased."

**Highlight:** The real-time badge update and the escort column transitioning from amber to blue.

---

### Scene 6 — Pre-Approvals and Visitor Profile

**Screen:** `/pre-approvals`, `/visitors/:id` (PreApprovalScreen, VisitorProfileScreen)
**Logged in as:** Pat Kelly (`pat.k` / `1234`) — site_admin
**Goal:** Show how trusted third-party contractors are managed for unescorted access.

**Actions:**
1. Log out as Mary, log in as Pat Kelly (`pat.k` / `1234`)
2. Navigate to `/pre-approvals` from the sidebar
3. Show John Smith's existing approved pre-approval — expiry date, approved by, status badge
4. Navigate to `/visitors` → search "John Smith" → click through to his profile
5. Show the profile page: Pre-Approval badge "approved" with expiry, visitor type "Third Party"
6. Show the Visit History table: his previous and upcoming visits, their statuses
7. Show the deny list alert banner is absent (John is not banned — contrast with what we saw in Scene 4)
8. Point to the **Schedule Visit** button available from this profile page

**Talking points:**

> "Some third-party visitors come every week — IT support, cleaning contractors, maintenance engineers. Forcing an escort every single time creates unnecessary burden. That's what pre-approvals are for."

> "Pat has already approved John Smith from Acme Contractors for unescorted access for the next 60 days. When John checks in this afternoon, the system will find that approval, skip the awaiting-escort path entirely, and grant him unescorted access automatically. No escort needed, no notification to a host — John goes straight in."

> "The visitor profile gives us a full picture of John's history — every visit, every status, when he last completed induction, whether he's on the deny list. If there's ever a question about who was on-site and when, this is the audit trail."

**Highlight:** The "approved" pre-approval badge on the profile, and the contrast with the deny list check from Scene 4 — the system applies the right rule automatically.

---

### Scene 7 — Site Configuration and H&S Publishing

**Screen:** `/site-config` (SiteConfigScreen)
**Logged in as:** Pat Kelly (`pat.k` / `1234`) — site_admin
**Goal:** Show how site admins manage H&S content and notification settings.

**Actions:**
1. Navigate to `/site-config` from the sidebar (Admin section)
2. Show the **Site Details** panel — site code `DUB01`, current H&S content version `v1`
3. Scroll to the **Health & Safety Content** section — show the video URL field and Markdown editor
4. Click **Preview** to switch from the raw editor to the rendered H&S content — show the formatted guidance
5. Click back to **Edit** mode — make a small edit (e.g. add a line to the written content)
6. Point to the orange warning: *"Saving H&S content increments the version number and requires ALL visitors to re-complete their induction"*
7. Show the **Notification Settings** panel — escalation timeout (10 min), pre-approval default days (90)
8. Do NOT click Publish — explain what would happen if you did

**Talking points:**

> "Fire safety regulations change. Emergency procedures get updated. The site H&S content is managed directly here — a Markdown editor with live preview, plus an optional safety video. No email chains to a web team, no waiting for a content update."

> "The version number matters. Right now we're on version 1. When Pat publishes a new version, every visitor's existing induction record becomes invalid. The next time any of them check in — or open their self-service portal — the system will prompt them to redo the induction. That versioning is automatic and tracked in the audit trail."

> "The notification settings here control the escalation window for escort requests — currently ten minutes. If Primark security wanted to tighten that to five minutes, Pat can change it here and the effect is immediate. No developer needed."

**Highlight:** The orange warning banner about version bumping — making it clear the business impact of publishing new content is transparent before you commit.

---

### Scene 8 — Emergency Evacuation

**Screen:** `/` → `/evacuation` (HomeScreen → EvacuationScreen)
**Logged in as:** Pat Kelly (`pat.k` / `1234`) — site_admin
**Goal:** Demonstrate the full emergency evacuation flow from activation to headcount to closure.

**Actions:**
1. Return to the dashboard at `/` (logged in as Pat)
2. Point to the red **Emergency Evacuation** button in the top-right header
3. Click it — show the confirmation dialog: "This will immediately suspend all check-ins and sign-outs..."
4. Click **Activate Evacuation** — the screen transitions to `/evacuation`
5. Show the full-screen red emergency banner: "EMERGENCY EVACUATION ACTIVE — Check-ins and sign-outs are suspended"
6. Point to the three headcount tiles: **On Site: 2**, **Accounted: 0**, **Unaccounted: 2**
7. Scroll down to the **Headcount Register** — show Emma Watson and Raj Patel with checkboxes
8. Check off Emma Watson — Accounted goes to 1, Unaccounted to 1
9. Check off Raj Patel — all accounted, **Close Evacuation** button appears
10. Click **Print Headcount List** — show the print preview with the register, signature block, activated time, and warden line
11. Go back, click **Close Evacuation** — add a note, confirm
12. Return to the dashboard — banner is gone, normal operations resumed

**Talking points:**

> "In a genuine emergency, Pat hits this button. One click. The system records every visitor who was on-site at the exact moment of activation — that headcount is frozen in time, so we know exactly who we're looking for."

> "The evacuation alert broadcasts across every session immediately. Claire's screen, Sean's screen, Mary's screen — everyone sees the red banner. Check-ins stop. Sign-outs stop. The site is in lockdown until this event is closed."

> "The headcount register shows us who's still unaccounted for. As the fire warden confirms each person at the assembly point, they check them off. The count updates live. If someone is missing, it's obvious."

> "The register can be printed at any time — including now, mid-evacuation — to give the warden a physical backup in case the internet goes down. It includes an activation timestamp, a warden signature line, and the current accounted count."

> "Once everyone is confirmed safe, the evacuation closes. Notes are recorded — 'false alarm triggered by kitchen smoke', 'full evacuation completed, all accounted for'. The incident is logged permanently in the audit trail with a full timeline: who activated it, when, who was on-site, who closed it."

**Highlight:** The moment the "Close Evacuation" button appears once all visitors are accounted for — the system enforces that you can't close until everyone is safe.

---

## Closing

**What to say:**

> "That's SafePass — from a visitor completing their induction on their phone the night before, to a real-time on-site board for reception, to a full emergency evacuation running in minutes. Every action is audited, every notification is automated, and every compliance step is enforced — without slowing anyone down."

> "What used to be a paper visitor book and a series of phone calls is now a system that works in the background, surfaces the right information at the right moment, and gives the site admin a complete record of everything that happened and when."

> "Happy to dig into any specific flow in more detail, or talk through how this maps to other Primark sites."

---

## Fallback Notes

| If this goes wrong | Do this |
|--------------------|---------|
| Login fails | All PINs are `1234` after seeding. Re-run `npm run seed` if data is missing |
| Self-service URL doesn't work | Get the URL from seed console output and paste it fresh. Alternatively, navigate to `/visitors`, find John Smith, copy his access token from the profile |
| Dashboard columns missing | Widen browser window to 1280px+; the status columns require `lg:` breakpoint |
| Raj Patel not showing as "awaiting escort" | Re-run `npm run seed` to restore clean state |
| Evacuation won't close | Ensure both Emma Watson and Raj Patel checkboxes are ticked before clicking Close |
| Dave Problematic visit not created | Quickly create him live: Visitors → New → `dave@example.com` → Schedule walk-in → Check In → blocked |
