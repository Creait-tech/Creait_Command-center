# Build Checklist — 10-Day Execution Plan

**Target go-live:** Day 10 from onboarding call

---

## Day 1 — Foundation

- [ ] Create Franklin Insurance Solutions sub-account in CreAIt OS (app.getcreait.com)
- [ ] Add Sabrina as user (Admin role)
- [ ] Configure business profile (address, phone, email, logo, hours)
- [ ] Connect email (Google Workspace SMTP + IMAP for inbound)
- [ ] Provision Trulio phone number; start A2P 10DLC registration
- [ ] Set up subdomain for GHL (e.g., app.franklininsurancesolutions.com)
- [ ] Configure DNS in GoDaddy
- [ ] Create all custom fields per `02_Schema/01_CUSTOM_FIELDS.md`
- [ ] Create tag taxonomy per `02_Schema/02_TAGS.md`

## Day 2 — Pipelines + Forms

- [ ] Build 4 pipelines (Cyber, Pro-Liab, Surety, Cross-Sell/Renewal) per `03_PIPELINES.md`
- [ ] Build Form 1 — Cyber Intake
- [ ] Build Form 2 — Pro-Liab Intake with dynamic redirect
- [ ] Build Form 3 — Surety Intake
- [ ] Build Form 4 — Business Card Scan (Sabrina-only)
- [ ] Build Form 5 — General Contact
- [ ] Build Form 6 — Client Document Upload
- [ ] Configure dynamic redirect URLs for pro-liab based on Service Type
- [ ] Generate embed codes for Wix

## Day 3 — Calendars + Smart Lists

- [ ] Build 5 calendars per `02_CALENDARS.md`
- [ ] Connect Sabrina's Google Calendar for availability sync
- [ ] Build all Smart Lists per `04_SMART_LISTS.md`
- [ ] Configure Opportunity dashboards (home screen views)

## Day 4–5 — Workflows + Messaging

- [ ] Build W01 — Cyber Lead Intake
- [ ] Build W02 — Cyber Nurture (import all Cyber email + SMS templates)
- [ ] Build W03 — Pro-Liab Lead Intake
- [ ] Build W04 — Pro-Liab Nurture
- [ ] Build W05 — Surety Lead Intake
- [ ] Build W06 — Surety Nurture
- [ ] Build W07 — Quote Sent Follow-Up
- [ ] Build W08 — Bound Client Welcome
- [ ] Build W09 — Renewal 11-Month
- [ ] Import all email templates from `04_Messaging/*` files
- [ ] Import all SMS templates
- [ ] Test merge fields on a sample contact

## Day 6 — Guardrails, Digest, Extras

- [ ] Build W14 — Reply-Stop Guardrail (test with internal email/SMS)
- [ ] Build W15 — Unsubscribe Handler
- [ ] Build W16 — Daily Digest to Sabrina
- [ ] Build W17 — Google Review Ask
- [ ] Build W19 — Dormant Re-Engagement
- [ ] Build W10 — Business Card Drip
- [ ] Build W18 — Business Card Scan AI Extract
- [ ] Build W11, W12 — Cross-Sell sequences
- [ ] Build W13 — Weekly Newsletter schedule + template

## Day 7 — AI Agents

- [ ] Configure AI Voice Agent persona + knowledge base
- [ ] Configure AI Chat Widget for website + GHL pages
- [ ] Configure DM agent (IG, FB, WhatsApp)
- [ ] Upload knowledge base docs (products, FAQ, claims script, licensing)
- [ ] Test each agent end-to-end
- [ ] Set up W22 — Voice post-call workflow
- [ ] Set up W23 — Chat/DM post-convo workflow

## Day 8 — Sync + Compliance

- [ ] Build W20 — Easy Links Sync (API, Zapier, or CSV fallback per `01_EASY_LINKS_SYNC.md`)
- [ ] Initial sync: import Easy Links contact list
- [ ] Sabrina reviews imports and confirms stage tags
- [ ] Build W21 — Compliance Archive weekly export
- [ ] Create Google Drive folder structure for 10-yr archive
- [ ] Verify email + SMS footers include all required disclosures
- [ ] Verify consent gating on all forms

## Day 9 — Client Portal + Website Content

- [ ] Build AI Partner Portal for Franklin Insurance clients
- [ ] Create landing pages for each product (cyber, pro-liab, surety)
- [ ] Embed GHL chat widget on Wix
- [ ] Connect social accounts (IG, FB, LI, TT) to Social Planner
- [ ] Connect Google Business Profile to Reputation module
- [ ] Configure document templates (BoR Letter, Service Agreement, etc.)
- [ ] Configure Stripe/payments
- [ ] **UAT Call with Sabrina** — walk through every flow end-to-end

## Day 10 — Go-Live

- [ ] Final smoke test: submit each form, verify workflow fires
- [ ] Send test daily digest
- [ ] Send one real newsletter to a small segment (Sabrina + one test contact)
- [ ] Verify A2P 10DLC status (may still be pending — delay SMS sends if so)
- [ ] Sabrina training session (60 min recorded) — how to use the system daily
- [ ] Hand over run-book (cheat sheet: common tasks)
- [ ] Post-go-live check-in scheduled for Day 14

---

## Post-Launch (Week 3+)

- [ ] Week 2: Check sequence performance, unsubscribe rates, reply rates
- [ ] Week 3: First batch of business cards imported (if she has them)
- [ ] Week 4: First cross-sell sequence fires on an existing client
- [ ] Month 2: Review what's working in the daily digest; refine
- [ ] Month 3: Reassess if any current construction/workers-comp workflow is needed

---

## Sabrina's Run-Book (cheat sheet)

1. **New lead came in** → Check daily digest → open contact → start conversation if AI hasn't already
2. **Quoted a policy** → Upload quote PDF → move opportunity to Quoted → W07 handles follow-ups
3. **Client bound** → Move opportunity to Bound → W08 sends welcome → review request goes out in 3 days
4. **Someone replied angrily** → `flag:reply-stop` is already applied → you personally reach out to fix
5. **Networking event ends** → Take photos of cards → submit Business Card Scan form → W18 runs
6. **Weekly newsletter** → Wednesday morning: review draft, edit, schedule send
7. **Client needs a COI** → They request via portal → you generate from template → deliver
8. **Renewal coming up** → 30 days out → you get an alert → W09 runs outreach → you close it
