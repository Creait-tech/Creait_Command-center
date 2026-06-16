# Changelog

All notable changes to the AGN (Adult Game Nights) CreateOS build are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — `Added`, `Changed`, `Fixed`, `Removed`, `Security`.
Dates use `YYYY-MM-DD`. Versions = milestone tags, not semver.

> **How to use this file:**
> - Every commit, add a line under `[Unreleased]` describing what changed (one-liner per change)
> - When you ship a milestone (publish workflows, deploy a new domain, launch a campaign), promote `[Unreleased]` items into a dated release block at the top
> - Keep it human — this is a recap log, not git diff. Focus on WHAT changed and WHY it matters, not file names

---

## [Unreleased]

### Added
- A2P 10DLC compliance pages on landing: `/privacy`, `/terms`, `/sms` — each with brand-styled layout, business identity, contact info, and CreateOS chat widget
- `/sms` page includes 7 sample messages, opt-in/opt-out flow, frequency disclosure, supported carriers list — purpose-built for carrier A2P review
- GHL Chat Widget (`6a29c7aa41d7d22db1c2ea47`) embedded site-wide so the AGN Sales Rep AI handles inbound chat from any page
- `docs/A2P-SUBMISSION-GUIDE.md` — exact field-by-field walkthrough for CreateOS Trust Center brand + campaign submission with sample messages, opt-in disclosure copy, and restricted-content answers
- `docs/DOMAIN-CONNECTION-GUIDE.md` — Shopify CNAME + Vercel subdomain setup for `liquorstore.adultgamenights.com`

### Changed
- `vercel.json` now has `cleanUrls: true` + rewrites for `/privacy`, `/terms`, `/sms` (no `.html` in user-facing URLs) + 308 redirects from common aliases (`/privacy-policy`, `/tos`, `/sms-policy`)
- Newsletter form (`app.jsx`) now has visible SMS-style consent disclosure linking to `/privacy` and `/terms`
- Footer legal links replaced placeholder `<a href="#">` with real `/privacy`, `/terms`, `/sms` links — and copybar now shows full legal entity + address: "2WENTY58 ENTERTAINMENT LLC · 504 FAIR ST, ATLANTA GA 30313"
- `styles.css`: added `.newsletter-consent` rule for compliance-disclosure styling under the email form

---

## [v1.0 — Initial Repo Snapshot] — 2026-05-26

First push of the entire AGN CreateOS build to GitHub. State at this commit:

### Added — Infrastructure (live in CreateOS)
- 4 published workflows: Cart Abandonment, Post-Purchase, Reactivation, Game Night Service Booking
- 11 draft workflows pending verification (5 new from AI Builder + 6 pre-existing)
- 25 branded email templates (9 scaffolds upgraded + 6 new broadcast templates)
- 70 custom fields (24 new this session for forms 1-5)
- 14 custom values (6 new broadcast campaign vars)
- 52 tags (8 new for form-triggered automation)
- 4 pipelines (new: Sponsorship & B2B with Lead → Pitched → Negotiating → Signed)
- 16 SMS snippets (10 new via Playwright UI automation)
- 6 forms: Sponsorship Inquiry, Event Reg General, Wholesale Inquiry, Newsletter Signup, Creator UGC + Game Night Service Booking
- 67 KB FAQs in Master KB
- Conversation AI Agent (Suggestive mode, 5 channels: SMS/IG/FB/Live Chat/Chat Widget)

### Added — Landing page (deployed)
- Cinematic landing at https://agn-cinematic-landing.vercel.app
- Edge Function newsletter proxy at `/api/newsletter-signup` (verified end-to-end: form → GHL contact create with tags)
- 3 lead-magnet PDFs (Rules of the Function, Quick Rounds, The Vibe Code)
- Mobile scroll-scrub video — verified on iPhone 14 Pro + Pixel 7 + Desktop 1440 via Playwright emulation
- 14 CTAs UTM-tagged for attribution
- OG meta + Schema.org Product JSON-LD for social shares
- Analytics scaffolds (GA4, Microsoft Clarity, Meta Pixel, TikTok Pixel — all ready, IDs pending)

### Added — Documentation
- 70+ docs in `docs/` covering operations, workflows, forms, sales sheets, design specs, AI agent charter
- Master index at `docs/MASTER-INDEX.md`
- Pre-form build checklist at `docs/PRE-FORM-CHECKLIST.md`
- Morning status report at `docs/MORNING-STATUS-2026-05-26.md`
- 3 reusable templates in `~/creait/Templates/` (scroll-cinematic landing, scroll-video-bg drop-in, image+video gen guide)

### Changed
- Phone number migrated from 404-954-2115 → (478) 654-9574 (new GHL business line) across 53 docs + 25 email templates + 5 KB FAQs + Business Phone custom value. Internal Thomas-alert phone +14049542115 kept for paging.
- Payment gateway corrected from "Stripe blocked" to "PayPal active" across 6 docs + health script (Stripe never was the right gateway)
- 34 email template merge tags swapped from `{{custom_values.X}}` → `{{contact.X}}` for form-submission data
- Video prompt updated from head-on dolly-to-box to 180° orbital pan around players
- Newsletter proxy first deploy had bug: `echo | vercel env add` stored trailing `\n` in PIT — fixed with `printf` pattern

### Fixed — Mobile scroll-scrub
- iOS Safari `video.currentTime` blocking — added unlock-on-first-gesture pattern
- `window.innerHeight` jitter from URL bar shrinking — cached once at mount, recalc only on resize/orientationchange
- `100vh` URL-bar overlap — added `100dvh` fallback on `.hero` and `.screen`
- Fixed-bg disappearance during iOS URL-bar transitions — added `transform: translateZ(0)` GPU compositing
- Removed `crossOrigin="anonymous"` (CDN already returns `*` — attribute was triggering Safari quirks)
- Added `webkit-playsinline`, `x5-playsinline`, `disableRemotePlayback`, `defaultMuted` attributes

### Fixed — Custom fields
- Tax Exempt CHECKBOX required an `options` array — initially failed, retried with explicit `["Yes — I have a resale certificate"]`
- Phone field placeholder vs value confusion in Pipeline create dialog — script targeted Search input instead of name field, fixed by using `placeholder="Marketing pipeline"` selector

### Security
- `.env` gitignored with real `GHL_PIT` + `GHL_LOC` values
- `.env.example` documents required vars
- All scripts now read via `envGet()` helper from `process.env` or `.env`
- All 11 files that had hardcoded PIT scrubbed before git push
- `.playwright-profile/` (has session cookies) gitignored
- `.vercel/`, `node_modules/`, `logs/*.json`, `.bin` all gitignored

### Removed
- N/A (first commit)

---

## How CRM state ties to commits

Major asset changes that happen IN CreateOS (not in code) should ALSO get a line here, because the code-state-of-truth in this repo lags the live state. Example entries:

```markdown
### Changed
- (CreateOS) Repeat Buyer VIP Upgrade workflow: added trigger filter "Has Tag: bought-liquor-store" + published — Thomas
- (CreateOS) Sponsor Inquiry Follow-Up: rewrote email body from AI Builder default to AGN voice + published — Maurice
- (CreateOS UI) Deleted 2 empty workflow shells: Repeat Buyer VIP Tier (442566a7), Sponsorship Pipeline B2B (3549cf2f)
```

Tag UI-only changes with `(CreateOS)` or `(Vercel)` or `(Shopify)` prefix so future readers know it didn't come from a code change.

---

## Quick-reference milestones to track

When you ship one of these, promote the relevant `[Unreleased]` entries into a dated release block:

- [ ] **v1.1 — All 11 workflow drafts verified + published** (after Thomas's 25-min sprint)
- [ ] **v1.2 — Custom subdomain live at liquorstore.adultgamenights.com** (after DNS + Vercel domain add)
- [ ] **v1.3 — Logo PNG + OG image deployed**
- [ ] **v1.4 — GA4 + Clarity tracking live** (analytics actually collecting data)
- [ ] **v1.5 — First real customer purchase tracked end-to-end** (Shopify webhook → CRM contact → Post-Purchase workflow → review request fires)
- [ ] **v2.0 — Revenue funnel hits $1K week** (validates the entire build)
- [ ] **v2.1 — Voice AI Receptionist live** (after phone # decision + KB binding)
- [ ] **v2.2 — Reviews AI live** (after GMB OAuth)
- [ ] **v2.3 — Smoking Section pre-order workflow firing** (after product page launch)

---

## Author / maintainer

- **Maurice / CREAIT** — primary
- **Thomas Gray** — client, owner of CreateOS instance

For questions, refer to `docs/OPERATIONS-MASTER.md` (Thomas's daily bible) or `docs/MASTER-INDEX.md` (everything else).
