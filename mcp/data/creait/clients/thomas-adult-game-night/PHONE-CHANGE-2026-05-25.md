# Phone Number Change — 2026-05-25

**Old client-facing number:** 404-954-2115
**New GHL business number:** **(478) 654-9574**
**Internal alert destination (kept):** +14049542115 (Thomas's personal cell, used for paging)

---

## What changed

The new (478) 654-9574 is the **GHL-provisioned business number** for AGN. Every customer-facing touchpoint now uses it. Thomas's personal number (404-954-2115) is preserved only as the destination for **internal alerts** (workflow "Send Internal Notification" actions that page Thomas's actual phone).

---

## Where it was updated (verified)

### ☁️ Live in GHL

| Surface | Status |
|---|---|
| **Business Phone custom value** (`{{custom_values.business_phone}}`) | ✅ Updated to 478-654-9574 |
| **All 25 email templates** (9 transactional + 10 lifecycle + 6 broadcast) | ✅ Old number removed from all, 14 templates now reference 478-654-9574 |
| **Knowledge Base FAQs** (Master KB, 67 entries) | ✅ 5 FAQs that mentioned the old number updated |

Verified via post-update grep across:
- `services.leadconnectorhq.com/emails/builder` → 0 templates with old number
- `services.leadconnectorhq.com/knowledge-bases/faqs` → 0 FAQs with old number
- `services.leadconnectorhq.com/locations/.../customValues` → Business Phone = 478-654-9574

### 📁 Local files (client folder)

| Surface | Status |
|---|---|
| Docs in `/docs/` (53 files) | ✅ 0 files with old client-facing dash format remaining |
| Scripts in `/scripts/` | ✅ Customer-facing copy updated |
| Config in `/config/` | ✅ `custom-values.json` + `sms-templates.json` updated |
| Local HTML email templates in `/email-templates/` | ✅ Footer phone updated |

---

## Where +14049542115 was **intentionally KEPT**

Internal alert destinations — these page Thomas's personal phone, not client-facing:

| File | Why kept |
|---|---|
| `config/workflows.json` | Internal SMS destination on workflow events |
| `config/voice-ai-agent.json` | Escalation call forwarding (customer-facing voice number will be 478-654-9574, but escalations forward to Thomas's cell) |
| `config/reviews-ai.json` | Alert destinations for ⭐⭐⭐ and below reviews |
| `config/automated-reports.json` | Weekly report SMS to Thomas |
| `AI-BUILDER-PROMPTS-BATCH.md` | Workflow prompts that wire Internal SMS to Thomas's cell |
| `SPONSOR-B2B-BUILD-SPEC.md` | Sponsor inquiry → SMS to Thomas |
| `SESSION-WRAP-2026-05-25.md` | Audit trail of original config |
| `phase-*-completion-report.md` | Historical phase reports (preserved as-is) |
| Voice AI escalation flows | Forward calls to Thomas when escalation triggers fire |

**32 references to +14049542115 remain** — all are internal infrastructure routing, none client-facing.

---

## SMS snippets — already clean

All 6 SMS snippets in GHL were checked. None contained the old number. The new 10 SMS snippets in `SMS-SNIPPETS-10.md` reference Thomas's cell only in the internal-alert ones (sponsor_internal_alert, wholesale_internal_alert, service_booking_internal) — those should keep +14049542115 since they're pages.

---

## What still references the OLD number (and shouldn't change)

These are **historical records** kept for traceability:
- `phase-1-completion-report.md` line 94 — historical config record
- `phase-5-pass1-completion-report.md` line 161 — historical voice AI setup record

Leave those alone — they're the audit trail of how things were originally configured.

---

## What Thomas needs to do (5 min)

1. **Update Shopify contact page** — replace 404-954-2115 with 478-654-9574 manually in Shopify admin → Pages → Contact
2. **Update social bios** — IG, TikTok, FB, YouTube bio "Text 478-654-9574 for bookings"
3. **Update Google My Business listing** — business phone (once GMB OAuth is connected)
4. **Forward (478) 654-9574 to your cell** in GHL → Phone Numbers settings if you want calls to ring on Thomas's personal phone

---

## Health-check command after this change

```bash
bash scripts/agn-health.sh
```

Verifies all the cloud state is clean.

---

## Quick-verify any time

```bash
# Local files
grep -r "404-954-2115" "/Users/reecebyob/creait/Creait Clients/Thomas- Adult Game Night/adult-game-nights-build/" 2>/dev/null | grep -v node_modules
# Expected: 0 results

# GHL FAQs
PIT="${GHL_PIT}"
curl -s -H "Authorization: Bearer $PIT" -H "Version: 2021-07-28" \
  "https://services.leadconnectorhq.com/knowledge-bases/faqs?locationId=1uN6mnlvX9JQ5QvrLewp&knowledgeBaseId=y7rHRbRkznkFc8wTC8tk&limit=200" \
  | grep -c "404-954-2115"
# Expected: 0
```

---

**Author:** Maurice / CREAIT
**Date:** 2026-05-25
**Verification:** 0 client-facing references to old number in either local files or GHL cloud state
