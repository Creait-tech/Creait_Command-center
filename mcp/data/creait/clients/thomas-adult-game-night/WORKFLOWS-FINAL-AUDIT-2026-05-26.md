# Workflows Final Audit — 2026-05-26

**Trigger:** You asked "make sure all workflows are good, since we just added the forms some may be unfinished."
**Outcome:** Audited 10 → built 5 new form-triggered workflows → **15 workflows total now in CreateOS**.

---

## ✅ STATE OF ALL 15 WORKFLOWS

### 🟢 PUBLISHED (4 — already firing live)

| Workflow | Triggered by | Status |
|---|---|---|
| Cart Abandonment Recovery | Shopify webhook → `cart-abandoned` tag | ✅ Live, gateway-agnostic (works with PayPal) |
| Post-Purchase Email Series | Shopify webhook → `buyer` tag | ✅ Live |
| Reactivation Email Sequence | Tag `source-import-klaviyo` | ✅ Live (15K Trap Museum contacts) |
| Game Night Service Booking | Form: Game Night Service Booking Form | ✅ Live |

### 🟡 DRAFTS — 4 pre-existing (test + publish when ready)

| Workflow | Triggered by | What it does |
|---|---|---|
| 90-Day Buyer Win-Back | Tag `buyer` + 90-day wait | Soft check-in + 15% off code |
| Birthday Promo Campaign | Custom field `Birthday` matches today (annual) | Bday email + SMS + $20 off |
| Repeat Buyer VIP Upgrade | Tag `buyer` added | ⚠️ **NEEDS trigger filter `Has Tag: bought-liquor-store`** before publishing |
| Smoking Section Pre-Order Email | Tag `smoking-section-pre-order` added | Pre-order welcome email |

### 🟡 DRAFTS — 5 NEW (just built via AI Builder for the 5 new forms)

| Workflow | Triggered by | What it should do |
|---|---|---|
| Sponsor Inquiry Follow-Up | Form: Sponsorship Inquiry | Internal email to Thomas + Sponsor Pitch email to contact + 7-day wait |
| Event Registration Confirmation | Form: Event Registration General | Event Reminder 7d template + "you're locked in" confirmation email |
| Wholesale Inquiry Notification | Form: Wholesale Inquiry | Internal alert to Thomas + Wholesale Response email |
| Creator Inquiry Notification | Form: Creator / UGC Collab Inquiry | Internal email to Thomas + 7-day wait |
| New Workflow : 1779775839357 | Form: Newsletter Signup | Welcome Email + 3-day wait + Hosting Tips Day 3 |

### 🗑️ EMPTY SHELLS (delete manually — API doesn't expose workflow DELETE)

| Workflow | Why delete |
|---|---|
| Repeat Buyer VIP Tier (`442566a7`) | Empty from earlier session, superseded by Repeat Buyer VIP Upgrade |
| Sponsorship Pipeline B2B (`3549cf2f`) | Empty shell from debug session, superseded by Sponsor Inquiry Follow-Up |

---

## ⚠️ AI BUILDER CAVEATS — What Thomas needs to verify

The AI Builder generates workflows in ~30-90 seconds per request. It's helpful but **unpredictable**:

1. **It renames workflows** based on its interpretation of the prompt. My prompts asked for "Sponsor Pipeline B2B" but AI named it "Sponsor Inquiry Follow-Up." Similar pattern for the others — the *intent* is preserved, the *name* is the AI's read.
2. **It can truncate** at ~4 nodes per build. Long workflows may need manual extension via the + button.
3. **Action types** sometimes don't match the prompt exactly. For example:
   - "Send Internal Email Notification" might come out as a generic "Send Email" with the wrong recipient
   - Form-trigger filters might not get the specific form ID — sometimes triggers on ANY form
4. **The newsletter workflow** got created as "New Workflow : 1779775839357" — the name slot didn't populate. Rename via the workflow detail page.

---

## ✅ THOMAS'S WORKFLOW VERIFICATION CHECKLIST (~25 min total)

For each of the 9 draft workflows, click into it and verify:

### A. For the 5 NEW workflows just built by AI:

```
[ ] Open Sponsor Inquiry Follow-Up
    → Verify trigger: "Form Submitted" → form = "Sponsorship Inquiry"
    → Verify Internal Email → To: adultgamenights@gmail.com
    → Verify "Send Email Template" → Template: "Sponsor Pitch"
    → Verify Stop Conditions: tag 'sponsor-engaged' OR 'signed-sponsor' OR 'unsubscribed'
    → Flip Draft → Publish

[ ] Open Event Registration Confirmation
    → Trigger form = "Event Registration General"
    → Verify Email Template = "Event Reminder 7d"
    → Verify quick-compose email subject "You're locked in 🎲"
    → Publish

[ ] Open Wholesale Inquiry Notification
    → Trigger form = "Wholesale Inquiry"
    → Internal email to adultgamenights@gmail.com
    → Email Template = "Wholesale Response"
    → Publish

[ ] Open Creator Inquiry Notification
    → Trigger form = "Creator / UGC Collab Inquiry"
    → Internal email to adultgamenights@gmail.com
    → Publish

[ ] Open "New Workflow : 1779775839357"
    → Rename to: "Newsletter Welcome"
    → Trigger form = "Newsletter Signup"
    → Verify Welcome Email → wait 3 days → Hosting Tips Day 3
    → Publish
```

### B. For the 4 pre-existing drafts:

```
[ ] 90-Day Buyer Win-Back
    → Verify trigger + wait + 15% off email
    → Publish

[ ] Birthday Promo Campaign
    → Verify annual trigger on contact.birthday
    → Publish (won't fire until contacts have Birthday field populated)

[ ] Repeat Buyer VIP Upgrade ⚠️
    → REQUIRED: add trigger filter "Has Tag: bought-liquor-store"
    → Verify Internal SMS goes to +14049542115 (Thomas's cell), NOT contact
    → Verify VIP upgrade email sent
    → Publish

[ ] Smoking Section Pre-Order Email
    → Verify trigger tag = "smoking-section-pre-order"
    → Publish
```

### C. Cleanup

```
[ ] Delete "Repeat Buyer VIP Tier" (empty shell, ID 442566a7)
[ ] Delete "Sponsorship Pipeline B2B" (empty shell, ID 3549cf2f)
```

---

## 🎯 EXPECTED END STATE

After Thomas's 25-min verification + publish sprint:

| State | Count |
|---|---|
| Published workflows | **13** (4 existing + 4 pre-built drafts + 5 new form-triggered) |
| Empty shells | 0 (deleted) |
| Forms wired to workflows | 6/6 |
| Revenue lanes fully automated | 100% |

---

## 🩺 HOW TO VERIFY EVERYTHING WORKS

```bash
cd "/Users/reecebyob/creait/Creait Clients/Thomas- Adult Game Night/adult-game-nights-build"
bash scripts/agn-health.sh

# Look for:
#   📋 WORKFLOWS Total: 13  Published: 13  Drafts: 0  (after cleanup + publishes)
```

Then test ONE form submission as the final smoke test:
1. Submit the Newsletter Signup form with your own email
2. Check CreateOS Contacts: your contact should appear within 30 sec with tags `subscriber` + `source-newsletter`
3. Check your inbox: Welcome Email should arrive within 1-2 min
4. If yes → the entire funnel is operational. If no → workflow needs trigger fix.

---

## 📋 FOR REFERENCE — Full final workflow list (API verified)

```
🟡 draft     | 0d0339c7 | 90-Day Buyer Win-Back
🟡 draft     | e5304318 | Birthday Promo Campaign
🟡 draft     | 6393507b | Creator Inquiry Notification   ← NEW
🟡 draft     | baf17d87 | Event Registration Confirmation ← NEW
🟡 draft     | 0a751949 | New Workflow : 1779775839357   ← NEW (Newsletter Welcome — rename it)
🟡 draft     | 442566a7 | Repeat Buyer VIP Tier          ← DELETE (empty)
🟡 draft     | d85b6476 | Repeat Buyer VIP Upgrade
🟡 draft     | 7ab15eeb | Smoking Section Pre-Order Email
🟡 draft     | ed717794 | Sponsor Inquiry Follow-Up      ← NEW
🟡 draft     | 3549cf2f | Sponsorship Pipeline B2B       ← DELETE (empty)
🟡 draft     | ba07b68f | Wholesale Inquiry Notification ← NEW
🟢 published | 3def8744 | Cart Abandonment Recovery
🟢 published | c69f8f8a | Game Night Service Booking
🟢 published | e651de87 | Post-Purchase Email Series
🟢 published | 27d88f4d | Reactivation Email Sequence
```

---

**Author:** Maurice / CREAIT
**Date:** 2026-05-26
**Audit method:** API list + Playwright AI Builder for creation
**Scripts used:** `scripts/36-build-form-workflows.mjs`, `scripts/38-verify-workflows.mjs`
