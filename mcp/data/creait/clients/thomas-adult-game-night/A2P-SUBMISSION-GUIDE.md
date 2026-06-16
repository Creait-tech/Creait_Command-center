# A2P 10DLC Submission Guide — AGN

**Status:** Ready to submit (after landing page deploys to `liquorstore.adultgamenights.com`)
**Owner:** Thomas Gray (must submit using legal entity owner identity)
**Operator:** Maurice — copy/paste assist
**Date prepared:** 2026-06-10

---

## What A2P 10DLC is + why we have to do it

A2P 10DLC ("Application-to-Person, 10-digit Long Code") is the US carrier system (AT&T, T-Mobile, Verizon) that polices business SMS. To send SMS from a business number — including everything our CreateOS workflows do (event reminders, order confirmations, win-backs, etc.) — the business has to:

1. Register the legal **Brand** (the LLC that operates).
2. Register each **Campaign** (the type of messages we send).
3. Pass automated + manual review.

If we don't do this, carriers throttle, filter, or fully block our SMS. Most of our high-value automations (Game Night Service day-of reminders, sponsor follow-ups, post-purchase) are SMS-driven — A2P approval is the unlock.

Carriers approve faster when the brand's website clearly shows: business identity, privacy policy, terms, SMS-specific opt-in policy with sample messages, and "Reply STOP to opt out." Our `/privacy`, `/terms`, and `/sms` pages cover all of this.

---

## What's already done

✅ Privacy Policy live at `/privacy` (https://liquorstore.adultgamenights.com/privacy)
✅ Terms of Service live at `/terms`
✅ SMS Policy + Sample Messages live at `/sms` — **this is the critical one for A2P reviewers**
✅ Footer of every page links to all three legal pages + shows business address
✅ Newsletter form has SMS-style consent disclosure
✅ CreateOS Chat Widget embedded site-wide (gives reviewers a way to message us live)

---

## Where to submit in CreateOS

**Path:** CreateOS → Settings → Phone Numbers → Trust Center
(also reachable: Conversations → SMS → A2P 10DLC)

You'll see two sections:
1. **Brand registration** — one-time per legal entity
2. **Campaign registration** — one per "type" of SMS use case

---

## STEP 1 — Brand Registration (one-time, ~5-10 min)

Fill these fields exactly. Anything that doesn't match the official EIN/state records → instant rejection.

> ⚠️ **VERIFY THE EXACT LLC NAME BEFORE SUBMITTING.** Pull up the GA Secretary of State filing (https://ecorp.sos.ga.gov/BusinessSearch) and copy the legal name **character-for-character**, including punctuation, "LLC" suffix, and capitalization. Any mismatch with the EIN letter or state filing → instant A2P rejection.
>
> Likely candidates based on what Thomas mentioned: `Adult Game Nights LLC`. The prior assumption (`2wenty58 Entertainment LLC`) was a previous company name and has been corrected in this guide.

| Field | Value to enter |
|---|---|
| **Legal Business Name** | `Adult Game Nights LLC` *(verify on GA SOS — must match EIN letter exactly)* |
| **DBA / Brand Name** | Leave blank if legal name = brand name. If a DBA is registered separately, enter it. |
| **EIN / Tax ID** | _[Thomas — enter the 9-digit EIN from IRS CP-575 letter]_ |
| **Business Type** | Limited Liability Company (LLC) |
| **Industry** | Retail / Consumer Products (or "Entertainment" if listed) |
| **Vertical** | Consumer Goods · Adult / 21+ Beverages-Adjacent |
| **Stock Exchange** | Not listed (private LLC) |
| **Business Registration #** | Georgia LLC control number _[Thomas — from GA Secretary of State]_ |
| **Country of Registration** | United States |
| **State of Registration** | Georgia |
| **Address Line 1** | `504 Fair Street` |
| **City** | Atlanta |
| **State** | GA |
| **Zip** | 30313 |
| **Country** | United States |
| **Website URL** | `https://liquorstore.adultgamenights.com` *(this is the URL we just deployed legal pages on — must match)* |
| **Business Email** | `info@adultgamenights.com` |
| **Business Phone** | `+1 (478) 654-9574` |
| **Authorized Representative Name** | Thomas Gray |
| **Authorized Rep Email** | `adultgamenights@gmail.com` |
| **Authorized Rep Phone** | `+1 (478) 654-9574` |
| **Authorized Rep Title** | Founder / Owner |

**Cost:** One-time brand registration fee (~$4 charged by the carriers, often passed through transparently).
**Approval time:** 5 minutes (auto) to 24-48 hours (manual review).

---

## STEP 2 — Campaign Registration

A2P requires **one campaign per use case**. For AGN, we recommend ONE "Low Volume Mixed" campaign that covers both transactional + marketing. Mixed = cheaper + more flexible than registering two separately.

### Campaign type: **Low Volume Mixed (≤2,000 SMS/day)**

Fill these fields exactly:

| Field | Value |
|---|---|
| **Campaign Name** | `Adult Game Nights — Customer Updates` |
| **Use Case** | Mixed (Marketing + Transactional + Customer Care) |
| **Description** | `Adult Game Nights sends order confirmations, shipping notifications, event reminders, service-booking confirmations, and opt-in marketing campaigns (drops, sales, event announcements) to customers who have explicitly opted in via our website forms.` |
| **Message Volume** | Low (Less than 2,000/day) — starting volume is ~50-200/mo |
| **Number of Phone Numbers** | 1 (the AGN business number) |

### Opt-in details

| Field | Value |
|---|---|
| **Opt-In Method** | Web form (multiple — see below) |
| **Opt-In Workflow Description** | `Users opt in by checking an SMS-consent box on one of our website forms: Game Night Service Booking, Event Registration, Sponsorship Inquiry, Wholesale Inquiry, Creator UGC Collab, or Newsletter Signup. Each form contains explicit consent language stating that submission authorizes recurring SMS, frequency, opt-out via STOP, and a link to our SMS Policy at https://liquorstore.adultgamenights.com/sms.` |
| **Opt-In Image** | _Screenshot of one of the forms with consent checkbox visible — see attachments folder_ |

### Sample messages (3 required, more is better — paste from `/sms` page)

**Sample 1 — Transactional (order confirmation):**
```
Yo Marcus! Your Liquor Store game is locked in 🎲 Order #1234 ships in 1-2 business days. Track here: agn.link/track/1234. — AGN. Reply STOP to opt out.
```

**Sample 2 — Service reminder (transactional):**
```
🎲 TONIGHT — AGN Live Atlanta at Russell Center. Doors at 8 PM. Bring ID + your crew. See you at the door. Reply STOP to opt out.
```

**Sample 3 — Marketing (win-back):**
```
Yo Marcus — it's Thomas. Been a minute. New drops cooking. Code WELCOME15 = 15% off through Friday: adultgamenights.com. Reply STOP to opt out.
```

**Sample 4 — Birthday promo (marketing):**
```
Happy birthday Marcus 🎲 BDAY20 = $20 off this week. Pull up: adultgamenights.com. Reply STOP to opt out.
```

### Compliance disclosures (carrier will look for ALL of these in messages or policy)

- ✅ **Privacy Policy URL:** `https://liquorstore.adultgamenights.com/privacy`
- ✅ **Terms URL:** `https://liquorstore.adultgamenights.com/terms`
- ✅ **SMS Policy URL:** `https://liquorstore.adultgamenights.com/sms`
- ✅ **STOP message:** "Reply STOP to opt out" included in every sample
- ✅ **HELP message:** "Reply HELP for help" — built into SMS Policy
- ✅ **Message frequency:** "Up to 4 messages per month" — disclosed on SMS Policy page
- ✅ **Carrier rates:** "Message and data rates may apply" — disclosed on SMS Policy page

### Restricted content checkboxes — answer these honestly

| Question | Answer |
|---|---|
| Does your messaging include age-gated content? | **YES — 21+ only** (drinking game brand) |
| Does it involve alcohol/cannabis/tobacco/firearms? | **YES — alcohol** (drinking game theme; we are not selling alcohol, we sell a card game ABOUT drinking) |
| Does it involve gambling? | NO |
| Does it involve loans / debt collection? | NO |
| Does it involve cryptocurrency? | NO |
| Embedded URL shortener? | NO (we use `agn.link/` for trackable links, but it's our own subdomain — not a public shortener like bit.ly) |
| Embedded phone numbers? | YES (Thomas's business number for HELP replies) |

⚠️ **The "alcohol" YES is required and won't get auto-rejected.** AGN sells a *product about* drinking games, not the alcohol itself. Reviewers approve this category routinely — the key is honesty + tight opt-in disclosure (which we have).

**Cost:** Campaign registration fee (~$10-15/quarter recurring, charged by carriers).
**Approval time:** 1-3 business days (manual review because of the age-gated content flag).

---

## STEP 3 — Phone number linking

After Brand + Campaign approve:

1. CreateOS → Settings → Phone Numbers → select **(478) 654-9574**
2. Click **Link to Campaign** → select "Adult Game Nights — Customer Updates"
3. Verify the linkage shows "Active" status — usually within 5 min

That's the moment SMS sending is unlocked. Test by manually triggering a workflow.

---

## STEP 4 — Verify it's working (testing protocol)

After approval:

```
1. CreateOS → Contacts → create test contact with your own phone
2. Add tag `cart-abandoned` manually
3. Wait 1 hr (or shorten the Cart Abandonment workflow's wait step temporarily)
4. SMS should arrive at your phone
5. Reply STOP from your phone → verify contact gets `unsubscribed` tag automatically
```

If anything fails, check **Conversations → Logs → SMS** for the carrier rejection reason.

---

## Common rejection reasons + fixes

| Rejection | Fix |
|---|---|
| "Website not accessible" | Confirm `liquorstore.adultgamenights.com` resolves (DNS propagated, SSL active) |
| "Privacy Policy missing SMS language" | Our `/privacy` covers it (Section 5: SMS and phone privacy) ✅ |
| "No clear opt-in method shown" | Point reviewer at `/sms` Section 3 + form screenshots |
| "STOP keyword not handled" | Verify CreateOS auto-handles STOP (Settings → Conversations → Compliance — should be ON by default) |
| "Sample messages don't include STOP" | All 4 samples in this doc + on `/sms` include "Reply STOP" ✅ |
| "Age-gated content not disclosed" | Our `/terms` Section 1 + `/sms` Section 11 explicitly state 21+ ✅ |
| "EIN doesn't match Legal Business Name" | Re-verify both with IRS EIN letter (CP-575) and GA Secretary of State filing |

---

## After approval — keep these in mind

1. **Don't change the website URL** without re-submitting. Carriers periodically re-scan the registered URL.
2. **Don't ship marketing-only campaigns to a transactional campaign type.** Our "Mixed" type allows both — but if we ever register a marketing-only campaign separately, route SMS through the right one.
3. **Keep the `/sms` page updated** as message frequency or sample wording changes. Carriers do re-check.
4. **Maintain ≥10% engagement / ≤2% opt-out rate.** Persistent high opt-out triggers carrier audits.
5. **STOP is always honored, regardless of source.** Never re-message someone who STOPPED unless they re-opt-in via form.

---

## Files referenced

- `landing-pages/agn-cinematic-landing/privacy.html` — Privacy Policy source
- `landing-pages/agn-cinematic-landing/terms.html` — Terms source
- `landing-pages/agn-cinematic-landing/sms.html` — SMS Policy source (most important for review)
- `landing-pages/agn-cinematic-landing/index.html` — main landing with chat widget + footer legal links

## Contacts for follow-up

- CreateOS support: in-app chat (CreateOS bottom-right widget) — they escalate brand/campaign issues to TCR (the registry)
- Brand Trust score check: Settings → Trust Center → Brand Score
- Direct TCR escalation (rare): only via CreateOS support — TCR doesn't talk to end customers

---

**Author:** Maurice / CREAIT
**Date:** 2026-06-10
**Next review:** After A2P approval, update CHANGELOG.md milestone v1.6 — A2P 10DLC approved
