# Loom Walkthrough Shotlist

For Maurice (or whoever records). 6 short Loom videos covering the most-used flows. Each ~3-5 min. Total ~25 min of training video.

Record in this order — earlier videos build context for later ones.

---

## Loom 1 — "Daily check-in" (~3 min)

**Audience:** Thomas
**Goal:** Open the dashboard, scan top row, decide what needs response.

**Shotlist:**
1. Open CreateOS → Dashboard → "Thomas's Daily View" (5 sec)
2. Walk through Row 1 — Escalations, Today's services, Negative reviews. Explain what each means. (45 sec)
3. Demo: click an escalation → show the conversation → narrate the customer's issue (60 sec)
4. Demo: respond manually, then remove `escalate-to-thomas` tag (45 sec)
5. Quick recap of the 4 tiles to glance at every morning (30 sec)

**Script seed:**
> "Yo, this is the dashboard. Top row is what needs you right now. If anything is red or has a number, click in and handle it. Everything else can wait til you're done with that."

---

## Loom 2 — "Service booking from inquiry to event" (~5 min)

**Audience:** Thomas
**Goal:** Walk a service booking through every workflow stage.

**Shotlist:**
1. Form 1 submission (record yourself filling out the form on a test contact) (30 sec)
2. CreateOS → see contact appear, tags applied, opportunity in pipeline `Game Night Service` → `Inquiry` (30 sec)
3. Confirmation email landed in test inbox — show the email (15 sec)
4. SMS to your number with booking details — show the SMS (15 sec)
5. Demo: receive deposit (mock by adding `deposit-paid` tag), watch pipeline auto-move to `Deposit Paid` (45 sec)
6. Demo: 7-day-out reminder fired, 1-day-out reminder, 1-hour day-of SMS (mock by editing the event date to "tomorrow") (60 sec)
7. Day-of: click into Conversations, send the `service_day_of_arrival` SMS snippet (30 sec)
8. After event: tag `service-completed`, watch Workflow 7 fire 1 day later (60 sec)
9. Recap: "all you do is mark deposit-paid and service-completed; the rest is automatic" (30 sec)

---

## Loom 3 — "Sponsor inquiry to call booking" (~3 min)

**Audience:** Thomas
**Goal:** Triage a sponsor lead from form submission to scheduled call.

**Shotlist:**
1. Form 2 submission (test fill-out) (15 sec)
2. Internal email arrives — show subject `🎯 New sponsor inquiry: …` (15 sec)
3. CreateOS contact view — show tags, custom fields (Business Name, Products to Sponsor, Instagram Handle, etc.) (30 sec)
4. Auto-response email (`sponsor_pitch`) sent to sponsor — show what they got (30 sec)
5. Your move: open the conversation thread, send a personal message + Calendar 2 link (45 sec)
6. Mock the sponsor responding → tag `sponsor-engaged` → workflow stops auto follow-ups (30 sec)
7. Mock signing → tag `signed-sponsor` → pipeline auto-moves to `Signed` (30 sec)
8. Recap: "AI nurtures while you focus on the high-value sponsors" (15 sec)

---

## Loom 4 — "Posting on social via the Planner" (~3 min)

**Audience:** Thomas + Maurice
**Goal:** Schedule one of the pre-loaded launch posts.

**Shotlist:**
1. Marketing → Social Planner → Drafts (15 sec)
2. Show the 7 pre-loaded launch posts (30 sec)
3. Click `liquor_store_hero` draft (15 sec)
4. Demo: attach a media file from the library (30 sec)
5. Demo: select platforms (FB, IG, TT) (15 sec)
6. Demo: schedule for 9am tomorrow (15 sec)
7. Walk through where it'll show up: scheduled tab, calendar view (30 sec)
8. Bonus: show the Instagram comment auto-DM rules (Settings → Social → Auto-DM) — comment "GAME" → auto-link drop (60 sec)
9. Voice reminders: be hype, drop hype words, never sound corporate (15 sec)

---

## Loom 5 — "Handling an escalated AI conversation" (~3 min)

**Audience:** Thomas
**Goal:** Pick up where the AI left off when it escalated to you.

**Shotlist:**
1. Receive escalation SMS on your phone (or simulate) (15 sec)
2. Open CreateOS → Conversations → filter `escalate-to-thomas` (15 sec)
3. Click the thread → read AI's last message + customer's last message (30 sec)
4. Show toggling AI replies OFF on this thread (15 sec)
5. Read the last 8 exchanges to understand what they want (45 sec)
6. Respond directly — be yourself, not the AI (45 sec)
7. After resolution: remove tag `escalate-to-thomas` to mark closed (15 sec)
8. Optional: re-enable AI on this contact for future conversations (15 sec)
9. Recap: "AI escalated for a reason — they wanted YOU. Don't try to mimic the bot." (15 sec)

---

## Loom 6 — "Updating an FAQ when AI gets something wrong" (~3 min)

**Audience:** Thomas + Maurice
**Goal:** Fix the AI's knowledge when it answers a question incorrectly.

**Shotlist:**
1. Scenario: customer asked "what's the cancellation policy" — AI gave wrong answer (15 sec)
2. CreateOS → AI → Knowledge Bases → "Adult Game Nights Master KB" → FAQs (30 sec)
3. Search for "cancellation" → click the FAQ (15 sec)
4. Edit the answer → save (30 sec)
5. Test: open Conversations, ask the AI the same question → confirm new answer (45 sec)
6. Show that NO REBUILD is needed — KB is read live (30 sec)
7. Bonus: show where the FAQ source-of-truth lives in the repo (`config/knowledge-base.json`) for tracked changes (30 sec)
8. Recap: "If AI says something wrong once, fix it once, and it's fixed forever." (15 sec)

---

## Optional bonus videos

### Loom 7 — "Pass 2 personality refresh" (~5 min)
Only record this when Thomas delivers his voice samples + FAQ list. Walks through the full process from drop-files-in-inputs/ to paste-prompts-in-UI.

### Loom 8 — "Adding a new event" (~4 min)
Per [`landing-pages/05-events-template.md`](../landing-pages/05-events-template.md). Duplicate funnel, set merge variables, add custom field option, add tag, save.

### Loom 9 — "Re-authing a social account" (~2 min)
Generic OAuth flow — record once when YouTube re-auth happens, save as the example for future re-auths.

---

## Recording tips

- **Don't script verbatim.** Use the shotlist as a beat sheet, talk natural.
- **Clear browser cache before recording** — show clean state, not your power-user shortcuts.
- **Camera in corner is fine.** Builds trust; Thomas wants to see Maurice's face for context.
- **2x speed playback** — record at 1x, expect Thomas to watch at 1.5-2x. Don't rush, but don't pad either.
- **Title pattern:** `AGN CRM — [task name]` so they're greppable in Loom.
- **Save to a shared Loom folder** "Adult Game Nights Operations Training" — share access with Thomas.
- **At the end of each video:** "Questions? Hit me. — Maurice"

---

## Where these get linked from

- [`docs/operations-manual.md`](operations-manual.md) — each task in the index links to its Loom (once recorded)
- The CreateOS Help section in the UI (if Maurice can paste links there)
- An onboarding doc if Thomas ever hires staff to help
