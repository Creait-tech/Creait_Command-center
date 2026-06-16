# 🎯 Adult Game Nights — Tonight's CRM Playbook (60-Min Manual Build)

**Event:** https://luma.com/85xhqq8s — 34+ RSVPs
**Goal:** Every door-scan = contact in CRM + auto thank-you SMS tomorrow morning
**Login URL:** https://app.getcreait.com/v2/location/1uN6mnlvX9JQ5QvrLewp/dashboard

---

## ✅ ALREADY DONE (don't redo)

- ✅ **Pipeline:** Event Attendees (3 stages: Registered → Checked In → Followed Up)
- ✅ **Tag:** `event-luma-may15` exists
- ✅ Custom fields, 41 other tags, 3 calendars, KB+54 FAQs, 20 email templates — all live from prior work

---

## 🚨 DO THESE 4 THINGS NOW (in order, 60 min total)

### Step 1 — Build Form 3 in CreateOS (15 min)

**Nav:** Sidebar → **Sites** → **Forms** → **+ Add Form** → Choose "Start from scratch" → Name it: `Event Registration — Luma May 15`

**Fields to add (in this order, drag from left panel):**

| # | Type | Label | Required | Notes |
|---|---|---|---|---|
| 1 | First Name | First Name | ✅ | standard field |
| 2 | Last Name | Last Name | ✅ | standard field |
| 3 | Email | Email | ✅ | standard field |
| 4 | Phone | Phone | ✅ | required for SMS |
| 5 | Dropdown | How'd you hear about us? | optional | Options: Instagram • TikTok • Friend • Luma • Other |
| 6 | Hidden field | event_selection | (hidden) | Default value: `Luma May 15` |

**Style tab:** Background `#000000`, button `#FF3B30` (red), button text "I'M IN 🎲"

**Settings tab:**
- Form Action → **On Submit** → Show message: `"You're in! Watch for a text confirmation. See you tonight 🔥"`
- **Add Contact Tags:** `source-event` + `event-luma-may15`
- **Opportunity Settings:** Pipeline → `Event Attendees`, Stage → `Registered`

**Click SAVE then PUBLISH (top right).**

**After save:** Click **Integration → Embed/Link**. Copy the **Direct Link** URL. Save it — you need it for QR.

---

### Step 2 — Generate QR Code (3 min)

Open Terminal and run (replace `PASTE_FORM_URL_HERE`):

```bash
cd "/Users/reecebyob/creait/Creait Clients/Thomas- Adult Game Night/adult-game-nights-build"
npm install qrcode --save
node -e "require('qrcode').toFile('logs/luma-may15-qr.png','PASTE_FORM_URL_HERE',{width:1024,margin:2,color:{dark:'#000000',light:'#FFFFFF'}},console.log)"
open logs/luma-may15-qr.png
```

PNG opens in Preview. AirDrop it to Thomas's phone → he displays on-screen at door or prints.

---

### Step 3 — Create 2 SMS Templates (10 min)

**Nav:** Sidebar → **Marketing** → **Templates** → **SMS** tab → **+ Add Template**

**Template 1 — Name:** `Event Welcome - Luma May 15`
**Body** (copy/paste):
```
Yo {{contact.first_name}} — you're locked in for tonight! Adult Game Nights, see you there 🔥 Reply STOP to opt out.
```

Click **Save**.

**Template 2 — Name:** `Event Thank You - Luma May 15`
**Body**:
```
{{contact.first_name}} — last night was 🔥 Thanks for pulling up. Grab the Liquor Store game at adultgamenights.com or reply BOOK if you want us to host your next party 🎲
```

Click **Save**.

---

### Step 4 — Build Workflow in CreateOS (25 min)

**Nav:** Sidebar → **Automation** → **Workflows** → **+ Create Workflow** → "Start from scratch" → Name: `Event Registration & Follow-Up — Luma May 15`

**Steps to add:**

1. **TRIGGER:** Form Submitted → Form: `Event Registration — Luma May 15`
2. **ACTION: Send SMS** → Template: `Event Welcome - Luma May 15`
3. **ACTION: Create/Update Opportunity** → Pipeline: `Event Attendees`, Stage: `Registered`, Name: `{{contact.first_name}} {{contact.last_name}} - Luma May 15`
4. **WAIT:** Until → `2026-05-16 11:00 AM` (tomorrow 11am ET)
5. **ACTION: Send SMS** → Template: `Event Thank You - Luma May 15`

Top right: toggle **Publish** to ON. Click **Save**.

---

## 🧪 SMOKE TEST (5 min)

1. Open Form 3 public URL in **incognito browser** on your phone
2. Fill: `Test Maurice / Test / test+tonight@adultgamenights.com / [your phone]`
3. Submit
4. **Expect within 30 seconds:**
   - SMS arrives on your phone: "Yo Test — you're locked in for tonight!…"
   - In CreateOS → **Contacts** → search "Test Maurice" → see tags `source-event` + `event-luma-may15`
   - In CreateOS → **Opportunities** → "Event Attendees" pipeline → "Registered" column → contact appears

✅ If SMS arrives = Twilio connected, workflow firing
❌ If no SMS = check Phone System settings (Twilio number must be active for outbound)

---

## 📱 EVENT-DAY EXECUTION (give to Thomas)

**Before doors open:**
- Display QR code on phone or printed sign at the door
- Tag QR sign with text: **"📸 SCAN TO JOIN ADULT GAME NIGHTS — TEXT YOU AFTER 🎲"**
- Optional: Post the form URL in the Luma chat ~30 min before doors

**During event:**
- Don't worry about manual collection — CRM does it
- Encourage scans on the mic: "Scan the QR if you want to be first to know about next month's game night"

**Day after (handled by workflow automatically):**
- 11am ET: every attendee gets a thank-you SMS
- Optional manual move in CreateOS: drag contacts in pipeline from "Registered" → "Followed Up" as you go through the list

---

## 🔁 IF SOMETHING BREAKS

| Symptom | Likely Cause | Fix |
|---|---|---|
| No SMS after form submit | Twilio not connected | Settings → Phone System → reconnect Twilio |
| Form won't save | Required field missing | Make sure First Name, Last Name, Email, Phone all marked required |
| Tag doesn't apply | Tag name typo | Check spelling EXACTLY: `event-luma-may15` (lowercase, hyphens) |
| Workflow not firing | Trigger not set | Edit workflow → confirm trigger says "Form Submitted: Event Registration — Luma May 15" |
| Pipeline move fails | Pipeline name typo | Use exact name "Event Attendees" |

---

## 📊 POST-EVENT METRICS TO CHECK (tomorrow morning)

Open CreateOS → Reporting → Lead Source Report

Look for:
- # of contacts tagged `event-luma-may15` = total scans
- Pipeline "Event Attendees → Registered" count = same number
- SMS delivery rate (Conversations panel) = should be ≥95%

**Target tonight: 25-40 new contacts in CRM**

---

## 🎯 NEXT (after tonight)

Track C build (Maurice's sit-down, ~6-8 hr split):
- 3 more pipelines (Game Sales done, need: Service, Sponsorship — Game Sales already exists)
- 5 more forms (Service, Sponsorship, Wholesale, Affiliate, 3D Print)
- 7 more workflows (Cart Abandon, Post-Purchase, Service Booking, etc.)
- 3 AI Agents (Voice Receptionist, Conversation AI, Reviews)
- Thomas regenerates PIT token → update `.env` → re-run health check

See [MASTER-REPORT.md](MASTER-REPORT.md) for full status.
