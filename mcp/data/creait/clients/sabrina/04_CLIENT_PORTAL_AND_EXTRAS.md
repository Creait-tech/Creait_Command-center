# Client Portal, Social Scheduler, Reputation, Extras

---

## Client Portal (the thing Sabrina said Easy Links had that "you might not have")

**Shayla's response in the call:** "We can build that with the AI website tool."

### Build (via CreAIt OS AI Partner Portal feature)
- Auth: client email + magic link (no passwords)
- What clients see when logged in:
  - **My Policies** — list of active policies with key info (carrier, #, premium, expiration, ID cards)
  - **Documents** — declarations pages, COIs, endorsements, claim records
  - **Request a Certificate of Insurance** — form that notifies Sabrina + auto-drafts from template
  - **Request a Claim** — form with emergency claim phone number at top + incident description
  - **Make a Payment** — link to payment processor (if applicable to direct-bill policies)
  - **Book a Call** — Renewal Review calendar
  - **My Contact Info** — clients can update their own phone/address (reflects back to GHL contact)

### Upload Permissions
- Clients can UPLOAD documents (e.g., updated business license) via the portal
- Files attach to their contact + apply `docs:received` tag + notify Sabrina

### What Clients CANNOT Do
- Cannot edit policy info (Sabrina controls source of truth)
- Cannot cancel policy in-portal (generates a request, Sabrina handles)

---

## Social Media Scheduler

**Built-in:** Social Planner in CreAIt OS
**Connected accounts:** IG, FB, LinkedIn, TikTok (+ YouTube Shorts when she's ready)

### Weekly Calendar Template
- Mon — Educational post (cyber or pro-liab explainer)
- Tue — Client story / testimonial
- Wed — Video Reel (Sabrina answering a common question)
- Thu — Industry news / regulation update
- Fri — Call to action (book a free quote, Q&A, etc.)
- Sat — Personal / brand humanization (she mentioned family / community; keeps relationship feel)

### AI Content Assist
- Weekly prompt to Claude: "Give me 5 post ideas for Franklin Insurance Solutions this week focused on [pro-liab / cyber / surety]"
- Sabrina picks + edits + schedules in GHL

### Cross-Post
- One upload → posts to all selected platforms with platform-appropriate caption length
- Hashtag templates saved per product (cyber hashtags, pro-liab hashtags, etc.)

---

## Reputation Management

**Built-in module.** Auto-sends Google review asks (W17) and monitors.

### Setup
1. Connect Google Business Profile for Franklin Insurance Solutions
2. Connect Yelp (if listed)
3. Connect Facebook page
4. Set review request triggers (W17 — 3 days post-bind)
5. Set notification to Sabrina on any new review (positive or negative)

### Negative Review Handling
- Any review < 4 stars → no auto-response; Sabrina gets SMS alert
- Auto-draft response for Sabrina to edit + approve before posting

---

## Document Signing (replaces her separate DocuSign need)

**Built-in:** GHL Documents module.

### Templates to prep during onboarding
1. **Broker of Record Letter** — standard template, client signs to name Franklin as BoR
2. **Policy Acceptance** — confirms client reviewed quote and accepts
3. **Service Agreement** — for ongoing relationship, covers commission disclosure
4. **NDA** — for initial discussions with larger prospects

### Workflow
- Sabrina generates from template, inputs client name + policy info
- Sends via email with one-click sign
- Signed docs auto-attach to contact record
- Tag `docs:signed-<type>` applied

---

## Newsletter Builder

**W13** uses this. Setup:
- Template: Franklin Insurance branded (logo, colors, photo of Sabrina)
- Variants per segment (built in W13 — cyber-heavy, pro-liab-heavy, client retention, networking)
- Schedule: Wednesdays 9 AM CT
- Opt-out tracking: every send pulls unsubscribe list at send time

---

## Payments (for bonds + direct-bill where applicable)

**Connected processors:** Stripe (preferred), PayPal backup
**Use cases:**
- Bond premium payment after binding
- Service fees (if Sabrina charges them)
- Deposit for new client onboarding (optional)

Invoices auto-generate from opportunity records.

---

## Mobile App

Sabrina's phone = GHL LeadConnector mobile app.
- All conversations in one thread
- One-tap SMS reply to leads
- Quick-action links in daily digest work from the app
- Calendar view
- Push notifications for high-value lead alerts
