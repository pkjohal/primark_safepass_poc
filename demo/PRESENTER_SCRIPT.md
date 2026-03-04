# Primark SafePass — Presenter Script

## Opening

Hi — I'm going to walk you through Primark SafePass, a visitor management system. It's a live, digital system that tracks everyone on site in real time, enforces health and safety compliance at check-in, and gives you a live headcount the moment an evacuation is called. 

---

## Scene 1 — Live Dashboard

Let's start as Claire Murphy, our reception manager at the Dublin Mary Street store. She enters her username and her four-digit PIN.

Upon opening she can see the dashboard, which gives her an instant operational picture of curremt and expected visitors for the day. 

The Expected Today table shows every visitor booked in for today with their pre-arrival status. You can see at a glance whether their health and safety induction is done and whether any documents are waiting. 

At the bottom there is a live on-site board. Emma Watson from Primark HQ is already on-site — she's internal staff, so she goes straight through with unescorted access. Raj Patel from Securitas is waiting for his escort. His host Mary Flanagan needs to collect him. 


## Scene 2 — Scheduling a Visit

To schedule a visit, Claire picks the visitor from the list — in this case John Smith from Acme Contractors — sets the date, arrival and departure times, and adds a purpose. She selects a primary host and optionally a backup contact in case the host doesn't respond. She can also attach documents here — an NDA, a site access agreement — anything the visitor needs to review and accept before they arrive.

Once she submits, the visit is created and John receives a notification. 

## Scene 3 — Visitor Self-Service Portal

In a real scenario John would receive an email with a link to his portal, which shows everything he needs before his visit.

He can see his health and safety induction is valid and how long it has left — if the site publishes updated content, this would flip to required and prompt him to review it. He can also review and sign any documents Claire attached, like an NDA, before he arrives.

His upcoming visit is here — purpose, host, site, time — so he knows exactly what to expect.

## Scene 4 — Guided Check-In Wizard

The check in flow allows for receptionists to confirm the presence of a visitor and ensures they have reviewed the health and safety induction and signed any documents. 

The check-in wizard opens with a quick confirmation of the visitors name, company, purpose, host and planned times. As this visitor hasn't done her induction,the health and safety content for the Dublin Mary Street site — a video and written guidance, is shown to the visitor. When viewed, Claire can mark the induction as complete.

No documents were attached to Lisa's visit today, so that step doesn't appear. 

The next step is access determination. As Lisa is a third-party visitor, and doesn't have a pre-approval for unescorted access at this site. Her access status is set to Awaiting Escort. Her host, Mary Flanagan, has been automatically notified that she is checked in and awaiting to be escorted around the site. 

Back on the dashboard, Lisa is now showing in the Awaiting Escort column. 

## Scene 5 — Inbox and Escort Flow

When Lisa gets checked in, her host, Mary, receives a notification telling them she has arrived and needs an escort.

Mary acknowledges it, heads down to reception, collects Lisa, and marks her as escorted from the dashboard. She then moves to the on site - escorted column

If Mary had ignored it, the system wouldn't just wait. After ten minutes it escalates automatically to the backup contact on the visit. After another ten minutes, it goes to all reception and admin staff so no visitor gets left waiting at the front desk.


## Scene 6 — Pre-Approvals and Visitor Profile

Now let's look at the tools available to Pat Kelly, our site admin, starting with pre-approvals.

Pre-approvals are how we manage third-party contractors who visit regularly, for example IT support, maintenance engineers, service engineers.

When a host wants to request unescorted access for a contractor, they do it from the visitor's profile page. There's a request button right in the profile, and once submitted it lands here in Pat's pre-approvals queue as a pending request.

Pat clicks View to open the full request. He can see who submitted it, the justification they provided, and the visitor's complete visit history  He approves it, the next time the contractor checks in, the system finds the approval automatically and grants unescorted access.

## Scene 7 — Emergency Evacuation

Site admins have an additional feature, emergency evacuation. If there is an incident in the building admins can start a evacuation on the system which suspends all check-ins and sign-outs and alert all logged-in users. 

Every screen on this site just showed that banner in real time.

The system captured a snapshot of all the visitors on site the moment the evacuation was activated. The system creates a headcount register of the visitors, which can also be printed if a physical backup is needed. 

As the warden accounts for each person at the assembly point, they check them off. The Close Evacuation button appears only when all visitors have been accounted for. You cannot close the event until every person is ticked off.

Pat adds a note and closes the event. The banner is gone from every screen. Normal operations resume. And in the audit trail, there is now a complete incident timeline: who activated it, when, who was on-site, who closed it, the final headcount, and any notes.

## Scene 8 — Site Configuration

Site configuration is where Pat manages the health and safety content and notification settings for Dublin Mary Street.

The video and written guidance are managed right here — a Markdown editor with a live preview where Pat can edit and publish this directly.

And here's the important part — this orange warning. Publishing new content bumps the version number. Every single visitor's existing induction record becomes invalid. The next time any of them check in or open their self-service portal, they'll be prompted to redo it. That's not a side effect — that's the feature. When fire procedures change, you need to know everyone has been briefed on the new version.
---


## Closing

That's Primark SafePass. From a contractor completing their health and safety induction to a reception team with a live on-site board that tells them exactly who's in the building — to a site admin who can activate a full emergency evacuation and get a verified headcount in under two minutes.