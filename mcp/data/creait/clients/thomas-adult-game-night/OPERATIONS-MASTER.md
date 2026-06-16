# AGN Operations Master — Thomas's Daily Bible

**Purpose:** One doc Thomas can open every morning to know exactly what to do, what's automated, and where the money is.

**Updated:** 2026-05-25

---

## 🌅 THE 5-MIN MORNING CHECK (every day)

Open CreateOS → do these 5 things in order:

1. **Dashboard** — glance at yesterday's: new contacts, money in, opportunities moved
2. **Conversations** → any unread? Anyone tagged `escalate-to-thomas`? Handle within the hour
3. **Opportunities → Game Night Service** → anything in `Inquiry` > 24h? Text them now
4. **Reputation tab** → any 3⭐ or below? Respond personally on-platform
5. **Calendars** → glance at tomorrow's bookings (so you're not surprised)

If all 5 are clean → you're done. Go shake hands.

---

## 🌙 THE 2-MIN EVENING CHECK (every day)

1. **Conversations** → anything still open from today? Close out
2. **Opportunities** → anyone you talked to today? Drag them to the next stage
3. **Tag any new contact** you met IRL today as `met-irl-{{date}}` so they enter the welcome sequence

---

## 📅 WEEKLY (every Monday, ~15 min)

1. **Pipeline Health** — Opportunities → all 3 pipelines → look at the $ totals. That's your forecast.
2. **Workflow status** — Automation → Workflows → all should show `published`. Anything `draft`? Either publish or delete.
3. **Reviews recap** — Reputation → how many new reviews last week? If <2, hit the Post-Purchase tagged buyers from 7+ days ago with a personal text asking for one.
4. **Broadcast send** — Email Marketing → Templates → pick one of the 6 `BROADCAST:*` templates → schedule a send to a relevant tag segment. Keeps the list warm.
5. **Social calendar** — pull next 7 days from `docs/CONTENT-CALENDAR-30-DAY.md`. Schedule posts in Social Planner.

---

## 📆 MONTHLY (first of every month, ~30 min)

1. **Revenue review** — total sold last month / total contacts gained / total reviews / average opportunity value
2. **Workflow tuning** — open each published workflow → check Total Enrolled count. If a workflow has 0 enrollments after 30 days, the trigger isn't firing. Diagnose.
3. **KB refresh** — AI Agents → Knowledge Base → review the 67 FAQs. Add any new questions that came up in conversations last month. Delete anything that's stale.
4. **Tag audit** — Contacts → Tags → any tags you never used? Delete. Keeps the list clean.
5. **Backup audit** — Settings → Audit Logs → confirm nothing wild happened (no unauthorized logins, deletions)

---

## 🚀 WHAT'S AUTOMATED (no work needed from Thomas)

| When this happens | What fires automatically |
|---|---|
| Customer abandons cart on Shopify | Cart Abandonment Recovery (3 emails over 5 days) |
| Customer buys on Shopify | Post-Purchase Email Series (welcome + tips + review request) |
| Old Klaviyo contact (15K) needs re-permission | Reactivation Email Sequence (1 email) |
| Someone submits Game Night Service Booking form | Game Night Service Booking workflow (confirm + reminders + thank you) |
| Customer's 2nd purchase | Repeat Buyer VIP (after manual filter fix) — VIP tags + congrats email + SMS to Thomas |
| Customer's `Birthday` field matches today | Birthday Promo Campaign — happy bday email + SMS + $20 off code |
| Smoking Section pre-order tag added | Smoking Section Pre-Order Welcome email |
| Buyer with no 2nd purchase after 90d | 90-Day Win-Back — soft check-in + 15% off code |
| Anyone tagged `escalate-to-thomas` | Internal SMS to your phone (+14049542115) |
| FB/IG/TikTok comment with keyword (GAME/BUY/PRICE/etc.) | Auto-DM workflow (once Tier 4 is built) |

---

## 💰 WHERE THE MONEY COMES IN (revenue lanes)

| Lane | Avg ticket | Frequency | Auto-handled by |
|---|---|---|---|
| Direct game sales (Shopify) | $34 | Daily | Cart Abandonment + Post-Purchase workflows |
| Game Night Service Booking | $199-499 | 2-5/mo | Service Booking workflow |
| Wholesale orders | $200-2K | 1-3/mo | Wholesale Response email + manual follow-up |
| Sponsor / B2B deals | $2K-15K | 1-2/qtr | Sponsor Pipeline workflow (once built) |
| Event ticket sales | $25-75 | Per event | Event Registration General workflow |
| Smoking Section pre-orders | $59 | Pre-launch | Smoking Section Pre-Order email |
| Repeat purchases | $34-100 | Per VIP | Win-Back + VIP Upgrade workflows |
| Referrals ($10 credit) | $34/referral | Per referrer | Refer-a-Friend Engine (once built) |

**Your job on revenue:** keep showing up to events + on social + in DMs. The system catches the leads. You close the deals.

---

## 🆘 WHEN SOMETHING'S WRONG — Diagnostic flow

| Symptom | First check | If that's fine, check |
|---|---|---|
| No new contacts coming in | Shopify webhook in Settings → Integrations | Forms — make sure embed code is live |
| Workflow shows 0 enrollments | Open workflow → Settings → "Allow re-entry" toggle | Check trigger filters — too restrictive? |
| AI agent giving wrong answers | AI Agents → KB → review last 10 conversations | Update FAQ entries in master KB |
| Email going to spam | Settings → Email Services → check SPF/DKIM | Lower send frequency, raise quality |
| SMS not sending | Settings → Phone Numbers → check A2P 10DLC status | Confirm contact opted into SMS |
| Payments not flowing | Settings → Integrations → **PayPal** status (this is the active gateway) | Run the integration health check (see below) |

---

## 🩺 SYSTEM HEALTH CHECK

Run this every Friday afternoon (~2 min):

```bash
# Open Terminal, paste, and run
PIT="${GHL_PIT}"
LOC="1uN6mnlvX9JQ5QvrLewp"
UA="Mozilla/5.0 Chrome/120"
echo "=== AGN Health Check $(date) ==="
echo "Workflows:"
curl -s -H "Authorization: Bearer $PIT" -H "Version: 2021-07-28" -H "User-Agent: $UA" \
  "https://services.leadconnectorhq.com/workflows/?locationId=$LOC" | python3 -c "
import sys,json
d=json.load(sys.stdin)
pub=sum(1 for w in d['workflows'] if w['status']=='published')
drf=sum(1 for w in d['workflows'] if w['status']=='draft')
print(f'  Published: {pub}  Drafts: {drf}  Total: {len(d[\"workflows\"])}')"
echo "Stripe check:"
curl -s -o /dev/null -w "  HTTP %{http_code}" -H "Authorization: Bearer $PIT" -H "Version: 2021-07-28" -H "User-Agent: $UA" \
  "https://services.leadconnectorhq.com/payments/orders/?locationId=$LOC&limit=1"
echo ""
echo "Templates branded:"
curl -s -H "Authorization: Bearer $PIT" -H "Version: 2021-07-28" -H "User-Agent: $UA" \
  "https://services.leadconnectorhq.com/emails/builder?locationId=$LOC&limit=50" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  Total: {len(d[\"builders\"])}')"
```

Save this as `~/scripts/agn-health.sh`, `chmod +x` it, run with `bash ~/scripts/agn-health.sh`.

---

## 📞 ESCALATION RULES — When to call Maurice

| Situation | Action |
|---|---|
| Workflow editor won't load | DM Maurice — could be a GHL outage |
| API health check shows red | DM Maurice — something integration-level broke |
| You want a new workflow built | Send the requirement — Maurice builds it |
| Sponsor inquiry coming in faster than you can handle | Maurice can build a triage workflow |
| You're getting > 5 negative reviews a week | Maurice + you do a customer-experience deep dive |
| You're getting > 50 leads a day | Maurice tunes the workflows for scale |

**Don't call for:** "how do I X" — check this doc first. **Do call for:** "the system broke."

---

## 🎯 90-DAY NORTH STAR

Per the original CREAIT plan: **$15K/month by Day 90.**

Math on how that happens:
- **$5K/mo** from direct game sales (Shopify auto-handles)
- **$4K/mo** from Game Night Service Bookings (2 / week × $400 avg)
- **$3K/mo** from one signed sponsor at $3K/qtr
- **$2K/mo** from wholesale (1 store doing 50 units/qtr × $17 wholesale)
- **$1K/mo** from event ticket sales

That's $15K. Every workflow Maurice built is calibrated to drive toward one of these numbers.

---

## 📚 ALL THE DOCS (where to look up anything)

| What | Doc |
|---|---|
| Daily ops bible | `docs/OPERATIONS-MASTER.md` (this doc) |
| What's in CreateOS now | `docs/SESSION-WRAP-2026-05-25.md` |
| Plan to get to $15K/mo | `docs/REVENUE-POSITIONING-PLAN.md` |
| 9 missing workflow prompts | `docs/AI-BUILDER-PROMPTS-BATCH.md` |
| 9 keyword auto-DM prompts | `docs/TIER-4-AUTO-DM-PROMPTS.md` |
| Sponsor B2B build steps | `docs/SPONSOR-B2B-BUILD-SPEC.md` |
| 5 missing forms to build | `docs/FORMS-SPEC-5.md` |
| 10 missing SMS snippets | `docs/SMS-SNIPPETS-10.md` |
| Wholesale sell sheet (give to stores) | `docs/WHOLESALE-SELL-SHEET.md` |
| Sponsor one-pager (give to brands) | `docs/SPONSOR-ONE-PAGER.md` |
| 30-day social content | `docs/CONTENT-CALENDAR-30-DAY.md` |
| Loom video scripts | `docs/LOOM-HANDOFF-SCRIPTS.md` |
| Website CRO audit | `docs/WEBSITE-CRO-AUDIT-2026-05-25.md` |
| Top 3 website patches to ship | `docs/WEBSITE-3-PATCHES-SHIP-TODAY.md` |

---

**Author:** Maurice / CREAIT
**Last updated:** 2026-05-25
