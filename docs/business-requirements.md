# Business Requirements — Primark SafePass

**Version:** 1.0
**Date:** 2026-03-04
**Source:** Reverse-engineered from codebase

---

## 1. Project Overview

Primark SafePass is a digital visitor registration and access management system for Primark sites. It replaces paper-based visitor books with a web application that tracks who is on-site, enforces health and safety compliance, controls access for third-party contractors, and provides real-time visibility during emergencies. Visitors interact through a self-service portal accessible via a unique link, while Primark staff manage visits through a role-controlled internal application.

---

## 2. Stakeholders and Users

| Role | Description |
|------|-------------|
| **Visitor (Internal Staff)** | A Primark employee visiting a site other than their home location. Can self-check in and sign out without an escort |
| **Visitor (Third Party)** | An external contractor, supplier, or other third party. Requires an escort unless pre-approved for unescorted access |
| **Host** | A Primark staff member who sponsors a visit. Receives notifications when their visitor arrives and is responsible for escort when required |
| **Reception** | Front-of-house staff who process physical check-ins, register walk-in visits, and manage the on-site visitor board |
| **Site Admin** | Has all Reception capabilities plus: site configuration, deny list management, user management, evacuation activation, and evacuation history |

---

## 3. Functional Requirements

### 3.1 Visitor Registration

- **FR-01:** Staff can create a visitor profile with name, email, phone, company, and visitor type (`internal_staff` or `third_party`) — `src/screens/VisitorFormScreen.tsx`
- **FR-02:** Each visitor is assigned a unique self-service access token (UUID) at creation, used to generate a personal portal link — `supabase/schema.sql:visitors.access_token`
- **FR-03:** Staff can search for visitors by name, email, or company — `src/screens/VisitorSearchScreen.tsx`
- **FR-04:** Visitor profiles show the full visit history, H&S induction status, and pre-approval status — `src/screens/VisitorProfileScreen.tsx`
- **FR-05:** Site admins can anonymise a visitor record (GDPR deletion) which replaces PII with placeholder values and sets `is_anonymised = true`

### 3.2 Visit Scheduling

- **FR-06:** Any staff member can schedule a visit for an existing visitor, specifying date, arrival/departure times, purpose, primary host, and optional backup contact — `src/screens/ScheduleVisitScreen.tsx`
- **FR-07:** Reception can register walk-in visits with today's date pre-populated — `src/screens/ScheduleVisitScreen.tsx` (walkin=true mode)
- **FR-08:** One or more legal/compliance documents (e.g. NDAs) in Markdown format can be attached to a visit at scheduling time
- **FR-09:** Visitors receive an in-app notification when a visit is scheduled, with a link to their self-service portal
- **FR-10:** Site admins can schedule visits at any active site; other roles can only schedule at their assigned site

### 3.3 Visitor Check-In

- **FR-11:** Reception staff can initiate check-in for any scheduled visit from the dashboard — requires `reception` role minimum
- **FR-12:** The check-in process is a guided 5-step wizard: (1) Confirm details → (2) H&S induction (if required) → (3) Document acceptance (if pending) → (4) Deny-list check → (5) Access determination
- **FR-13:** Check-ins are blocked during an active evacuation — `src/screens/CheckInScreen.tsx:handleConfirmDetails`
- **FR-14:** If a visitor already has a valid H&S induction (within 28 days, matching current content version), the induction step is skipped
- **FR-15:** If no visit documents are pending, the document step is skipped
- **FR-16:** If the visitor appears on the deny list, check-in is blocked with a full-screen red alert, and all reception/admin staff are notified

### 3.4 Access Control

- **FR-17:** Internal staff visitors are always granted unescorted access on check-in
- **FR-18:** Third-party visitors require an active, approved pre-approval to receive unescorted access; without one, they are assigned `awaiting_escort` status
- **FR-19:** When a visitor is assigned `awaiting_escort`, all host contacts receive an escort-required notification requiring acknowledgement
- **FR-20:** Reception can manually update a visitor's access status to `escorted` once a host has collected them — `src/screens/HomeScreen.tsx:handleMarkEscorted`
- **FR-21:** If an escort notification is not acknowledged within the site's escalation window, the system automatically escalates to the backup contact, then to all reception/admin

### 3.5 Sign-Out

- **FR-22:** Reception can sign out any checked-in visitor from the dashboard, recording actual departure time — `src/screens/HomeScreen.tsx:handleCheckOut`
- **FR-23:** Sign-out is blocked during an active evacuation
- **FR-24:** Visitors can sign themselves out via the self-service portal

### 3.6 H&S Induction

- **FR-25:** Each site has its own H&S induction content comprising an optional video URL and Markdown-formatted written guidance
- **FR-26:** An induction record is valid for 28 days and must match the site's current content version
- **FR-27:** Visitors can complete their H&S induction in advance through the self-service portal
- **FR-28:** When a site admin publishes new H&S content, the version number increments and all visitors must re-complete induction on their next visit
- **FR-29:** The check-in wizard presents induction content if the visitor's record is missing, expired, or based on an outdated content version

### 3.7 Pre-Approvals

- **FR-30:** Staff can request pre-approval for a third-party visitor to have unescorted access at a site for a defined period — `src/screens/PreApprovalScreen.tsx`
- **FR-31:** Site admins can approve, reject, or revoke pre-approvals
- **FR-32:** Pre-approvals expire after a configurable number of days (default: 90, configurable per site)
- **FR-33:** At check-in, the system queries for an active approved pre-approval to determine access status automatically

### 3.8 Deny List

- **FR-34:** Site admins can add a visitor to the site deny list with a reason, permanent flag, or expiry date — `src/screens/DenyListScreen.tsx`
- **FR-35:** Deny-list entries can match on visitor ID or email address
- **FR-36:** A deny-list match during check-in triggers a full-screen block, notifies all reception/admin staff, and logs the attempt to the audit trail
- **FR-37:** Site admins can deactivate deny-list entries

### 3.9 Notifications and Inbox

- **FR-38:** All notifications are delivered to an in-app inbox accessible from the navigation bar — `src/screens/InboxScreen.tsx`
- **FR-39:** Unread notification count is displayed as a badge in the navbar and updates in real time via Supabase Realtime
- **FR-40:** Escort-required notifications require explicit acknowledgement before the escalation timer starts
- **FR-41:** Visitors receive notifications in their self-service portal (scheduled visits, cancellations, GDPR responses)

### 3.10 Emergency Evacuation

- **FR-42:** Site admins can activate an emergency evacuation from the dashboard — `src/screens/HomeScreen.tsx:handleActivateEvacuation`
- **FR-43:** On activation, all logged-in staff see a red banner, check-ins and sign-outs are suspended, and all staff are notified
- **FR-44:** The evacuation screen shows a real-time headcount register of all visitors on-site at the time of activation — `src/screens/EvacuationScreen.tsx`
- **FR-45:** Reception/admin can check off visitors as accounted for; headcount updates live across all sessions
- **FR-46:** The register can be printed as a physical document with a signature block
- **FR-47:** Evacuation can only be closed once all visitors are accounted for; notes can be added to the incident record
- **FR-48:** A history of past evacuation events is accessible to site admins — `src/screens/EvacuationHistoryScreen.tsx`

### 3.11 Self-Service Visitor Portal

- **FR-49:** Visitors access their personal portal via a unique URL (`/self-service/:token`) — no login required
- **FR-50:** Visitors can view their upcoming and past visits, complete H&S induction, review and accept documents, and sign out
- **FR-51:** Internal staff visitors can self-check in on the day of their visit via the portal
- **FR-52:** Visitors can update their phone number through the portal
- **FR-53:** Visitors can submit a GDPR data access request or data deletion request through the portal; these are routed to the relevant site admins as notifications

### 3.12 Site Configuration

- **FR-54:** Site admins can author H&S induction content (video URL + Markdown) and publish it — `src/screens/SiteConfigScreen.tsx`
- **FR-55:** Site admins can configure the escort escalation timeout (minutes) and the default pre-approval duration (days)

### 3.13 User Management

- **FR-56:** Site admins can create, edit, and deactivate staff user accounts — `src/screens/AdminScreen.tsx`
- **FR-57:** Users are assigned a 4-digit PIN at creation; PINs are stored as bcrypt hashes
- **FR-58:** The last active site admin at a site cannot be deactivated
- **FR-59:** Usernames are immutable after creation

### 3.14 Audit Trail

- **FR-60:** Every significant write operation (visitor creation, check-in, escalation, evacuation, etc.) is logged to the `audit_trail` table with action type, entity reference, acting user, and metadata
- **FR-61:** Audit records are never deleted

---

## 4. User Stories

### Visitor Management

- As a **host**, I can register a new visitor profile so that I can schedule visits for people who have not visited before.
- As a **reception** staff member, I can search for a visitor by name or email so that I can quickly find and process their check-in.
- As a **site admin**, I can anonymise a visitor record so that we comply with GDPR deletion requests.

### Visit Scheduling

- As a **host**, I can schedule a visit and attach an NDA so that the visitor reviews and accepts it before entering the site.
- As a **reception** staff member, I can register a walk-in visit so that unscheduled visitors can be processed quickly and accurately.
- As a **visitor**, I receive a notification when a visit is scheduled for me so that I can prepare my H&S induction in advance.

### Check-In

- As a **reception** staff member, I can check in a visitor through a guided wizard so that all compliance steps are completed before granting access.
- As a **reception** staff member, I am shown a clear block screen if a visitor is on the deny list so that I can prevent prohibited individuals from entering.
- As a **visitor (internal staff)**, I can self-check in on my visit day so that I do not need to queue at reception.

### Access and Escorts

- As a **host**, I receive an escort notification when my visitor arrives as a third party without pre-approval so that I know to collect them from reception.
- As a **reception** staff member, I can mark a visitor as escorted once their host has collected them so that the dashboard accurately reflects on-site status.
- As a **site admin**, I can grant a trusted third-party contractor pre-approval for unescorted access so that they do not require an escort on every visit.

### Emergency

- As a **site admin**, I can activate an emergency evacuation so that all staff are alerted and check-ins are immediately suspended.
- As a **reception** staff member, I can use the evacuation headcount register to account for all on-site visitors so that no one is left unaccounted for.
- As a **site admin**, I can print the headcount register so that the emergency warden has a physical backup.

### Self-Service

- As a **visitor**, I can complete my H&S induction before my visit so that check-in is faster on the day.
- As a **visitor**, I can request deletion of my personal data through the portal so that I can exercise my GDPR rights.

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Security | All routes except `/login` and `/self-service/:token` require authentication. PIN codes are stored as bcrypt hashes and are never held in memory after verification. Role-based route guards prevent access to restricted screens |
| Session | Automatic session expiry after 30 minutes of inactivity (mouse, keyboard, or touch events reset the timer) |
| Real-time | Dashboard visitor board, unread notification count, and evacuation status update in real time via Supabase Realtime (PostgreSQL change notifications) |
| Accessibility | Not explicitly addressed in codebase — future requirement |
| Scalability | Multi-site architecture: each site has independent users, visits, deny lists, and H&S content. Site admins can schedule visits across sites |
| Data Retention | Audit trail records are never deleted. Visitor records are soft-deleted via GDPR anonymisation; visit history is preserved with PII removed |
| GDPR | Visitors can submit data access and deletion requests through the self-service portal. Soft-delete (`is_anonymised` flag) preserves audit integrity while removing PII |
| Print Support | Evacuation headcount register supports browser print with styled print-only layout (signature block, header) |
| Induction Validity | H&S induction valid for 28 days; expires sooner if site admin publishes new content (version mismatch) |
| Performance | Build output ~688 KB JS, ~21 KB CSS. Supabase indexes on all high-frequency query paths (visits by site/date, deny list by site, messages by recipient) |

---

## 6. Business Rules

- **BR-01:** A visitor's `overdue` status is computed at runtime (`checked_in` + `planned_departure < now()`); it is never stored in the database
- **BR-02:** Internal staff visitors always receive unescorted access — no pre-approval is needed
- **BR-03:** Third-party visitors receive unescorted access only if a valid approved pre-approval exists for their visitor/site combination
- **BR-04:** H&S induction is valid for exactly 28 days AND must match the site's current content version — either condition invalidating it requires re-induction
- **BR-05:** A deny-list block at check-in cannot be overridden — the only action is to return to the dashboard; an alert is automatically sent to all reception/admin
- **BR-06:** Check-ins and sign-outs are globally suspended during an active evacuation event (checked in `AuthContext.activeEvacuation`)
- **BR-07:** Evacuation can only be closed when all visitors at activation time have been marked as accounted for in the headcount register
- **BR-08:** Escalation of unacknowledged escort notifications is processed client-side every 30 seconds by a reception/site_admin user. The escalation path is: primary host → backup contact → all reception/admin
- **BR-09:** The last active site admin cannot be deactivated — the system prevents this to avoid administrative lockout
- **BR-10:** Publishing new H&S content increments the site's `hs_content_version` by 1, which immediately invalidates all existing induction records for that site
- **BR-11:** Walk-in visits can only be created with today's date; standard scheduled visits require a future date
- **BR-12:** A visitor who is already checked in at a site is shown as disabled in the visitor selection dropdown when scheduling a new visit

---

## 7. Out of Scope

- **Email / SMS delivery:** Notifications are in-app only. The system uses `messages` table to simulate email communication (noted as MVP behaviour in `supabase/schema.sql` comments)
- **Biometric or badge-based access control:** The system records access decisions but does not integrate with physical access control systems
- **Mobile native apps:** Delivered as a web application only; responsive design supports mobile browsers
- **Photo ID capture:** No photo or document scanning functionality
- **Multi-factor authentication:** Only 4-digit PIN — no TOTP or hardware keys
- **SSO / LDAP integration:** No external identity provider integration
- **Reporting / analytics:** No built-in reporting screen; `recharts` is included in dependencies but usage is limited to stat cards on the dashboard
- **Offline support:** No service worker or offline cache — requires live internet connection
