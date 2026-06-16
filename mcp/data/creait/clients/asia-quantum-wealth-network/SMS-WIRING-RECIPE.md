# SMS Wiring Recipe — WF #1 + WF #2

**Business number:** `+1 678-263-2170`
**Voice anchor:** Q-Pilot — calm, authoritative, empowering. Never hype. Never fear. Always invite.
**Channel reality:** SMS open rate ~98% (vs email ~30%) — these touchpoints close the engagement gap our Apr 28 audit flagged as Gap #2.

---

## Pre-flight Checklist (5 min — do this first)

Before wiring SMS into any workflow:

1. **Provision the number in GHL**
   - Asia's GHL → Settings → Phone Numbers
   - Confirm `+1 678-263-2170` is registered, A2P 10DLC compliant, and assigned to her sub-account
   - Send a test SMS from GHL to your own phone — verify delivery
2. **Verify SMS sender name**
   - Settings → Business Profile → confirm "Quantum Wealth Strategies" is set so SMS is signed correctly
3. **STOP/HELP keywords** are auto-handled by GHL — no extra config needed

If the number isn't yet provisioned, get that done first. SMS won't fire from a non-provisioned number.

---

## WF #1 — QW Founder Warm Lead Nurture

**Workflow ID:** `489c3f46-02ef-4f2e-8b0e-72d865e5415b`
**Trigger:** Pipeline Stage = Warm Lead (already wired)
**Current state:** Email-only — Day 1, Day 5, Day 12

### What to add: ONE SMS check-in at Day 7

Goal: warm middle-of-sequence touch where SMS open rates massively beat email. Lands between the Day 5 Value email and the Day 12 Urgency email.

### Step-by-step in GHL UI

1. **Open WF #1** — Automation → Workflows → `QW Founder Warm Lead Nurture` → click to edit
2. Find the existing **"Day 5 Value Email"** action node
3. Click the **+** below that node to add a new action
4. **Action type:** Wait → Set delay to **2 days** (so we land at Day 7 from trigger)
5. Click **+** again → **Action type:** Send SMS
6. Configure:
   - **From Number:** `+1 678-263-2170`
   - **Message:** *(use copy below)*
   - **Add as plain text** — no shortened links unless you've verified the domain is set up for SMS link previews
7. **Save** the workflow
8. Toggle the workflow status from **Draft → Published** if it isn't already
9. Run a **test** with your own contact record — verify SMS arrives

### SMS Copy for Day 7 — Warm Lead Check-In

**Option A — Curator voice, soft invitation:**
```
Hey {{contact.first_name}} — Q-Pilot here from Quantum Wealth Strategies.

Checking in: I sent a couple notes earlier this week about getting your books and strategy in one place.

If now isn't the right time, no worries. If you want a 30-min audit call to just see where things stand, reply YES and I'll send the link.

Either way — glad you're here.
```

**Option B — Shorter / direct:**
```
Hey {{contact.first_name}} — Q-Pilot at Quantum Wealth.

Quick check: still want that free 30-min business audit we mentioned? Reply YES for the link or HOLD if it's not the right week.
```

**Recommendation:** Use **Option B** for first send. Test response rate. If response is low, swap to A.

> **Reply handling:** GHL's Conversations inbox routes any reply (YES, HOLD, or anything else) into the contact's thread. Asia or her team responds manually — don't try to auto-route YES to a calendar link unless you set up a separate keyword-trigger workflow.

---

## WF #2 — Pre-Onboarding Engagement Sequence

**Workflow ID:** `31b1a50c-c29e-47ca-bae1-dd3d3368101b`
**Trigger:** Pipeline Stage = Pre-Onboarding (Awaiting Docs) (already wired)
**Current state:** Email-only — Engagement Letter Sent (Day 0), Engagement Reminder (Day 3)

### What to add: ONE SMS reminder at Day 3 — same trigger time as the email

Goal: boost engagement-letter sign rate. Email-only sequences leak signed-letters to "I'll do it later" forever. SMS recovers them.

### Step-by-step in GHL UI

1. **Open WF #2** — Automation → Workflows → `Pre-Onboarding Engagement Sequence`
2. Find the **"Engagement Reminder Email" (Day 3)** action node
3. Click the **+** below the existing Day 3 wait/email — add a new action **right after** the email fires
4. **Action type:** Send SMS
5. Configure:
   - **From Number:** `+1 678-263-2170`
   - **Message:** *(use copy below)*
6. **Save** the workflow
7. Toggle Draft → Published if needed
8. Test with your own contact at Stage 1

### SMS Copy for Day 3 — Engagement Letter Reminder

**Option A — friendly nudge:**
```
Hey {{contact.first_name}} — Asia / Quantum Wealth.

Quick heads-up: I sent your engagement letter a few days ago. Haven't seen it come back yet.

If you've got 2 minutes, here's the link again: {{custom_values.engagement_letter_url}}

Any questions before signing, just reply here.
```

**Option B — even shorter:**
```
{{contact.first_name}}, Q-Pilot here. Just a quick reminder — your engagement letter is still waiting on you. Sign here when ready: {{custom_values.engagement_letter_url}}

Reply with any questions.
```

**Recommendation:** **Option A** — feels human, fewer leads ghost when there's an actual person on the other end (even if it's a workflow-sent SMS).

> ⚠️ **Custom value placeholder:** `{{custom_values.engagement_letter_url}}` won't resolve until you create that custom value in GHL Settings → Custom Values, OR replace it with the literal URL. Same as the email templates we flagged in the Apr 28 audit — this is still pending Asia providing the actual engagement letter URL.

---

## Validation After Wiring

For each workflow, run this check before declaring done:

| Check | How to verify |
|---|---|
| SMS sends from correct number | Test workflow → check your phone's caller ID |
| Variables resolve (first_name) | Test SMS shows your real name, not `{{contact.first_name}}` |
| Engagement Letter URL resolves | Test SMS shows the real URL, not `{{custom_values...}}` |
| Workflow is Published | Status badge = Published, not Draft |
| Asia receives reply notifications | Reply STOP from your phone — verify it lands in her Conversations inbox |
| A2P 10DLC compliance | Confirm number is registered with carrier — non-compliant numbers get filtered |

---

## What Happens Next

Once both SMS touchpoints are live:
- **Apr 28 Gap #2 closes** ✅
- Warm Lead Nurture goes from 1 channel → 2 channels (email + SMS)
- Pre-Onboarding goes from 1 channel → 2 channels
- Reply rates should climb noticeably in week 1

**Future consideration (not now):**
- Day 7 keyword-trigger workflow: when contact replies "YES" to the Day 7 SMS, auto-fire a calendar link SMS
- That's a separate ~15-min workflow build. Tag it as a future item; not blocking launch.

---

## SMS Wiring Status Tracker

Mark these off as you wire each one:

- [ ] WF #1 SMS — Day 7 Warm Lead Check-In wired
- [ ] WF #1 — re-published after edit
- [ ] WF #1 — tested with personal contact, SMS received
- [ ] WF #2 SMS — Day 3 Engagement Reminder wired
- [ ] WF #2 — engagement letter URL replaced (or custom_value created)
- [ ] WF #2 — re-published after edit
- [ ] WF #2 — tested with personal contact, SMS received

---

*Recipe v1 — Apr 30, 2026 · Pairs with WORKFLOW-AUDIT-Apr28.md (Gap #2 closure)*
