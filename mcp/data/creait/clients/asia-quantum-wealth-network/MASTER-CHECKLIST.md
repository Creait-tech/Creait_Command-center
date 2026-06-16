# QWN GHL Build — Master Completion Checklist
## Everything Left To Do, Organized For Agent Delegation

**Last Updated**: 2026-04-28
**Current Status**: 95% infrastructure built, needs UI wiring + Asia inputs
**Owner**: Maurice (Reece) | **Client**: Asia K. / Quantum Wealth Network

---

## HOW TO USE THIS CHECKLIST

Every task is tagged with:
- **[AGENT]** — Can be done by an AI agent / automation (no human input needed)
- **[REECE-UI]** — Requires Reece in the GHL UI (~30-60 min each)
- **[ASIA]** — Blocked on Asia providing input
- **[REECE-DECISION]** — Reece needs to make a decision then execute

Each task has:
- **Time estimate**
- **Dependencies** (what needs to happen first)
- **Output** (what "done" looks like)
- **Reference doc** (where to find specs)

---

## PHASE 1: GO-LIVE BLOCKERS (Complete by April 30)

### 1.1 Collect Asia's Inputs [ASIA] — ~15 min for Asia

| # | Task | Status | Output |
|---|------|--------|--------|
| 1.1.1 | Get Intake Form URL | PENDING | Real URL replaces `intake_form_link` placeholder |
| 1.1.2 | Get Engagement Letter URL (DocuSign/PandaDoc) | PENDING | Real URL replaces `engagement_letter_link` placeholder |
| 1.1.3 | Get Founder Portal URL | PENDING | Real URL replaces `portal_link` placeholder |
| 1.1.4 | Get Document Upload Folder Link (Google Drive) | PENDING | Real URL replaces `drive_link` placeholder |
| 1.1.5 | Get Business Phone Number for SMS | PENDING | Number registered in `qws_phone` |
| 1.1.6 | Webinar Platform Decision (GHL Courses / Kajabi / Zoom / Other) | PENDING | Decision documented |

**Send Asia**: `ASIA-CALL-PREP-Apr28.pdf` (already created)

---

### 1.2 Update Custom Values [AGENT] — ~5 min

**Trigger**: After Asia provides inputs in 1.1

| # | Task | Status |
|---|------|--------|
| 1.2.1 | PATCH `intake_form_link` custom value via API | PENDING |
| 1.2.2 | PATCH `engagement_letter_link` custom value via API | PENDING |
| 1.2.3 | PATCH `portal_link` custom value via API | PENDING |
| 1.2.4 | PATCH `drive_link` custom value via API | PENDING |
| 1.2.5 | PATCH `qws_phone` custom value via API | PENDING |

**API**: `PATCH https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customValues/{id}`
**Delegate to**: GHL API agent

---

### 1.3 Wire 4 Existing Draft Workflows [REECE-UI] — ~2 hrs

**Reference**: `QWN-Workflow-Build-Manual.md` (full step-by-step)
**Location**: GHL → Automation → Workflows

| # | Workflow | GHL ID | Time | Status |
|---|----------|--------|------|--------|
| 1.3.1 | QW Founder Warm Lead Nurture (Stage 0) | 489c3f46-02ef-4f2e-8b0e-72d865e5415b | 30 min | DRAFT — needs steps wired |
| 1.3.2 | QW Engagement Letter Follow-Up (Stage 1) | 31b1a50c-c29e-47ca-bae1-dd3d3368101b | 30 min | DRAFT — needs steps wired |
| 1.3.3 | QW Document Collection (Stage 2) | e82a7033-9e9b-4501-9097-6cab369fd8d3 | 30 min | DRAFT — needs steps wired |
| 1.3.4 | QW Re-Engagement (Stage 5) | (check workflow list) | 30 min | DRAFT — needs steps wired |

**For each workflow**:
- Open in GHL Automation > Workflows
- Add steps per manual (waits, send email/SMS, IF/ELSE branches, tags, internal notifications)
- Configure communication limits (1 email/day, 1 SMS/day, 9am-6pm EST window)
- Set exit conditions
- Save as draft (publish in Phase 1.5)

**Delegate to**: Reece OR a GHL workflow specialist

---

### 1.4 Create 5 New Workflows [REECE-UI] — ~2.5 hrs

**Reference**: `QWN-Workflow-Build-Manual.md` (Workflows 5-9)

| # | Workflow | Trigger | Time |
|---|----------|---------|------|
| 1.4.1 | JumpStart 4-Week Educational Series (Stage 3) | Contact enters Stage 3 | 60 min |
| 1.4.2 | Entry Points: Calendar Booking → Stage 0 | Calendar appointment booked | 20 min |
| 1.4.3 | Entry Points: Form Submission → Stage 0 | Intake form submitted | 20 min |
| 1.4.4 | Module Tracker (Module 1-4 completion → Stage 4) | Custom field "Module X Complete" = true | 30 min |
| 1.4.5 | Engagement Letter Signed → Stage 2 Auto-Advance | Custom field "Engagement Letter Signed" = true | 20 min |

**For each**: Same process as 1.3 — open builder, wire trigger + steps + exit conditions, save as draft.

---

### 1.5 Pre-Launch Verification [REECE-UI] — ~1 hr

| # | Task | Time | Status |
|---|------|------|--------|
| 1.5.1 | Verify email sending domain (quantumwealthnetwork.com) in Settings > Email Services | 15 min | PENDING |
| 1.5.2 | Create Calendar for kickoff calls in Calendars (if not exists) | 15 min | PENDING |
| 1.5.3 | Connect SMS phone number in Settings > Phone System | 15 min | PENDING |
| 1.5.4 | Test all 9 workflows with Henry (test contact) | 30 min | PENDING |
| 1.5.5 | Verify SMS sends from correct number | 5 min | PENDING |
| 1.5.6 | Verify emails send from quantumwealthnetwork.com domain | 5 min | PENDING |

---

### 1.6 Publish Workflows [REECE-UI] — ~10 min

| # | Task | Status |
|---|------|--------|
| 1.6.1 | Toggle QW Founder Warm Lead Nurture → Published | PENDING |
| 1.6.2 | Toggle QW Engagement Letter Follow-Up → Published | PENDING |
| 1.6.3 | Toggle QW Document Collection → Published | PENDING |
| 1.6.4 | Toggle QW Re-Engagement → Published | PENDING |
| 1.6.5 | Toggle JumpStart 4-Week Educational Series → Published | PENDING |
| 1.6.6 | Toggle Entry Points (Calendar) → Published | PENDING |
| 1.6.7 | Toggle Entry Points (Form) → Published | PENDING |
| 1.6.8 | Toggle Module Tracker → Published | PENDING |
| 1.6.9 | Toggle Engagement Signed Auto-Advance → Published | PENDING |

---

### 1.7 Cleanup [REECE-UI] — ~15 min

| # | Task | Status |
|---|------|--------|
| 1.7.1 | Delete duplicate templates (older `69dddc...` prefixed versions) | PENDING |
| 1.7.2 | Delete `_DELETE-test` placeholder template | PENDING |
| 1.7.3 | Verify final template count (should be ~21 unique) | PENDING |

---

## PHASE 2: MINI PROJECT 3 — COMMUNITY BUILD (~4-6 weeks)

**Status**: 5% built (90-day course copy + 8 templates only)
**Blocker**: Most items need content from Asia

### 2.1 GHL Community Infrastructure [REECE-UI] — ~3 hrs

| # | Task | Status | Blocker |
|---|------|--------|---------|
| 2.1.1 | Create "Explorer" free community group | PENDING | - |
| 2.1.2 | Create "Builder" paid community group ($300/$99/yr tier) | PENDING | Pricing decision from Asia |
| 2.1.3 | Configure community settings, branding, welcome posts | PENDING | - |
| 2.1.4 | Set up access tiers (Explorer = free, Builder = paid) | PENDING | - |
| 2.1.5 | Connect Stripe / payment processor for Builder tier | PENDING | Asia confirms payment platform |

### 2.2 Mini Jumpstart Series (3-Module Free Funnel) [AGENT + ASIA] — ~6 hrs

| # | Task | Owner | Blocker |
|---|------|-------|---------|
| 2.2.1 | Get Jumpstart slides/recordings from Asia | ASIA | Content from Asia |
| 2.2.2 | Create GHL Course shell for Jumpstart (3 modules) | REECE-UI | - |
| 2.2.3 | Module 1: "The Problem" — upload content | REECE-UI | 2.2.1 |
| 2.2.4 | Module 2: "The Introduction" — upload content | REECE-UI | 2.2.1 |
| 2.2.5 | Module 3: "Health + Wealth" — upload content | REECE-UI | 2.2.1 |
| 2.2.6 | Final naming with space metaphor (Pre-Flight Check, Ignition Sequence, First Launch) | ASIA | Decision from Asia |
| 2.2.7 | Build opt-in landing page for Jumpstart | AGENT | - |
| 2.2.8 | Money Personality Quiz survey | AGENT | - |
| 2.2.9 | Lead magnet delivery (Legacy Checklist PDF) | AGENT | - |
| 2.2.10 | Welcome automation on Explorer signup | REECE-UI | - |
| 2.2.11 | Tag `tier_explorer` on signup | AGENT | - |
| 2.2.12 | Completion tag `Jumpstart-Complete-Warm-Lead` | AGENT | - |
| 2.2.13 | CTA automation: invite to discovery call on completion | REECE-UI | - |

### 2.3 Book & Media Lounge [REECE-UI] — ~3 hrs

| # | Task | Owner | Blocker |
|---|------|-------|---------|
| 2.3.1 | Get curated content list from Asia (books, podcasts, articles) | ASIA | Content from Asia |
| 2.3.2 | Create community section/page | REECE-UI | - |
| 2.3.3 | Set up 4 categories (Books, Podcasts, Articles, Videos) | REECE-UI | - |
| 2.3.4 | Upload initial content set | REECE-UI | 2.3.1 |
| 2.3.5 | Q-Pilot notification workflow for new content additions | REECE-UI | - |
| 2.3.6 | Configure access (Explorer = read-only, Builder = full) | REECE-UI | - |

### 2.4 QWT Full Course (7 Phases) [ASIA + REECE-UI] — ~8 hrs

| # | Task | Owner | Blocker |
|---|------|-------|---------|
| 2.4.1 | Get full QWT curriculum from Asia (7 phases) | ASIA | Major content blocker |
| 2.4.2 | Create GHL Course shell for QWT | REECE-UI | - |
| 2.4.3 | Phase 1: Foundation + Clarity — upload content | REECE-UI | 2.4.1 |
| 2.4.4 | Phase 2: Structure + Capital Access — upload content | REECE-UI | 2.4.1 |
| 2.4.5 | Phase 3: Growth + Scaling — upload content | REECE-UI | 2.4.1 |
| 2.4.6 | Phase 4: Wealth Protection + Accumulation — upload content | REECE-UI | 2.4.1 |
| 2.4.7 | Phase 5: Sovereignty + Multigenerational Wealth — upload content | REECE-UI | 2.4.1 |
| 2.4.8 | Configure module unlock logic (sequential vs open) | REECE-DECISION | Asia decides |
| 2.4.9 | Add Mission framework (Reflect, Discuss, Practice, Assess, Affirm) per phase | REECE-UI | 2.4.1 |
| 2.4.10 | "Quantum Pilot" tag on full curriculum completion | AGENT | - |

### 2.5 90-Day Q-Pilot Drip Workflow [REECE-UI] — ~2 hrs

**Templates already exist (8 emails). Workflow needs to be built.**

| # | Task | Status |
|---|------|--------|
| 2.5.1 | Build workflow with 10 wait steps | PENDING |
| 2.5.2 | Wire Day 1 email (template exists) | PENDING |
| 2.5.3 | Wire Day 3 SMS | PENDING |
| 2.5.4 | Wire Day 7 conditional (Module 1 complete?) | PENDING |
| 2.5.5 | Wire Day 14 SMS | PENDING |
| 2.5.6 | Wire Day 21 email | PENDING |
| 2.5.7 | Wire Day 30 email + SMS combo | PENDING |
| 2.5.8 | Wire Day 45 SMS | PENDING |
| 2.5.9 | Wire Day 60 email | PENDING |
| 2.5.10 | Wire Day 75 SMS | PENDING |
| 2.5.11 | Wire Day 90 email + SMS (with conditional re-enroll branch) | PENDING |
| 2.5.12 | Test with sample contact | PENDING |
| 2.5.13 | Publish | PENDING |

### 2.6 5-Year Journey Visual Roadmap [ASIA + DESIGNER] — ~4 hrs

| # | Task | Owner | Blocker |
|---|------|-------|---------|
| 2.6.1 | Get final milestone names + advancement logic from Asia | ASIA | Asia decision |
| 2.6.2 | Design visual roadmap (5 phases: Survival → Stability → Strategy → Stewardship → Legacy) | DESIGNER | 2.6.1 |
| 2.6.3 | Build into community as visual page | REECE-UI | 2.6.2 |
| 2.6.4 | Custom field `journey_phase` on contact | AGENT | - |
| 2.6.5 | Q-Pilot milestone celebration workflow | REECE-UI | 2.6.1 |

### 2.7 Gamification Layer (Builder Tier) [REECE-UI] — ~3 hrs

| # | Task | Status |
|---|------|--------|
| 2.7.1 | Activate GHL Communities native points/leaderboard | PENDING |
| 2.7.2 | Configure 16+ point triggers (5pts daily reflection → 150pts 1-yr milestone) | PENDING |
| 2.7.3 | Build 10 badge system (mapped to QWT phase completions) | PENDING |
| 2.7.4 | Configure leaderboard visibility in Builder community | PENDING |
| 2.7.5 | Wire badge trigger workflows (5 Mission steps required) | PENDING |

---

## PHASE 3: MINI PROJECT 4 — PARTNER PORTAL (~2-3 weeks)

**Status**: 0% built
**Spec exists**: `Member_Partner Intake Surveys.docx.pdf` has all 27 fields documented

### 3.1 Partner Application Form [AGENT + REECE-UI] — ~3 hrs

| # | Task | Status |
|---|------|--------|
| 3.1.1 | Replicate 27-question Partner Application as GHL Survey | PENDING |
| 3.1.2 | Section 1 (Who You Are) — 9 fields | PENDING |
| 3.1.3 | Section 2 (Experience) — 6 fields | PENDING |
| 3.1.4 | Section 3 (Mission Alignment) — 7 fields | PENDING |
| 3.1.5 | Section 4 (Partnership Expectations) — 5 fields | PENDING |
| 3.1.6 | Auto-notification to Asia/Monica on submission | AGENT |
| 3.1.7 | Tag `partner_applied` on submission | AGENT |

### 3.2 Partner Scoring Rubric [AGENT + REECE-UI] — ~2 hrs

| # | Task | Status |
|---|------|--------|
| 3.2.1 | Create 5 scoring custom fields (1-5 scale each) | AGENT |
| 3.2.2 | Create `partner_score_total` calculated field (/25) | AGENT |
| 3.2.3 | Create `partner_tier` dropdown (Founding / Network) | AGENT |
| 3.2.4 | Create `partner_status` dropdown (Applied/Under Review/Approved/Active/Inactive) | AGENT |
| 3.2.5 | Build internal scoring form for review team | REECE-UI |
| 3.2.6 | Auto-tag based on threshold (18-25 strong, 12-17 discovery, <12 hold) | REECE-UI |

### 3.3 Partner Pipeline [REECE-UI] — ~30 min

| # | Task | Status |
|---|------|--------|
| 3.3.1 | Create new pipeline "Partner Network Pipeline" | PENDING |
| 3.3.2 | Add stage: Applied | PENDING |
| 3.3.3 | Add stage: Under Review | PENDING |
| 3.3.4 | Add stage: Approved | PENDING |
| 3.3.5 | Add stage: Active | PENDING |
| 3.3.6 | Add stage: Inactive | PENDING |

### 3.4 Partner Directory [REECE-UI] — ~3 hrs

| # | Task | Status | Blocker |
|---|------|--------|---------|
| 3.4.1 | Decision: public on website or members-only? | REECE-DECISION | Asia |
| 3.4.2 | Create directory page in community | PENDING | 3.4.1 |
| 3.4.3 | Build partner profile cards (name, specialty, bio, booking link) | PENDING | - |
| 3.4.4 | Add search/filter by specialty | PENDING | - |
| 3.4.5 | Configure access levels | PENDING | - |

### 3.5 Partner Onboarding [REECE-UI] — ~2 hrs

| # | Task | Status |
|---|------|--------|
| 3.5.1 | Q-Pilot welcome sequence for approved partners (3-5 touchpoints) | PENDING |
| 3.5.2 | Co-marketing materials library | PENDING |
| 3.5.3 | Referral submission form | PENDING |
| 3.5.4 | Referral tracking via `referred_by_partner` custom field | AGENT |

### 3.6 Partner Agreements [REECE-UI] — ~1 hr

| # | Task | Status |
|---|------|--------|
| 3.6.1 | Member Community Agreement v1 — set up e-signature | PENDING |
| 3.6.2 | Partner Standards Agreement v1 — set up e-signature | PENDING |
| 3.6.3 | Wire into partner approval workflow | PENDING |

---

## PHASE 4: MINI PROJECT 5 — QW DASHBOARD (~1-2 weeks)

**Status**: 0% built — blocked on Asia's detailed spec

### 4.1 Get Spec from Asia [ASIA] — Critical blocker

| # | Task | Owner |
|---|------|-------|
| 4.1.1 | Get full dashboard specification from Asia | ASIA |
| 4.1.2 | Decide: GHL-native survey vs embedded external tool | REECE-DECISION |
| 4.1.3 | Decide: One-time assessment vs ongoing tracking | REECE-DECISION |
| 4.1.4 | Decide: Self-reported only vs QuickBooks integration | REECE-DECISION |

### 4.2 Pre-Spec Build (Can Start Now) [AGENT] — ~3 hrs

| # | Task | Status |
|---|------|--------|
| 4.2.1 | Create "Financial Snapshot" GHL Survey with 7 fields | PENDING |
| 4.2.2 | Add 8-10 custom fields for financial metrics | AGENT |
| 4.2.3 | Build basic Q-Pilot response workflow (calculates ratios) | REECE-UI |
| 4.2.4 | 5 phase-specific Q-Pilot guidance email templates | AGENT |

---

## PHASE 5: ONGOING / MAINTENANCE (Post-Launch)

### 5.1 Monitoring [AGENT] — Recurring

| # | Task | Frequency |
|---|------|-----------|
| 5.1.1 | API health check (templates, fields, workflows intact) | Weekly |
| 5.1.2 | Workflow execution logs review | Weekly |
| 5.1.3 | Email deliverability monitoring | Weekly |
| 5.1.4 | New contact tagging audit | Monthly |

### 5.2 Optimization [REECE-UI + AGENT] — Quarterly

| # | Task | Frequency |
|---|------|-----------|
| 5.2.1 | Review email open/click rates per template | Monthly |
| 5.2.2 | A/B test subject lines on lead nurture | Quarterly |
| 5.2.3 | Review pipeline conversion rates by stage | Monthly |
| 5.2.4 | Update email copy based on objection patterns | As needed |

### 5.3 Q-Pilot Evolution [PHASE 2+] — Future

| # | Task | Status |
|---|------|--------|
| 5.3.1 | Q-Pilot avatar design (visual) | BLOCKED on Asia |
| 5.3.2 | Q-Pilot chatbot in GHL community (FAQ responses ready) | PENDING |
| 5.3.3 | Q-Pilot voice agent for call flows | PENDING |

---

## DELEGATION ASSIGNMENTS

### For [AGENT] tasks (no human needed):
**Recommended agent**: General-purpose AI agent with GHL API access (PIT: pit-e86c7ac6...)

| Task Group | Agent Type | Estimated Time |
|------------|------------|----------------|
| 1.2 Update custom values | API agent | 5 min |
| 2.2.7-2.2.12 Jumpstart automations | API agent | 1 hr |
| 3.1.6-3.1.7 Application form notifications | API agent | 30 min |
| 3.2.1-3.2.4 Partner scoring fields | API agent | 30 min |
| 4.2.2 Dashboard custom fields | API agent | 30 min |
| 4.2.4 Phase-specific email templates | Content agent | 1 hr |
| 5.1 Monitoring | Cron agent | Recurring |

### For [REECE-UI] tasks (in GHL UI):
**Recommended**: Reece OR a GHL-trained VA with login credentials

| Task Group | Time | Priority |
|------------|------|----------|
| 1.3 Wire 4 draft workflows | 2 hrs | P0 — this week |
| 1.4 Create 5 new workflows | 2.5 hrs | P0 — this week |
| 1.5-1.7 Verification + publish + cleanup | 1.5 hrs | P0 — this week |
| 2.1-2.7 Community Build | ~25 hrs | P1 — next 2 weeks |
| 3.1-3.6 Partner Portal | ~12 hrs | P2 — next 3 weeks |
| 4.1-4.2 Dashboard | ~6 hrs | P3 — pending Asia |

### For [ASIA] tasks (waiting on her):
**Send her**: `ASIA-CALL-PREP-Apr28.pdf`

| Block | Items |
|-------|-------|
| Go-live blockers | 1.1.1 through 1.1.6 (6 items, 15 min) |
| Phase 2 content | 2.2.1, 2.4.1, 2.6.1, 2.3.1 (curriculum + slides + milestones + content list) |
| Phase 4 spec | 4.1.1 (dashboard requirements) |
| Decisions | 1.1.6, 2.1.5, 2.4.8, 3.4.1 (platform, pricing, unlock logic, directory access) |

---

## TIME ESTIMATES (Aggregate)

| Phase | Agent Time | Reece UI Time | Asia Time | Total |
|-------|------------|---------------|-----------|-------|
| Phase 1 (Go-Live) | 5 min | 4.5 hrs | 15 min | ~5 hrs |
| Phase 2 (Community) | 2.5 hrs | 25 hrs | Multiple sessions | ~30 hrs |
| Phase 3 (Partners) | 1.5 hrs | 12 hrs | 1 hr | ~15 hrs |
| Phase 4 (Dashboard) | 1.5 hrs | 6 hrs | 1 session | ~9 hrs |
| Phase 5 (Ongoing) | Recurring | 1 hr/mo | - | Recurring |

**To go LIVE with Phase 1**: ~5 hours work + Asia's 15 min of inputs

---

## QUICK WINS THIS WEEK (Before April 30)

If you want to focus the next 5 hours of work, do these in order:

1. **Send Asia the prep PDF** (1 min) — `ASIA-CALL-PREP-Apr28.pdf`
2. **Wire Workflow 1: Warm Lead Nurture** (30 min) — Reece in GHL UI
3. **Wire Workflow 2: Engagement Letter Follow-Up** (30 min) — Reece
4. **Wire Workflow 3: Document Collection** (30 min) — Reece
5. **Wire Workflow 4: Re-Engagement** (30 min) — Reece
6. **Verify email sending domain** (15 min) — Reece in Settings
7. **Asia call April 28** — collect 6 inputs (1 hr)
8. **Update custom values via API** (5 min) — Agent
9. **Test all 4 workflows with Henry** (30 min) — Reece
10. **Publish all 4 workflows** (5 min) — Reece

**= 4 hours Reece + 1 hour call = LIVE.**

---

## REFERENCE FILES (All in this folder)

| File | Purpose |
|------|---------|
| `BUILD-STATUS.md` | Live audit status (cycle by cycle) |
| `QWN-Workflow-Build-Manual.md` | Step-by-step workflow build guide |
| `QWS-Email-Templates-GHL.md` | 8 SOP email template copy |
| `QW-Founder-Journey-Email-Sequences.md` | Lead nurture + onboarding email/SMS copy |
| `QW-90Day-Course-Automation-Copy.md` | 10-touchpoint flagship course copy |
| `MP2-Custom-Fields-Spec.md` | Custom fields with API commands |
| `GHL-Setup-Guide.md` | Setup guide + tag system reference |
| `April28-Review-Prep.md` | Internal demo plan for Asia call |
| `ASIA-CALL-PREP-Apr28.pdf` | Asia-facing input request doc |
| `QWN-Process-Visual.html` | Visual process map for client demos |

---

## CONTACT FOR HANDOFF

**Reece**: Owns final GHL UI work, Asia relationship
**Jaylyn**: Owns sales handoff, demo prep
**Asia (client)**: Provides URLs, content, decisions
**LJ (Asia's bookkeeper)**: Receives docs, processes cleanups
**Daryl (referral partner)**: Sends warm leads

---

*Last updated 2026-04-28. Update this file as tasks complete.*
