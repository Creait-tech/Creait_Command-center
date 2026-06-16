# April 28 Review Call — Prep Document
## QWN GHL Build Status for Asia Kuykendall
**Call Date**: Tuesday, April 28, 2026 at 2:00 PM
**Prepared by**: CREAIT (Reece/Maurice) | **Updated**: 2026-04-21

---

## WHAT'S BUILT AND LIVE IN GHL RIGHT NOW

### Infrastructure (API-verified as of April 21)
| Item | Count | Status |
|------|-------|--------|
| Pipeline: QW Founder Journey | 6 stages | LIVE |
| Custom Fields | 26 fields | LIVE |
| Tags (system) | 20 new + 7 legacy | LIVE |
| Contacts | Henry, Friends Funeral, Diamond Davis, Daryl Bond | LIVE |
| Opportunities | Henry (Stage 3), Friends Funeral (Stage 0), Diamond Davis (Stage 0) | LIVE |
| Workflows (draft) | 4 — Warm Lead Nurture, Engagement Letter, Doc Collection, Re-Engagement | DRAFT |
| Email templates (Q-Pilot) | 8 — full 90-day QWT course series | LIVE |
| Email templates (QWS SOP) | 0 — need to be created in UI | PENDING |

### Custom Fields Live (all 26)
Document checklist (10 checkboxes), Module completion tracking (4 checkboxes), Documents Complete master flag, Service Tier, QBO Access Confirmed, Kickoff Call Date, Monthly Deliverable Day, Assigned Strategist, Founder Portal Access, Communication Preference, 30-Day Review Call Date, Onboarding Start Date, Cleanup Period Months, How Did You Hear About Us

### Tags Live (20 new + 7 existing)
All jumpstart tags, module completion tags, engagement letter tags, service tier tags, re-engagement tags — ready to use in workflows.

---

## WHAT REECE NEEDS TO DO BEFORE THE CALL (UI WORK)

### Priority 1 — Workflows (est. 2–3 hours in GHL UI)
Using QWN-Workflow-Build-Manual.md as the guide:

- [ ] **Open existing draft: QW Founder Warm Lead Nurture** — wire all steps + SMS copy
- [ ] **Open existing draft: Pre-Onboarding Engagement Sequence** — wire all steps + SMS copy
- [ ] **Open existing draft: Onboarding Document Collection Sequence** — wire all steps + SMS copy
- [ ] **Open existing draft: Paused Follow-Up Sequence** — wire all steps + SMS copy
- [ ] **Create new: JumpStart 4-Week Workflow** (Workflow 5 in manual) — most complex, do last

### Priority 2 — Email Templates (est. 1–2 hours in GHL UI)
Using QWS-Email-Templates-GHL.md as the copy source:

Go to: Marketing > Emails > Templates > New Template for each:
- [ ] PC-01: "You're officially in, [First Name]. Welcome to Quantum Wealth Strategy."
- [ ] DOC-01: "Action Needed: Your QWS Document Checklist"
- [ ] KC-01: "Your QWS JumpStart is officially underway"
- [ ] W1-01: "Your first lesson is ready, Co-Pilot. Let's go."
- [ ] W2-01: "Week 2 is here, [First Name]. Time to build your foundation."
- [ ] W3-01: "Week 3: It's time to put profit first"
- [ ] W4-01: "Final week, [First Name]. Let's talk strategy."
- [ ] GRAD-01: "You did it, [First Name]. Welcome to the Active Founder Family."

### Priority 3 — Custom Values (est. 20 minutes)
Settings > Custom Values > Add:
- [ ] `booking_link` = https://www.quantumwealththeory.com/widget/bookings/founderdiscovery
- [ ] `intake_form_link` = [placeholder until Asia provides]
- [ ] `portal_link` = [placeholder until Asia provides]
- [ ] `drive_link` = [placeholder until Asia provides]
- [ ] `engagement_letter_link` = [placeholder until Asia provides]

---

## WHAT ASIA NEEDS TO PROVIDE (BLOCKERS — COLLECT ON CALL)

### P0 — Cannot publish workflows without these
| Item | Why It's Needed | Where It Goes |
|------|----------------|--------------|
| **Intake form URL** | Lead entry point for new warm leads | Workflow 7 trigger + email copy |
| **Engagement letter URL** | DocuSign/PandaDoc link for Stage 1 | Email copy + custom value |
| **Founder portal URL** | Where Founders access webinars | W1-01 through GRAD-01 email templates |
| **Google Drive upload folder link** | Where Founders upload docs | DOC-01 email template |
| **Business phone number** | SMS sender number in GHL | All SMS workflows |
| **QWS team email** | Reply-to on all templates | Email template settings |

### P1 — Needed to complete educational series
| Item | Why It's Needed | Timeline |
|------|----------------|---------|
| **Webinar recordings (4 videos)** | The actual Week 1–4 content | Can stagger — need W1 first |
| **Founder portal platform** | Where videos live (Kajabi, ClickFunnels, GHL Courses?) | Need to know to build links |
| **Financial Health Self-Assessment form** | Referenced in W1-01 and KC-01 emails | Build in GHL Forms or external |
| **Profit First Setup Worksheet (PDF)** | Referenced in W3-01 email | Asia to provide PDF |
| **QWS Ongoing Services Overview (PDF)** | Referenced in W4-01 email | Asia to provide PDF |
| **30-Day Review Call booking link** | Separate from discovery call? Or same calendar? | Confirm on call |

### P2 — Nice to have before launch
| Item | Notes |
|------|-------|
| Q-Pilot avatar/photo | For email template headers |
| Email sending domain | settings.leadconnectorhq.com > Email Services > verify quantumwealthnetwork.com |
| QWS team phone number | For SMS sender ID in GHL |
| JumpStart milestone labels | Customize Stage 3–6 names if different from current |

---

## WHAT TO DEMO ON THE APRIL 28 CALL

### Walk Asia Through (10 min)
1. **Open GHL → Contacts** — show Henry in Stage 3 with all custom fields populated
2. **Open pipeline view** — show the 6-stage pipeline with Henry, Friends Funeral, Diamond Davis
3. **Show tag system** — open Henry's contact, show the 5 tags applied
4. **Show automation drafts** — Automation > Workflows, show 4 draft workflows by name
5. **Show custom fields on contact record** — all 26 fields visible on contact detail page

### Collect From Asia Live (20 min)
- Screen share into her GHL or have her pull up the assets as you go through the P0/P1 list
- Get portal URL, business phone, Drive link at minimum
- Confirm webinar platform decision

---

## WHAT LAUNCHES AUTOMATICALLY ONCE WORKFLOWS ARE PUBLISHED

When Reece publishes the 4 existing draft workflows:

| Event | What Triggers Automatically |
|-------|---------------------------|
| New contact enters Stage 0 | Full 14-day nurture sequence fires |
| Contact enters Stage 1 | Engagement letter follow-up sequence fires |
| Contact enters Stage 2 | Document collection sequence fires |
| Contact enters Stage 5 | Re-engagement sequence fires |

Henry will **not** be affected (he's in Stage 3, these workflows trigger at earlier stages).
Friends Funeral and Diamond Davis are in Stage 0 — the Warm Lead workflow **will fire for them** once published. Confirm this is intentional before publishing.

---

## OPEN QUESTIONS FOR APRIL 28 CALL

1. **Intake form platform**: Build in GHL (Forms) or link to external (Typeform, JotForm)?
2. **Engagement letter tool**: DocuSign? PandaDoc? GHL Documents?
3. **Webinar platform**: GHL Courses? Kajabi? Just Loom links? Vimeo?
4. **SMS number**: Does Asia already have a Twilio/LC Phone number in GHL?
5. **Email domain**: Has quantumwealthnetwork.com been verified for sending?
6. **Multiple brands in one GHL**: Is QWS (bookkeeping), QWN (community), QWT (course) all in this one location? Or separate?
7. **Henry's active status**: He's in Stage 3 — has he received any documents or webinar access yet?

---

## 90-DAY COURSE (QWT) STATUS

8 email templates for the 90-day QWT course drip are ALREADY LIVE in GHL.
The **automation workflow** for the 90-day drip has NOT been built yet.
This is a lower priority than the Founder Journey workflows.

Build this after the 4 existing drafts are published.
Full copy and conditional logic is documented in: **QW-90Day-Course-Automation-Copy.md**

---

## FULL DELIVERABLE INVENTORY (as of April 21)

| Deliverable | File | Status |
|------------|------|--------|
| Pipeline + stages | GHL (live) | DONE |
| Custom fields (26) | GHL (live) | DONE |
| Tags (20 new) | GHL (live) | DONE |
| Q-Pilot email sequences | QW-Founder-Journey-Email-Sequences.md | DONE |
| 90-day course drip copy | QW-90Day-Course-Automation-Copy.md | DONE |
| GHL Setup Guide (manual steps) | GHL-Setup-Guide.md | DONE |
| SOP email templates (8) | QWS-Email-Templates-GHL.md | COPY READY — needs UI entry |
| Workflow build manual (9 workflows) | QWN-Workflow-Build-Manual.md | DONE |
| Contacts (4) | GHL (live) | DONE |
| Opportunities (3) | GHL (live) | DONE |
| Workflows (4 drafts) | GHL (draft) | NEEDS WIRING |
| Workflows (5 new) | Documented only | NEEDS BUILD |
| Brand voice guide | QWN_Brand_Voice_Guide_v3.1.pdf | REFERENCE |
| Intake surveys | Member_Partner Intake Surveys.docx.pdf | REFERENCE |

---

## ESTIMATED TIME TO LAUNCH READY

| Task | Time | Who |
|------|------|-----|
| Create 8 email templates in GHL | 1.5 hrs | Reece |
| Wire 4 existing draft workflows | 2 hrs | Reece |
| Create JumpStart 4-week workflow (Workflow 5) | 1 hr | Reece |
| Create entry point workflows (6 + 7) | 45 min | Reece |
| Add custom values (5 URLs) | 20 min | Reece (needs Asia's URLs first) |
| Publish and test workflows | 30 min | Reece |
| **Total** | **~6 hours** | Reece after Asia provides P0 items |

**If Asia provides P0 items during the April 28 call: system can go live April 29.**
