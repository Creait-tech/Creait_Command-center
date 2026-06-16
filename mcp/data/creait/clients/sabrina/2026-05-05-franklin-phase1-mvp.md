# Franklin Insurance Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Sabrina's lead capture, 5 nurture workflows, cross-channel reply-stop guardrail, social planner, weekly newsletter, and EasyLinks CSV export within 2 weeks so she can start running cyber/pro-liab/bonds ads with confidence the system won't embarrass her.

**Architecture:** Existing FastAPI server on Railway (`creait-insurance-automation1` repo) is extended with a new `/webhook/inbound-message` endpoint that applies a `flag:reply-stop` tag to contacts. The provisioner script (`provision/run_franklin.py`) is extended to create 3 pipelines, 6 standing tags, and 1 new custom field via API. The CreaitOS UI is configured manually (forms, workflows, AI bot, social planner) per a punch-list. EasyLinks integration is a Google Sheet append on stage = Bound (Won), no API integration.

**Tech Stack:** Python 3.11 + FastAPI + httpx + pytest (server), GHL API V2 (`services.leadconnectorhq.com`), Pydantic for payload validation, Railway for deploy, CreaitOS UI for workflow build, Google Sheets for EasyLinks bridge.

**Reference spec:** `/Users/reecebyob/creait/Creait Clients/Sabrina/active/2026-05-05-franklin-build-design.md`

**Working directory for this plan's code changes:**
`/tmp/creait-insurance-automation1` (clone of `https://github.com/Creait-tech/creait-insurance-automation1.git`) — clone it fresh on a feature branch before starting.

---

## File Structure

### Files to be created in the GitHub repo

| Path | Responsibility |
|---|---|
| `server/inbound_message.py` | Webhook handler that applies `flag:reply-stop` to a contact when GHL fires an inbound-message event |
| `tests/test_inbound_message.py` | Unit tests for the inbound-message handler |
| `docs/franklin/specs/intake-form.json` | Machine-readable form schema (field names, types, conditional visibility rules) |
| `docs/franklin/specs/pipelines.json` | Machine-readable pipeline + stage definitions |
| `docs/franklin/specs/workflows/W1-cold-nurture.md` | Cold Lead Nurture workflow spec — trigger, sequence, exit conditions, copy |
| `docs/franklin/specs/workflows/W2-warm-nurture.md` | Warm Lead Nurture workflow spec |
| `docs/franklin/specs/workflows/W3-quoted-followup.md` | Quoted Follow-Up workflow spec |
| `docs/franklin/specs/workflows/W4-onboarding-referral.md` | Onboarding & Referral Ask workflow spec |
| `docs/franklin/specs/workflows/W5-longterm-reengagement.md` | Long-term Re-engagement workflow spec |
| `docs/franklin/specs/workflows/W6-easylinks-csv-export.md` | EasyLinks CSV append workflow spec |
| `docs/franklin/credentials-rotation.md` | Procedure for rotating API keys, ProWriters/Sembley/EasyLinks passwords |

### Files to be modified

| Path | What changes | Why |
|---|---|---|
| `server/main.py` | Add `app.include_router(inbound_message_router)` after the existing `lead_capture_router` include | Wire the new webhook endpoint |
| `server/router.py` | Add reply-stop short-circuit in `route_webhook()` — when event_type is `InboundMessage`, route to inbound_message handler | Cross-channel reply-stop |
| `provision/run_franklin.py` | Add Step 7: ensure 6 standing tags exist (`campaign-cold`, `campaign-warm`, `campaign-quoted`, `campaign-won`, `campaign-nurture`, `flag:reply-stop`); Step 8: create `intake_notes` custom field if absent | One-shot provisioning of standing data |
| `ghl/custom_fields.py` | Add `intake_notes` field definition to `FRANKLIN_CUSTOM_FIELDS` list under "Lead Tracking" folder | Enables the form's "Anything else?" field |
| `ghl/tags.py` | Add `ensure_tags_exist()` helper that POSTs each tag once via `/locations/{id}/tags` to pre-create them | GHL auto-creates tags on first use, but pre-creating ensures workflows referencing them at build time don't 404 |
| `tests/test_ghl_tags.py` | Add tests for `ensure_tags_exist()` | TDD |

### Files NOT touched (out of scope for Phase 1)

- `sembley/` — Phase 3
- Any future `prowriters/` module — Phase 4
- Any future `veracity/` module — Phase 2

---

## Task 0: Branch + dependency check

**Files:** None modified. Setup only.

- [ ] **Step 1: Clone repo fresh and create feature branch**

```bash
cd /tmp
rm -rf creait-insurance-automation1 2>/dev/null
git clone https://github.com/Creait-tech/creait-insurance-automation1.git
cd creait-insurance-automation1
git checkout -b feat/phase1-mvp
```

- [ ] **Step 2: Install dependencies and verify tests pass on a clean clone**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -q
```

Expected: all tests pass. If any fail on a clean clone, **stop and fix the existing test failure first** — the rest of this plan assumes a green baseline.

- [ ] **Step 3: Commit nothing yet — branch is just for staging**

No commit needed. Branch exists, baseline is green.

---

## Task 1: Add `intake_notes` custom field to provisioner

**Files:**
- Modify: `ghl/custom_fields.py`
- Test: `tests/test_custom_fields.py`

Phase 1 spec calls for an `intake_notes` field bound to the form's "Anything else we should know?" textarea.

- [ ] **Step 1: Open `ghl/custom_fields.py` and find the `FRANKLIN_CUSTOM_FIELDS` list**

Search for the field with `"fieldKey": "intake_notes"`.

```bash
grep -n "intake_notes" ghl/custom_fields.py
```

If it already exists, skip to Step 4. Otherwise continue.

- [ ] **Step 2: Write the failing test**

Open `tests/test_custom_fields.py`. Add this test at the bottom of the file:

```python
def test_franklin_custom_fields_includes_intake_notes():
    from ghl.custom_fields import FRANKLIN_CUSTOM_FIELDS
    keys = [f["fieldKey"] for f in FRANKLIN_CUSTOM_FIELDS]
    assert "intake_notes" in keys, "intake_notes field is required for the form's free-text field"

    intake = next(f for f in FRANKLIN_CUSTOM_FIELDS if f["fieldKey"] == "intake_notes")
    assert intake["dataType"] == "LARGE_TEXT", "intake_notes should be LARGE_TEXT for free-form prose"
    assert intake["folder"] == "Lead Tracking"
```

Run it:

```bash
pytest tests/test_custom_fields.py::test_franklin_custom_fields_includes_intake_notes -v
```

Expected: FAIL with "intake_notes field is required..." (assuming it doesn't already exist).

- [ ] **Step 3: Add the field definition**

In `ghl/custom_fields.py`, locate the section labeled `# Lead Tracking ----` (or equivalent). Add this entry just before the closing of that group:

```python
    {
        "name": "Intake Notes",
        "dataType": "LARGE_TEXT",
        "fieldKey": "intake_notes",
        "folder": "Lead Tracking",
    },
```

- [ ] **Step 4: Re-run test, expect pass**

```bash
pytest tests/test_custom_fields.py::test_franklin_custom_fields_includes_intake_notes -v
```

Expected: PASS.

- [ ] **Step 5: Run full custom-fields test suite to confirm no regression**

```bash
pytest tests/test_custom_fields.py -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add ghl/custom_fields.py tests/test_custom_fields.py
git commit -m "feat(custom-fields): add intake_notes for free-text form input"
```

---

## Task 2: Add `ensure_tags_exist()` helper in `ghl/tags.py`

**Files:**
- Modify: `ghl/tags.py`
- Test: `tests/test_ghl_tags.py`

Standing tags need to exist before workflows can reference them. GHL auto-creates tags on first contact-tag application, but workflow builders pick from a tag list — pre-creating avoids the chicken-and-egg.

- [ ] **Step 1: Write the failing test**

Open `tests/test_ghl_tags.py`. Add this test at the bottom:

```python
import pytest
import respx
import httpx
from ghl.client import GHLClient
from ghl.tags import ensure_tags_exist


@pytest.mark.asyncio
@respx.mock
async def test_ensure_tags_exist_posts_each_missing_tag():
    location_id = "LOC123"
    api_key = "key"
    base = "https://services.leadconnectorhq.com"

    # Existing tags GET returns one of the three we want
    respx.get(f"{base}/locations/{location_id}/tags").mock(
        return_value=httpx.Response(200, json={"tags": [{"name": "campaign-cold", "id": "t1"}]})
    )
    # POST to create the two missing ones
    create_route = respx.post(f"{base}/locations/{location_id}/tags").mock(
        return_value=httpx.Response(201, json={"tag": {"id": "newid", "name": "x"}})
    )

    client = GHLClient(api_key=api_key, location_id=location_id)
    await ensure_tags_exist(client, ["campaign-cold", "campaign-warm", "flag:reply-stop"])

    # campaign-cold already existed → 2 POSTs (warm + reply-stop)
    assert create_route.call_count == 2


@pytest.mark.asyncio
@respx.mock
async def test_ensure_tags_exist_idempotent_when_all_present():
    location_id = "LOC123"
    base = "https://services.leadconnectorhq.com"

    respx.get(f"{base}/locations/{location_id}/tags").mock(
        return_value=httpx.Response(200, json={"tags": [
            {"name": "campaign-cold", "id": "t1"},
            {"name": "campaign-warm", "id": "t2"},
        ]})
    )
    create_route = respx.post(f"{base}/locations/{location_id}/tags").mock(
        return_value=httpx.Response(201, json={"tag": {"id": "newid"}})
    )

    client = GHLClient(api_key="key", location_id=location_id)
    await ensure_tags_exist(client, ["campaign-cold", "campaign-warm"])

    assert create_route.call_count == 0  # all present, no POSTs
```

Run it:

```bash
pytest tests/test_ghl_tags.py::test_ensure_tags_exist_posts_each_missing_tag -v
```

Expected: FAIL with "ImportError: cannot import name 'ensure_tags_exist'".

- [ ] **Step 2: Implement `ensure_tags_exist()` in `ghl/tags.py`**

Add this function at the bottom of `ghl/tags.py`:

```python
async def ensure_tags_exist(client: GHLClient, tag_names: list[str]) -> None:
    """Idempotently ensure standing tags exist on the location.

    GHL auto-creates tags when first applied to a contact, but the workflow
    builder UI requires tags to exist before they can be selected as triggers.
    This helper GETs existing tags and POSTs only the missing ones.
    """
    if not tag_names:
        return
    resp = await client.get(f"/locations/{client.location_id}/tags")
    existing_names = {t.get("name") for t in resp.get("tags", [])}
    for name in tag_names:
        if name in existing_names:
            logger.info("Tag already exists: %s", name)
            continue
        await client.post(
            f"/locations/{client.location_id}/tags",
            {"name": name},
        )
        logger.info("Created standing tag: %s", name)
```

- [ ] **Step 3: Re-run tests, expect pass**

```bash
pytest tests/test_ghl_tags.py -v
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add ghl/tags.py tests/test_ghl_tags.py
git commit -m "feat(tags): add ensure_tags_exist helper for standing-tag provisioning"
```

---

## Task 3: Extend provisioner to ensure 6 standing tags exist

**Files:**
- Modify: `provision/run_franklin.py`

The standing tags Phase 1 needs are: `campaign-cold`, `campaign-warm`, `campaign-quoted`, `campaign-won`, `campaign-nurture`, `flag:reply-stop`.

- [ ] **Step 1: Open `provision/run_franklin.py` and find the `async def run()` function**

Search for the order-of-operations comment block at the top of the file.

- [ ] **Step 2: Add Step 7 after the existing custom-fields/pipelines/calendar steps**

Locate the line that runs the calendar provisioning (the last numbered step before `_save_config(config)`). After it, before `_save_config`, add:

```python
    # Step 7: Standing tags ----------------------------------------------
    logger.info("\n[7/7] Ensuring standing tags exist...")
    from ghl.tags import ensure_tags_exist
    standing_tags = [
        "campaign-cold",
        "campaign-warm",
        "campaign-quoted",
        "campaign-won",
        "campaign-nurture",
        "flag:reply-stop",
    ]
    try:
        await ensure_tags_exist(client, standing_tags)
        config["standing_tags"] = standing_tags
        logger.info("  OK — %d standing tags ensured", len(standing_tags))
    except Exception as e:
        logger.warning("  Standing tags step failed (non-blocking): %s", e)
```

Also update the docstring at the top of the file to reflect 7 steps instead of 6.

- [ ] **Step 3: Run the full test suite to verify nothing regressed**

```bash
pytest -q
```

Expected: all pass. The provisioner is exercised via mocked tests; it doesn't run for real here.

- [ ] **Step 4: Commit**

```bash
git add provision/run_franklin.py
git commit -m "feat(provision): ensure 6 standing tags on every run"
```

---

## Task 4: Add `InboundMessagePayload` model + handler

**Files:**
- Create: `server/inbound_message.py`
- Test: `tests/test_inbound_message.py`

Cross-channel reply-stop. When GHL fires an inbound-message webhook (email reply, SMS reply, FB DM, IG DM, web chat), this handler applies the `flag:reply-stop` tag to the contact, which causes every active workflow to exit (since each workflow has an exit condition: "if contact has `flag:reply-stop`, exit").

- [ ] **Step 1: Write the failing tests**

Create `tests/test_inbound_message.py`:

```python
import pytest
import respx
import httpx
from server.inbound_message import handle_inbound_message


@pytest.mark.asyncio
@respx.mock
async def test_inbound_message_applies_reply_stop_tag(monkeypatch):
    monkeypatch.setenv("GHL_API_KEY", "test-key")
    monkeypatch.setenv("GHL_LOCATION_ID", "LOC1")

    base = "https://services.leadconnectorhq.com"
    apply_route = respx.post(f"{base}/contacts/CONTACT1/tags").mock(
        return_value=httpx.Response(200, json={"tags": ["flag:reply-stop"]})
    )

    payload = {
        "type": "InboundMessage",
        "contact": {"id": "CONTACT1", "email": "j@example.com"},
        "message": {"channel": "email", "body": "stop emailing me"},
    }
    await handle_inbound_message(payload)

    assert apply_route.called
    request_body = apply_route.calls[0].request.content.decode()
    assert "flag:reply-stop" in request_body


@pytest.mark.asyncio
async def test_inbound_message_skips_when_no_contact_id(caplog):
    payload = {"type": "InboundMessage", "message": {"channel": "email"}}
    # no contact key — should warn and return without raising
    await handle_inbound_message(payload)
    assert "no contact" in caplog.text.lower() or "skipping" in caplog.text.lower()


@pytest.mark.asyncio
async def test_inbound_message_skips_when_no_credentials(monkeypatch, caplog):
    monkeypatch.delenv("GHL_API_KEY", raising=False)
    monkeypatch.delenv("GHL_LOCATION_ID", raising=False)
    payload = {"type": "InboundMessage", "contact": {"id": "C1"}}
    await handle_inbound_message(payload)
    assert "credentials missing" in caplog.text.lower() or "skipped" in caplog.text.lower()
```

Run them:

```bash
pytest tests/test_inbound_message.py -v
```

Expected: FAIL with "ModuleNotFoundError: server.inbound_message".

- [ ] **Step 2: Create `server/inbound_message.py`**

Create the file with:

```python
"""Inbound message handler — applies cross-channel reply-stop guardrail.

When GHL fires a webhook for an inbound message (email reply, SMS reply,
FB DM, IG DM, web chat), this handler tags the contact with
`flag:reply-stop`. Every nurture workflow has an exit condition checking
for this tag, so all active sequences across all channels stop immediately.

Sabrina's manual resume: remove the tag from the contact in GHL.
"""

import logging
import os

from ghl.client import GHLClient
from ghl.tags import apply_tags

logger = logging.getLogger(__name__)

REPLY_STOP_TAG = "flag:reply-stop"


async def handle_inbound_message(payload: dict) -> None:
    """Apply reply-stop tag to the contact whose inbound message triggered the webhook."""
    contact = payload.get("contact") or {}
    contact_id = contact.get("id")
    if not contact_id:
        logger.warning("Inbound message webhook with no contact id — skipping")
        return

    api_key = os.environ.get("GHL_API_KEY")
    location_id = os.environ.get("GHL_LOCATION_ID")
    if not api_key or not location_id:
        logger.warning(
            "GHL credentials missing — inbound message handling skipped for contact %s",
            contact_id,
        )
        return

    client = GHLClient(api_key=api_key, location_id=location_id)
    channel = (payload.get("message") or {}).get("channel", "unknown")

    try:
        await apply_tags(client, contact_id, [REPLY_STOP_TAG])
        logger.info(
            "Applied %s to contact %s (channel=%s) — all sequences will exit",
            REPLY_STOP_TAG, contact_id, channel,
        )
    except Exception:
        logger.exception(
            "Failed to apply reply-stop tag for contact %s — sequences may continue",
            contact_id,
        )
```

- [ ] **Step 3: Re-run tests, expect pass**

```bash
pytest tests/test_inbound_message.py -v
```

Expected: all 3 pass.

- [ ] **Step 4: Commit**

```bash
git add server/inbound_message.py tests/test_inbound_message.py
git commit -m "feat(reply-stop): inbound-message webhook handler tags contact for cross-channel exit"
```

---

## Task 5: Wire `InboundMessage` event into the router

**Files:**
- Modify: `server/router.py`
- Test: `tests/test_router.py`

The existing router dispatches `FormSubmitted` and `OpportunityStageChanged`. Add `InboundMessage` dispatch.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_router.py`:

```python
@pytest.mark.asyncio
async def test_route_inbound_message_calls_handler(monkeypatch, caplog):
    """Inbound-message events should be dispatched to handle_inbound_message."""
    called = {"count": 0}

    async def fake_handler(payload):
        called["count"] += 1

    monkeypatch.setattr("server.inbound_message.handle_inbound_message", fake_handler)

    payload = {
        "type": "InboundMessage",
        "contact": {"id": "C1"},
        "message": {"channel": "sms"},
    }
    with caplog.at_level(logging.INFO):
        await route_webhook(payload)
    assert called["count"] == 1
```

Run it:

```bash
pytest tests/test_router.py::test_route_inbound_message_calls_handler -v
```

Expected: FAIL — the router doesn't route `InboundMessage` yet.

- [ ] **Step 2: Add the dispatch branch in `server/router.py`**

Open `server/router.py`. Find the section that dispatches event types (the block with `if event_type in ("FormSubmitted", "FormSubmission"):`). Add this block right after the form-submission and stage-change branches, before the line-of-business routing fallback:

```python
    if event_type in ("InboundMessage",):
        from server.inbound_message import handle_inbound_message
        await handle_inbound_message(payload)
        return
```

Also extend `_infer_event_type()` at the bottom of the file. After the existing inference branches add:

```python
    if "message" in payload and isinstance(payload["message"], dict):
        return "InboundMessage"
```

- [ ] **Step 3: Re-run tests, expect pass**

```bash
pytest tests/test_router.py -v
```

Expected: all router tests pass including the new one.

- [ ] **Step 4: Run the full suite to confirm no regression**

```bash
pytest -q
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add server/router.py tests/test_router.py
git commit -m "feat(router): dispatch InboundMessage events to reply-stop handler"
```

---

## Task 6: Pipeline definitions JSON spec file

**Files:**
- Create: `docs/franklin/specs/pipelines.json`

Per the source-of-truth split: machine-readable pipeline definitions live in the repo. The provisioner already has these in Python (`ghl/pipelines.py` `NEW_PIPELINES`); we mirror them as JSON for handoff and traceability.

- [ ] **Step 1: Create `docs/franklin/specs/` directory if absent**

```bash
mkdir -p docs/franklin/specs/workflows
```

- [ ] **Step 2: Create `docs/franklin/specs/pipelines.json`**

Write this exact content to `docs/franklin/specs/pipelines.json`:

```json
{
  "pipelines": [
    {
      "name": "Cyber Insurance",
      "stages": [
        "New Lead",
        "Contacted",
        "Quote Requested",
        "Quoted",
        "Negotiating",
        "Bound (Won)",
        "Lost"
      ]
    },
    {
      "name": "Professional Liability",
      "stages": [
        "New Lead",
        "Contacted",
        "Quote Requested",
        "Quoted",
        "Negotiating",
        "Bound (Won)",
        "Lost"
      ]
    },
    {
      "name": "Surety Bonds",
      "stages": [
        "New Lead",
        "Application Sent",
        "Bound (Won)",
        "Lost"
      ]
    }
  ],
  "stage_to_campaign_tag": {
    "New Lead": "campaign-cold",
    "Contacted": "campaign-warm",
    "Quote Requested": "campaign-warm",
    "Quoted": "campaign-quoted",
    "Negotiating": "campaign-quoted",
    "Bound (Won)": "campaign-won",
    "Lost": "campaign-nurture",
    "Application Sent": "campaign-warm"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add docs/franklin/specs/pipelines.json
git commit -m "docs(specs): pipelines.json source-of-truth for 3 LoB pipelines"
```

---

## Task 7: Intake form JSON spec file

**Files:**
- Create: `docs/franklin/specs/intake-form.json`

The single dynamic form's machine-readable schema. CreaitOS UI builder uses this as the field map.

- [ ] **Step 1: Create `docs/franklin/specs/intake-form.json`**

Write this exact content:

```json
{
  "name": "Insurance Lead Intake",
  "type": "multi-step",
  "submit_endpoint": "/api/lead-capture",
  "pages": [
    {
      "name": "Contact",
      "fields": [
        {"name": "first_name", "label": "First Name", "type": "text", "required": true, "ghl_field": "firstName"},
        {"name": "last_name", "label": "Last Name", "type": "text", "required": true, "ghl_field": "lastName"},
        {"name": "company_name", "label": "Business / Company Name", "type": "text", "required": true, "ghl_field": "companyName"},
        {"name": "email", "label": "Email", "type": "email", "required": true, "ghl_field": "email"},
        {"name": "phone", "label": "Phone", "type": "phone", "required": true, "ghl_field": "phone"}
      ]
    },
    {
      "name": "Coverage",
      "fields": [
        {
          "name": "line_of_business",
          "label": "What kind of coverage are you looking for?",
          "type": "dropdown",
          "required": true,
          "ghl_field": "line_of_business",
          "options": [
            "Cyber",
            "Professional Liability",
            "Surety Bond",
            "General Liability",
            "Commercial Auto",
            "Group Benefits",
            "Liquor Liability",
            "Other (Tell us in notes)"
          ]
        },
        {
          "name": "contact_state",
          "label": "What state is your business in?",
          "type": "us-state-dropdown",
          "required": true,
          "ghl_field": "contact_state"
        },
        {
          "name": "policy_expiration_date",
          "label": "When does your current policy expire? (optional)",
          "type": "date",
          "required": false,
          "ghl_field": "policy_expiration_date"
        },
        {
          "name": "intake_notes",
          "label": "Anything else we should know? (optional)",
          "type": "textarea",
          "required": false,
          "ghl_field": "intake_notes",
          "max_length": 2000
        }
      ]
    },
    {
      "name": "Consent",
      "fields": [
        {
          "name": "tcpa_consent",
          "label": "I agree to receive emails and text messages from Franklin Insurance Solutions about insurance coverage. Message and data rates may apply. Reply STOP to opt out at any time.",
          "type": "checkbox",
          "required": true,
          "ghl_field": "tcpa_consent"
        },
        {
          "name": "website",
          "label": "(do not fill — bot honeypot)",
          "type": "text",
          "required": false,
          "hidden": true,
          "css_class": "honeypot-hidden"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/franklin/specs/intake-form.json
git commit -m "docs(specs): intake-form.json — single dynamic form schema for all LoBs"
```

---

## Task 8: Workflow spec — Cold Lead Nurture (W1)

**Files:**
- Create: `docs/franklin/specs/workflows/W1-cold-nurture.md`

The 4-week sequence triggered when `campaign-cold` tag is applied to a contact.

- [ ] **Step 1: Create the workflow spec file**

Write this exact content to `docs/franklin/specs/workflows/W1-cold-nurture.md`:

```markdown
# Workflow W1: Cold Lead Nurture

**Status:** spec — not yet built in CreaitOS UI
**Owner of build:** Maurice / Creait team in CreaitOS UI
**Last updated:** 2026-05-05

## Trigger

Tag `campaign-cold` is applied to a contact. The FastAPI server applies this tag in `server/lead_capture.py::handle_form_submission()` immediately on form submit.

## Exit conditions (apply to every step below)

The workflow exits IMMEDIATELY if any of these become true:

1. Contact has tag `flag:reply-stop` (cross-channel reply detected by `server/inbound_message.py`)
2. Contact has any of: `campaign-warm`, `campaign-quoted`, `campaign-won`, `campaign-nurture` (stage advanced)
3. Contact's `Marketing Opt-In (Email)` is false (manually unsubscribed via email link)
4. Contact's TCPA consent is false (manual revocation)

In CreaitOS UI: each Send action below is preceded by a "Wait — exit if tag present" condition checking for `flag:reply-stop`.

## Sequence

| Day | Channel | Subject / Opening | Body source |
|---|---|---|---|
| 0 | Email | "Got your details, Sabrina here" | `messages/W1-day0-email.md` |
| 0 | SMS (10 min after email) | "Hey {{first_name}}, this is Sabrina at Franklin..." | `messages/W1-day0-sms.md` |
| 1 | Email | "What kind of {{line_of_business}} fits your business" | `messages/W1-day1-email.md` |
| 3 | Email | "Quick story about a client like you" | `messages/W1-day3-email.md` |
| 5 | SMS | "{{first_name}}, want me to put a quote together?" | `messages/W1-day5-sms.md` |
| 8 | Email | "3 things to look for in {{line_of_business}}" | `messages/W1-day8-email.md` |
| 13 | Email | "Should I close the file or keep it open?" | `messages/W1-day13-email.md` |
| 19 | SMS | "Last try, {{first_name}} — happy to help when you're ready" | `messages/W1-day19-sms.md` |
| 27 | Email | "Closing the file unless you tell me otherwise" — auto-applies `campaign-nurture` tag | `messages/W1-day27-email.md` |

## Footer (every email)

> Franklin Insurance Solutions | 3314 Britt Moore Rd, Suite 1000B, Houston, TX 77043 | [Unsubscribe]({{unsubscribe_link}})
> This is a marketing email. Reply STOP at any time to stop these messages.

## SMS footer (every SMS)

> Reply STOP to stop, HELP for help. Msg & data rates may apply.

## Voice / tone

Per Sabrina's stated preference (April 20 onboarding): "Texan warm but a little less country." Conversational, first-person, no marketing-speak. Sabrina is a real person, sounds like a real person, signs every email with "— Sabrina."

## Build location

CreaitOS UI: Automation → Workflows → New → Triggered by tag.
Trigger: `campaign-cold` applied.
Each step: Wait → check for exit tag → Send Email/SMS.

## Copy files

Email and SMS message bodies live in `docs/franklin/specs/workflows/messages/` — drafted from local folder content library at `/Sabrina/04_Messaging/`. Each message authored in markdown with `{{first_name}}`, `{{line_of_business}}`, `{{unsubscribe_link}}` merge fields exactly matching CreaitOS's syntax.

**Note:** the actual copy authoring is a separate task (see Task 14). This spec defines the shape only.
```

- [ ] **Step 2: Commit**

```bash
git add docs/franklin/specs/workflows/W1-cold-nurture.md
git commit -m "docs(specs): W1 cold-lead-nurture workflow spec"
```

---

## Task 9: Workflow specs — W2 through W5 (warm, quoted, won, nurture)

**Files:**
- Create: `docs/franklin/specs/workflows/W2-warm-nurture.md`
- Create: `docs/franklin/specs/workflows/W3-quoted-followup.md`
- Create: `docs/franklin/specs/workflows/W4-onboarding-referral.md`
- Create: `docs/franklin/specs/workflows/W5-longterm-reengagement.md`

Same structure as W1. Different triggers, different sequences.

- [ ] **Step 1: Create `W2-warm-nurture.md`**

```markdown
# Workflow W2: Warm Lead Nurture

**Status:** spec — not yet built in CreaitOS UI
**Owner of build:** Maurice / Creait team in CreaitOS UI
**Last updated:** 2026-05-05

## Trigger

Tag `campaign-warm` applied. Server applies this when opportunity moves to "Contacted" or "Quote Requested" stage (per `server/stage_transitions.py::STAGE_TAG_MAP`).

## Exit conditions

Same 4 as W1: `flag:reply-stop`, any other campaign tag (cold/quoted/won/nurture), email opt-out, TCPA revoked.

## Sequence

| Day | Channel | Subject / Opening | Body source |
|---|---|---|---|
| 0 | Email | "Let's get a real quote put together" | `messages/W2-day0-email.md` |
| 1 | SMS | "{{first_name}}, when's a good 15-min for a call?" | `messages/W2-day1-sms.md` |
| 4 | Email | "Here's a calendar link if email's easier" + book link | `messages/W2-day4-email.md` |
| 8 | Email | "Anything I can dig into before we talk?" | `messages/W2-day8-email.md` |
| 11 | SMS | "{{first_name}}, last touch before I check back in 2 weeks" | `messages/W2-day11-sms.md` |
| 14 | Email | "Pausing the line — flag me when timing is right" — auto-applies `campaign-nurture` | `messages/W2-day14-email.md` |

## Footer + voice

Same as W1.

## Build location

CreaitOS UI: Automation → Workflows → triggered by `campaign-warm` tag applied.
```

- [ ] **Step 2: Create `W3-quoted-followup.md`**

```markdown
# Workflow W3: Quoted Follow-Up

**Status:** spec — not yet built in CreaitOS UI
**Owner of build:** Maurice / Creait team in CreaitOS UI
**Last updated:** 2026-05-05

## Trigger

Tag `campaign-quoted` applied. Server applies this when opportunity moves to "Quoted" or "Negotiating" stage.

## Exit conditions

Same 4 as W1, plus: opportunity moves to `Bound (Won)` or `Lost`.

## Sequence

| Day | Channel | Subject / Opening | Body source |
|---|---|---|---|
| 0 | Email (immediate, on stage entry) | "Your quote is ready — here's what I'm seeing" + quote PDFs | `messages/W3-day0-email.md` |
| 2 | SMS | "{{first_name}}, did the quote come through okay?" | `messages/W3-day2-sms.md` |
| 5 | Email | "Quick check on that quote — any questions?" | `messages/W3-day5-email.md` |
| 7 | SMS | "Want to hop on a call to walk through it?" + book link | `messages/W3-day7-sms.md` |
| 14 | Email (weekly cadence starts) | "Touching base — quote still good through {{policy_expiration_date}}" | `messages/W3-week2-email.md` |
| 21 | Email | (same template, different opening) | `messages/W3-week3-email.md` |
| 28 | Email | "Closing this out unless I hear back" — auto-applies `campaign-nurture` | `messages/W3-week4-email.md` |

## Footer + voice

Same as W1. Note: the Day-0 email is **transactional** (quote delivery) — no unsubscribe footer required, but include it anyway for consistency. Reply-stop still applies.

## Build location

CreaitOS UI: Automation → Workflows → triggered by `campaign-quoted` tag applied.
```

- [ ] **Step 3: Create `W4-onboarding-referral.md`**

```markdown
# Workflow W4: Onboarding & Referral Ask

**Status:** spec — not yet built in CreaitOS UI
**Owner of build:** Maurice / Creait team in CreaitOS UI
**Last updated:** 2026-05-05

## Trigger

Tag `campaign-won` applied. Server applies this when opportunity moves to "Bound (Won)".

## Exit conditions

Same 4 as W1.

## Sequence

| Day | Channel | Subject / Opening | Body source |
|---|---|---|---|
| 0 | Email (immediate) | "Welcome aboard! Here's what happens next" | `messages/W4-day0-email.md` |
| 0 | Workflow side-effect | Append row to EasyLinks export Google Sheet (see W6) | n/a |
| 3 | Email | "Quick tip: setting up your {{line_of_business}} for the year" | `messages/W4-day3-email.md` |
| 10 | Email | "How are things going? Quick check-in" | `messages/W4-day10-email.md` |
| 14 | SMS + Email | "Mind dropping a quick Google review?" + review link | `messages/W4-day14-review.md` |
| 30 | Email | "Know anyone else who could use {{line_of_business}}? Here's $50 if so" | `messages/W4-day30-referral.md` |

## Build location

CreaitOS UI: Automation → Workflows → triggered by `campaign-won` tag applied.

Day-0 side effect (EasyLinks Google Sheet append) is implemented as a separate workflow step using CreaitOS's Google Sheets action — see W6 for the full spec.
```

- [ ] **Step 4: Create `W5-longterm-reengagement.md`**

```markdown
# Workflow W5: Long-term Re-engagement

**Status:** spec — not yet built in CreaitOS UI
**Owner of build:** Maurice / Creait team in CreaitOS UI
**Last updated:** 2026-05-05

## Trigger

Tag `campaign-nurture` applied. Server applies this when opportunity moves to "Lost", or W1/W2/W3 sequences exhaust without conversion.

## Exit conditions

Same 4 as W1. Note: this is the terminal state for a non-converted lead — only exits if the contact re-engages (any other campaign tag re-applied via Sabrina manually moving them in pipeline).

## Sequence

Quarterly. Email only, no SMS.

| Day | Channel | Subject / Opening | Body source |
|---|---|---|---|
| 0 | Email | "Just a hello — no ask, just keeping the door open" | `messages/W5-q1-email.md` |
| 90 | Email | "Industry update — saw this and thought of you" | `messages/W5-q2-email.md` |
| 180 | Email | "Mid-year check-in — anything changed?" | `messages/W5-q3-email.md` |
| 270 | Email | "End of year — do you want to revisit coverage?" | `messages/W5-q4-email.md` |
| 365+ | Loop back to Day 0 | Annual re-engagement | n/a |

## Build location

CreaitOS UI: Automation → Workflows → triggered by `campaign-nurture` tag applied.
```

- [ ] **Step 5: Commit all four**

```bash
git add docs/franklin/specs/workflows/W2-warm-nurture.md
git add docs/franklin/specs/workflows/W3-quoted-followup.md
git add docs/franklin/specs/workflows/W4-onboarding-referral.md
git add docs/franklin/specs/workflows/W5-longterm-reengagement.md
git commit -m "docs(specs): W2-W5 workflow specs (warm/quoted/won/nurture)"
```

---

## Task 10: Workflow spec — EasyLinks CSV export (W6)

**Files:**
- Create: `docs/franklin/specs/workflows/W6-easylinks-csv-export.md`

EasyLinks integration is a Google Sheet append on stage = Bound (Won). Sabrina manually downloads and uploads to EasyLinks weekly.

- [ ] **Step 1: Create the spec file**

```markdown
# Workflow W6: EasyLinks CSV Export

**Status:** spec — not yet built in CreaitOS UI
**Owner of build:** Maurice / Creait team in CreaitOS UI
**Last updated:** 2026-05-05

## Trigger

Opportunity moved to stage "Bound (Won)" in any pipeline (Cyber Insurance, Professional Liability, Surety Bonds).

## Action

Append one row to the Google Sheet `Franklin EasyLinks Export` (owned by Sabrina, shared read-write with the Creait team during build, read-only after handoff).

## Row schema

| Column | Source field | Format |
|---|---|---|
| Date Bound | trigger date | YYYY-MM-DD |
| First Name | contact.firstName | text |
| Last Name | contact.lastName | text |
| Business Name | contact.companyName | text |
| Email | contact.email | text |
| Phone | contact.phone | E.164 |
| Address Line 1 | contact.address1 | text |
| City | contact.city | text |
| State | contact.contact_state | 2-letter |
| ZIP | contact.postalCode | text |
| Line of Business | contact.line_of_business | text |
| Carrier | contact.preferred_carrier | text |
| Premium | opportunity.monetaryValue | numeric |
| Policy Effective Date | contact.policy_effective_date | YYYY-MM-DD |
| Notes | opportunity.notes | text |

## Sabrina's manual task

Once a week (Sabrina's choice of day):

1. Open the Google Sheet
2. File → Download → CSV
3. Log into EasyLinks → Contacts → Import → upload CSV
4. Mark imported rows in column "Imported" with Y

The Google Sheet retains permanent history — never auto-cleared. ~5 minutes per week.

## Build location

CreaitOS UI: Automation → Workflows → triggered by Opportunity Stage Changed → if new stage = "Bound (Won)" → Google Sheets action: Append Row.

## Why not auto-push to EasyLinks via API?

Sabrina's EasyLinks plan ($954/mo Sales Center) has API access but she's planning to downgrade to Basic ($540/mo) which does not. CSV import works on every plan tier. Choosing CSV upfront avoids re-engineering when she downgrades.
```

- [ ] **Step 2: Commit**

```bash
git add docs/franklin/specs/workflows/W6-easylinks-csv-export.md
git commit -m "docs(specs): W6 easylinks-csv-export workflow spec"
```

---

## Task 11: Credentials rotation procedure doc

**Files:**
- Create: `docs/franklin/credentials-rotation.md`

Spec section 5B requires this. Tribal knowledge gets lost; document it now.

- [ ] **Step 1: Create the doc**

```markdown
# Credentials Rotation Procedure

**Owner:** Creait team / Maurice
**Cadence:** Every 90 days for any insurance-system credential. Immediately on suspected compromise.

## Credentials inventory

| Credential | Used by | Stored at | Rotation cadence |
|---|---|---|---|
| GHL Private Integration Token (`GHL_API_KEY`) | FastAPI server, provisioner | Railway env vars + Maurice's local `.env` | 90 days |
| GHL Location ID (`GHL_LOCATION_ID`) | Same | Same | Never (it's an ID, not a secret) |
| ProWriters login (Phase 4) | `prowriters/` Playwright module | Railway env vars only | 90 days |
| Sembley login (Phase 3) | `sembley/client.py` | Railway env vars only | 90 days |
| EasyLinks login | Sabrina manually only | Sabrina's password manager | 90 days (Sabrina's responsibility) |
| Anthropic API key | (if/when used for browser-use cloud) | Railway env vars only | 90 days |
| Google Sheets service-account JSON (W6) | CreaitOS workflow Google integration | CreaitOS UI integration setting | 365 days |

## Rotation steps — GHL Private Integration Token

1. Maurice logs into CreaitOS as an admin
2. Settings → Private Integrations → existing PIT → Revoke
3. Create new PIT with the same scopes (Contacts: Read+Write, Opportunities: Read+Write, Tags: Read+Write, Workflows: Read, Custom Fields: Read+Write, Calendars: Read, Locations: Read+Write)
4. Copy the new token
5. Update Railway: Project → Variables → `GHL_API_KEY` → Edit → paste new value → Save
6. Railway picks up the new value on next request — no redeploy needed
7. Update Maurice's local `.env` to match
8. Smoke test: `curl https://<railway-url>/health` returns `{"status":"ok"}`
9. Smoke test: post a test form submission, confirm contact appears in CreaitOS

## Rotation steps — ProWriters / Sembley

1. Sabrina rotates her password in the carrier portal (her account, her credentials)
2. Sabrina sends Maurice the new password via 1Password share or signal — never email or SMS
3. Maurice updates Railway env vars (`PROWRITERS_PASSWORD` / `SEMBLEY_PASSWORD`)
4. Smoke test: trigger a test cyber/pro-liab form submission, confirm Playwright login succeeds in logs

## Rotation steps — EasyLinks

Sabrina-only procedure. Creait team does not have EasyLinks access; it's not used by any automation in the current scope.

## Lockout recovery — ProWriters / Sembley

If Sabrina's account gets flagged for "automated access":

1. Pause the automation immediately:
   - Railway: set env var `PROWRITERS_AUTOMATION_ENABLED=false` (or `SEMBLEY_*`)
   - Server's automation handlers check this flag and skip if false
2. Sabrina contacts the carrier (ProWriters: Zane Goldthorp / Colin; Sembley: support@sembley.com)
3. Explain: "We're using a broker tool to fill applications faster — what's the right way to do this with your team?"
4. If unblocked: re-enable the env var
5. If they request a different approach: file a Phase 5+ ticket to migrate that automation

## Suspected compromise

If a credential is suspected leaked (email, repo commit, screen share, etc.):

1. Rotate IMMEDIATELY — don't wait for the 90-day cadence
2. Search the repo: `gh search code --repo Creait-tech/creait-insurance-automation1 "<partial token>"` to confirm it's not committed
3. If committed: rotate the credential, then rewrite git history with `git filter-repo` to remove from all commits, then force-push (this is the one exception to "never force-push" — leaked secrets win)
4. Notify Sabrina if her credential was the leaked one
```

- [ ] **Step 2: Commit**

```bash
git add docs/franklin/credentials-rotation.md
git commit -m "docs(franklin): credentials rotation procedure"
```

---

## Task 12: Run the provisioner against Sabrina's sub-account

**Files:** None modified (runs against live GHL).

This task takes the provisioner work from Tasks 1, 2, 3 live. Requires `GHL_API_KEY` and `GHL_LOCATION_ID` env vars.

- [ ] **Step 1: Confirm credentials are set in Maurice's local `.env`**

```bash
grep -E "GHL_API_KEY|GHL_LOCATION_ID" .env
```

Expected: both present, with `GHL_LOCATION_ID=pIevOG07v2c9Ry6wKOol`.

If absent: get them from Railway → Variables, paste into local `.env`. Never commit.

- [ ] **Step 2: Dry-run check the provisioner script**

```bash
python -m provision.run_franklin --help 2>&1 | head -20
```

If `--help` isn't supported, just inspect the script:

```bash
head -50 provision/run_franklin.py
```

Confirm the order-of-operations comment shows 7 steps (after Task 3 added Step 7 standing tags).

- [ ] **Step 3: Run the provisioner**

```bash
python -m provision.run_franklin
```

Expected output (abbreviated):

```
=== Franklin Insurance Solutions — GHL Provisioning ===

Smoke testing GHL API access...
  OK — connected to location: Franklin Insurance Solutions

[1/7] Updating location settings...
[2/7] Ensuring custom-field folders...
[3/7] Ensuring 28 custom fields...   (was 27, +1 for intake_notes)
[4/7] Ensuring 3 pipelines...
[5/7] Ensuring discovery-call calendar...
[6/7] (calendar config or whatever step 6 does in current code)
[7/7] Ensuring standing tags exist...
  OK — 6 standing tags ensured

Saved config -> config/franklin.json
```

Some steps may report warnings if the Private Integration Token lacks scope (per the May 1 punch-list, location settings and pipeline create needed UI work because of token scope). Those warnings are non-blocking.

- [ ] **Step 4: Verify in CreaitOS UI**

Open `https://app.getcreait.com/v2/location/pIevOG07v2c9Ry6wKOol/settings/custom-fields` — confirm `intake_notes` field exists.

Open `https://app.getcreait.com/v2/location/pIevOG07v2c9Ry6wKOol/settings/tags` — confirm all 6 standing tags exist (`campaign-cold`, `campaign-warm`, `campaign-quoted`, `campaign-won`, `campaign-nurture`, `flag:reply-stop`).

If pipelines aren't there (token-scope failure on the provisioner), create them manually per `docs/franklin/specs/pipelines.json`.

- [ ] **Step 5: Commit the updated config**

```bash
git add config/franklin.json
git commit -m "chore(provision): live-run output — Franklin sub-account standing data ensured"
```

(`config/franklin.json` is gitignored if it contains secrets, but the existing repo commits it. If it's gitignored: skip this commit and just note the run completed.)

---

## Task 13: Deploy server changes to Railway

**Files:** None modified (deployment).

The new `/webhook/inbound-message` route + the router dispatch + the standing-tags helper need to land on Railway before the GHL webhook can be configured to fire it.

- [ ] **Step 1: Push the feature branch**

```bash
git push -u origin feat/phase1-mvp
```

- [ ] **Step 2: Open a PR**

```bash
gh pr create --title "Phase 1 MVP: lead capture, reply-stop, provisioner, specs" --body "$(cat <<'EOF'
## Summary

- Cross-channel reply-stop guardrail via new `InboundMessage` webhook handler
- 6 standing tags ensured by provisioner (5 campaign tags + 1 reply-stop flag)
- New `intake_notes` custom field
- Workflow specs in `docs/franklin/specs/workflows/` (W1-W6)
- Pipeline + form JSON specs as source-of-truth
- Credentials rotation procedure documented

## Test plan

- [x] Unit tests pass (`pytest -q`)
- [ ] Provisioner runs cleanly against Sabrina's sub-account (Task 12)
- [ ] Railway picks up the new code on merge to main
- [ ] In CreaitOS, configure webhook → confirm POST to `/webhook/ghl` with `InboundMessage` event type tags the contact with `flag:reply-stop`
- [ ] Test contact submits form, replies to SMS, all sequences exit (Phase 1 gate)
EOF
)"
```

- [ ] **Step 3: Wait for CI to pass**

Check `gh pr checks` until green.

- [ ] **Step 4: Merge to main**

```bash
gh pr merge --squash --delete-branch
```

Railway auto-deploys on merge to main (per `railway.json` deploy config).

- [ ] **Step 5: Smoke test the deploy**

```bash
RAILWAY_URL=$(gh secret list 2>/dev/null | grep RAILWAY_URL | head -1 || echo "https://creait-insurance-automation1-production.up.railway.app")
curl -s "$RAILWAY_URL/health"
```

Expected: `{"status":"ok"}`.

If the URL isn't known: Maurice opens Railway dashboard → Project → Deployments → Latest → copy URL.

- [ ] **Step 6: Test the new endpoint**

```bash
curl -X POST "$RAILWAY_URL/webhook/ghl" \
  -H "Content-Type: application/json" \
  -d '{"type":"InboundMessage","contact":{"id":"TEST_CONTACT_DOES_NOT_EXIST"},"message":{"channel":"sms","body":"test"}}'
```

Expected: `{"received":true}`. Server log should show "Inbound message webhook with no contact id — skipping" (because the test contact ID doesn't exist, the apply-tags call will 404 and be caught).

To test against a real contact: ask Sabrina for the contact ID of a test contact she's created, swap it into the curl above, then check that contact in CreaitOS UI — it should now have the `flag:reply-stop` tag.

---

## Task 14: CreaitOS UI punch list — sub-account config (Phase 1B)

**Files:** None modified. This is hands-on UI work in CreaitOS.

This is the bulk of Phase 1's calendar time. Per the spec section 1B, done in this exact order because each depends on the previous.

- [ ] **Step 1: DNS at Cloudflare — SPF, DKIM, DMARC**

Prerequisite: Sabrina has granted Maurice/Jaylen Cloudflare delegate access. (HOMEWORK — verify before starting Step 1.)

In CreaitOS: Settings → Email Services → Dedicated Domain.

1. Click "Add Domain"
2. Enter `franklininsurancesolutions.com`
3. Copy the 3 DNS records CreaitOS provides (SPF TXT, DKIM CNAME, DMARC TXT)
4. In Cloudflare: DNS → Records → add each record exactly as shown
5. Wait 5-10 minutes for propagation
6. Back in CreaitOS: click "Verify" on each record → all three turn green

Acceptance: send a test email from Conversations → New Conversation → it arrives in inbox (not spam) with `mail@franklininsurancesolutions.com` in From line.

- [ ] **Step 2: A2P 10DLC — sacrificial site + registration**

Prerequisite: A separate domain registered for the sacrificial compliance site. Maurice's call which domain (suggest `franklin-insurance-compliance.com` or similar — short, no claim language, Sabrina's name and address visible).

1. Stand up a single-page static site on that domain. Content: business name, EIN, address, phone, brief description ("commercial insurance brokerage"), contact email, privacy policy, terms of service. NO claim language about premiums or savings. Use any host (Vercel, Netlify, GitHub Pages — fastest).
2. In CreaitOS: Settings → Phone Numbers → A2P 10DLC → Register
3. Submit: business name, EIN (Sabrina's), address, sacrificial site URL, sample messages (use the W1 day-0 SMS as the sample), opt-in flow description (point to TCPA checkbox on form)
4. Submit. Approval time: 1-3 weeks. Build the rest in parallel.

Acceptance: A2P status = Pending. SMS won't go live until status = Approved. Don't block other work.

- [ ] **Step 3: Calendar config**

Outlook OAuth and Zoom are already connected (per May-1 punch list).

In CreaitOS: Calendars → "Sabrina — Discovery Call":

1. Set hours: Mon-Fri, 9am-5pm CT. Block lunch 12-1.
2. Set buffer: 15 min before, 15 min after.
3. Set max bookings per day: 4.
4. Set notifications: email Sabrina, SMS Sabrina, Zoom link auto-included.
5. Calendar URL: `book.franklininsurancesolutions.com/sabrina` (or the default CreaitOS URL if subdomain isn't set up — check with Sabrina).

Acceptance: from an incognito browser, book a test slot. Sabrina receives confirmation email + SMS. Zoom link populated.

- [ ] **Step 4: Branding upload**

Prerequisite: Sabrina has shared brand PowerPoint to Google Drive.

In CreaitOS: Settings → Business Profile:

1. Upload logo (extract PNG from PPT, transparent background)
2. Set primary color (extract hex from PPT)
3. Set accent color (same)
4. Address: 3314 Britt Moore Rd, Suite 1000B, Houston, TX 77043
5. Phone: the new Houston number purchased May 1
6. Industry: Insurance

Acceptance: dashboard shows logo top-left. Address visible in profile and footer.

- [ ] **Step 5: Houston phone number set as default outbound SMS**

In CreaitOS: Settings → Phone Numbers:

1. Locate the Houston number purchased May 1
2. Click → Set as Default Outbound

Acceptance: Conversations → New Conversation → SMS → From dropdown shows Houston number as default.

---

## Task 15: CreaitOS UI — single dynamic intake form

**Files:** None modified. Manual UI work, schema in `docs/franklin/specs/intake-form.json`.

Build the form per the JSON schema from Task 7.

- [ ] **Step 1: Create the form**

CreaitOS UI: Sites → Forms → Builder → New Form.

1. Name: `Insurance Lead Intake` (matches `intake-form.json` name)
2. Type: Multi-step
3. Pages: Contact, Coverage, Consent (3 pages)

- [ ] **Step 2: Page 1 — Contact**

Add 5 fields per `intake-form.json` page 1:

- First Name (required, maps to `firstName`)
- Last Name (required, maps to `lastName`)
- Business / Company Name (required, maps to `companyName`)
- Email (required, validation: email)
- Phone (required, validation: phone)

- [ ] **Step 3: Page 2 — Coverage**

Add 4 fields per `intake-form.json` page 2:

- "What kind of coverage are you looking for?" — dropdown, required, maps to custom field `line_of_business`. Options:
  - Cyber
  - Professional Liability
  - Surety Bond
  - General Liability
  - Commercial Auto
  - Group Benefits
  - Liquor Liability
  - Other (Tell us in notes)
- "What state is your business in?" — US states dropdown, required, maps to `contact_state`
- "When does your current policy expire?" — date, optional, maps to `policy_expiration_date`
- "Anything else we should know?" — long-text, optional, maps to `intake_notes`

- [ ] **Step 4: Page 3 — Consent + honeypot**

Add 2 fields:

- TCPA checkbox, required, exact label per `intake-form.json` (the long sentence about agreeing to receive emails/texts)
- Hidden `website` field with CSS class `honeypot-hidden` (CSS hides it via `display: none`; bots fill it, humans skip it; server's `LeadFormPayload` rejects submissions where `website` is non-empty)

- [ ] **Step 5: Set submission action**

CreaitOS form builder → Form Settings → On Submit:

1. Action: POST to URL
2. URL: `https://<railway-url>/api/lead-capture`
3. Payload format: JSON
4. Field name mapping: match the JSON schema's `name` field (server's `LeadFormPayload` model expects `first_name`, `last_name`, `email`, `phone`, `company_name`, `line_of_business`, `contact_state`, `policy_expiration_date`, `intake_notes`, `tcpa_consent`, `website`)
5. On success: redirect to `/thank-you`

- [ ] **Step 6: Test the form**

1. Open the form's preview URL in incognito
2. Fill all fields with realistic test data, submit
3. Check CreaitOS Contacts → confirm new contact appeared with all custom fields populated, including `line_of_business` and `intake_notes`
4. Check Railway logs: `railway logs --tail 50` → confirm `Lead captured successfully` log line
5. Confirm contact has `campaign-cold` tag applied

Acceptance: every field maps correctly, contact has `campaign-cold` tag, no errors in Railway logs.

---

## Task 16: CreaitOS UI — website rebuild on CreaitOS

**Files:** None modified. UI work.

Replace Sabrina's Wix site with a CreaitOS funnel.

- [ ] **Step 1: Build funnel "Franklin Insurance — Main Site"**

CreaitOS UI: Sites → Funnels → New → Multi-page funnel.

Pages:

1. `/` — Home (hero + 3-LoB cards + about + contact CTA)
2. `/cyber` — Cyber Insurance landing (intake form embedded with `?lob=Cyber` URL param prefilling the dropdown)
3. `/professional-liability` — Pro Liability landing (same pattern, `?lob=Professional+Liability`)
4. `/surety-bonds` — Surety Bonds landing (same, `?lob=Surety+Bond`)
5. `/thank-you-cyber` — Confirmation page after cyber form submit
6. `/thank-you-pro-liability` — Confirmation page after pro-liab submit
7. `/thank-you-bonds` — Confirmation page after bonds submit
8. `/get-quote` — Generic intake form page (default; LoB picker shown)
9. `/thank-you` — Generic thank-you (fallback)

Each page uses the brand colors/fonts from Task 14 step 4.

- [ ] **Step 2: Use Sabrina's existing copy from her Wix site as a starting point**

Visit `franklininsurancesolutions.com` (current Wix site), copy hero text, about copy, service descriptions. Paste into CreaitOS funnel pages, edit minimally to match the new structure.

- [ ] **Step 3: Embed the intake form on each LoB page**

For each LoB page (`/cyber`, `/professional-liability`, `/surety-bonds`):
- Embed the `Insurance Lead Intake` form
- Pre-select the LoB dropdown based on the page URL (CreaitOS allows form-field URL-param prefilling)

- [ ] **Step 4: Mobile-responsiveness check**

Use Chrome DevTools mobile emulator. Check each page at iPhone 12, iPad, desktop widths. Fix any layout breaks.

- [ ] **Step 5: Point DNS — `franklininsurancesolutions.com` to CreaitOS**

In Cloudflare DNS: change the A/CNAME record for `franklininsurancesolutions.com` to point at CreaitOS's published-funnel hostname (CreaitOS UI: Sites → Funnels → Settings → Domain → shows the CNAME target).

Wait 5-15 min for DNS propagation. Test in incognito: `https://franklininsurancesolutions.com` → CreaitOS-hosted site loads.

Acceptance: full site live on CreaitOS, all 4 forms-embedded pages submit cleanly, mobile-responsive, brand colors correct.

---

## Task 17: CreaitOS UI — build the 5 nurture workflows (W1-W5)

**Files:** None modified. UI work using specs from Tasks 8 + 9 + 10.

Each workflow trigger, sequence, and exit conditions are defined in `docs/franklin/specs/workflows/W*.md`. The actual email/SMS body copy is drafted from the local folder content library (`/Sabrina/04_Messaging/`).

- [ ] **Step 1: Draft message copy from local folder library**

For each of the message files referenced in W1-W4 specs (W5 is just hellos, simpler):

1. Open `/Sabrina/04_Messaging/` (contains drafted copy from the original 23-workflow plan)
2. Find the closest match — the original plan had separate Cyber, Pro-Liab, Surety nurtures; we're consolidating into one
3. Adapt to the new merge field syntax: `{{first_name}}`, `{{line_of_business}}`, `{{unsubscribe_link}}`
4. Adjust voice to "Texan warm but a little less country" (Sabrina's exact phrase) — first-person, sign every email "— Sabrina", no marketing-speak

For each message, save to `docs/franklin/specs/workflows/messages/W<N>-<day>-<channel>.md`.

- [ ] **Step 2: Build W1 (Cold Lead Nurture) in CreaitOS**

CreaitOS UI: Automation → Workflows → New → "W1: Cold Lead Nurture":

1. Trigger: Tag Added → `campaign-cold`
2. Add Wait + Exit-If-Tag steps before each Send action — exit on `flag:reply-stop`, `campaign-warm`, `campaign-quoted`, `campaign-won`, `campaign-nurture`
3. Build sequence per `W1-cold-nurture.md` table — 9 steps (Day 0 email, Day 0 SMS, Day 1 email, Day 3 email, Day 5 SMS, Day 8 email, Day 13 email, Day 19 SMS, Day 27 email)
4. Day 27 email's last step: Apply Tag → `campaign-nurture` → Remove Tag → `campaign-cold` → Exit

- [ ] **Step 3: Build W2 (Warm Lead Nurture) — same pattern as W1**

Per `W2-warm-nurture.md`. 6 steps.

- [ ] **Step 4: Build W3 (Quoted Follow-Up) — same pattern**

Per `W3-quoted-followup.md`. 7 steps.

- [ ] **Step 5: Build W4 (Onboarding & Referral Ask) — same pattern**

Per `W4-onboarding-referral.md`. 6 steps. Day 0 includes the W6 side-effect (Google Sheet append — see Task 18).

- [ ] **Step 6: Build W5 (Long-term Re-engagement) — quarterly, simpler**

Per `W5-longterm-reengagement.md`. 4 emails per year.

- [ ] **Step 7: Test each workflow with a test contact**

Create a test contact in CreaitOS (your own email + phone — never Sabrina's clients). For each workflow:

1. Apply the trigger tag
2. Confirm the Day-0 step fires within 5 min
3. Reply STOP to the SMS or reply to the email
4. Confirm the workflow exits (subsequent steps don't fire)
5. Remove the test contact

Acceptance: all 5 workflows fire on tag-applied trigger, all 5 exit on reply-stop tag.

---

## Task 18: CreaitOS UI — W6 EasyLinks Google Sheet append

**Files:** None modified. UI work.

Per `W6-easylinks-csv-export.md` spec.

- [ ] **Step 1: Sabrina creates Google Sheet**

Sabrina creates `Franklin EasyLinks Export` in her Google Drive. Shares with Maurice (read+write during build). 15 columns per the W6 spec. Header row in row 1.

- [ ] **Step 2: Connect CreaitOS to Sabrina's Google Sheets**

CreaitOS UI: Settings → Integrations → Google Sheets → OAuth flow. Sabrina logs in with her Google account, authorizes CreaitOS to read+write sheets.

- [ ] **Step 3: Build the workflow**

CreaitOS UI: Automation → Workflows → New → "W6: EasyLinks CSV Export":

1. Trigger: Opportunity Stage Changed
2. Filter: New stage = "Bound (Won)" (any pipeline)
3. Action: Google Sheets → Append Row
4. Spreadsheet: Franklin EasyLinks Export
5. Sheet: Sheet1
6. Map columns per the W6 spec table

- [ ] **Step 4: Test**

Create a test opportunity in CreaitOS, advance through stages to "Bound (Won)". Confirm a new row appears in the Google Sheet within 30 seconds.

Acceptance: bound opportunities append to the sheet automatically with all 15 columns populated correctly.

---

## Task 19: CreaitOS UI — Conversation AI bot

**Files:** None modified. UI work.

Per spec section 1B step 5: "Sabrina Assistant" persona, "Texan warm but a little less country."

- [ ] **Step 1: Configure the bot**

CreaitOS UI: Settings → Conversation AI → Create Bot:

- Name: Sabrina Assistant
- Persona prompt:
  ```
  You are Sabrina's assistant at Franklin Insurance Solutions, a small commercial insurance brokerage in Houston, Texas.
  You help website visitors and social media DMs ask basic questions about cyber insurance, professional liability, and surety bonds.
  Voice: Texan warm but a little less country — friendly, direct, first-person, conversational.
  Never quote a premium. Never make a binding promise. Never collect personal financial information in a chat.
  If asked anything past basic education ("what does this cover?", "how does the process work?"), invite them to book a 15-min discovery call: [insert calendar link].
  Sign your responses simply — don't pretend to be Sabrina herself; you're her assistant.
  Hand off to Sabrina (apply tag `flag:human-needed`) if: confidence is low, or the contact asks for "Sabrina" by name, or they mention an active claim/loss.
  ```
- Knowledge base: seed with FAQ content scraped from Sabrina's Wix site about cyber, pro-liability, surety bonds. (3-5 paragraphs each.)
- Escalation: confidence < 0.6 OR contact asks for "Sabrina" → apply tag `flag:human-needed`.

- [ ] **Step 2: Connect channels**

CreaitOS UI: Conversation AI → Channels:

- Facebook Page: Franklin Insurance Solutions (already connected May 1)
- Instagram Business: Franklin Insurance Solutions (already connected May 1)
- Web chat widget: enable, embed code copied to all funnel pages

- [ ] **Step 3: Test**

From a separate Instagram account (Maurice's personal works), DM the Franklin Insurance Solutions IG account with: "What does cyber insurance cover?"

Expected: response within 60 seconds. Conversational tone. Ends with calendar link.

Repeat with Facebook DM and web chat widget.

Acceptance: all 3 channels respond. Voice matches "Texan warm but a little less country."

---

## Task 20: CreaitOS UI — social planner + weekly newsletter

**Files:** None modified. UI work.

- [ ] **Step 1: Verify social channel connections**

CreaitOS UI: Marketing → Social Planner → Connections.

- Facebook Page: connected ✓ (May 1)
- Instagram Business: connected ✓ (May 1)
- LinkedIn Company: needs Jaylen to accept admin invite (HOMEWORK — verify before this step)

- [ ] **Step 2: Schedule 12 starter posts**

Draft 12 posts (4 weeks × Mon/Wed/Fri). Topics: 4 about cyber insurance education, 4 about pro liability, 4 about surety bonds. Each ~150 words + image. Use the brand colors. Sabrina-voice.

CreaitOS UI: Social Planner → Calendar → Schedule. Cross-post to FB + IG + LinkedIn for each post.

- [ ] **Step 3: Build "Weekly Newsletter Template"**

CreaitOS UI: Marketing → Emails → Templates → New:

- Name: "Franklin Insurance Weekly"
- Layout: 1 hero (industry headline of the week) + 3 short articles + Sabrina sign-off + CTA (book discovery call)
- Footer: standard marketing email footer with unsubscribe + address

- [ ] **Step 4: Build the recurring send workflow**

CreaitOS UI: Automation → Workflows → New → "Weekly Newsletter":

1. Trigger: Schedule → Tuesday 9am CT, every week
2. Filter: contacts with tag = `client` OR contacts with no `unsubscribed-newsletter` tag
3. Send Email: "Franklin Insurance Weekly" template

- [ ] **Step 5: Test the recurring send**

Trigger manually (CreaitOS allows force-run for testing). Confirm test contact receives the email. Confirm it appears in CreaitOS analytics.

Acceptance: 12 posts queued for the next 4 weeks. Newsletter shows next-run = next Tuesday 9am CT.

---

## Task 21: Configure CreaitOS webhooks to fire to the FastAPI server

**Files:** None modified. UI work.

Without this step, the FastAPI server never receives events. This is the linchpin of Phase 1.

- [ ] **Step 1: Open CreaitOS webhook configuration**

CreaitOS UI: Settings → Webhooks → Add Webhook.

- [ ] **Step 2: Configure the webhook**

- URL: `https://<railway-url>/webhook/ghl` (Maurice plugs in actual Railway URL)
- Method: POST
- Events to subscribe to:
  - Form Submitted (or Form Submission)
  - Opportunity Stage Changed
  - Inbound Message (NEW — required for cross-channel reply-stop)
- Auth: none (the FastAPI endpoint accepts any payload; if security is a concern later, add a shared secret in headers)

- [ ] **Step 3: Test each event type**

For each subscribed event:

1. Form Submitted: submit the test form on `/get-quote`. Check Railway logs for `Lead captured` line.
2. Opportunity Stage Changed: in CreaitOS, manually drag a test opportunity from "New Lead" to "Contacted". Check Railway logs for `Stage change for contact`.
3. Inbound Message: have a test contact reply to an email or SMS. Check Railway logs for `Applied flag:reply-stop`.

Acceptance: all 3 event types reach the server, all 3 produce expected log lines, all 3 result in correct GHL tag changes.

---

## Task 22: Phase 1 Gate — End-to-end real-world test

**Files:** None modified. Validation.

The spec's gate condition (Section 3) — Sabrina personally walks through a real-world flow.

- [ ] **Step 1: Sabrina creates a test contact (her personal email + phone)**

Sabrina (with Maurice on screen-share) submits the `/get-quote` form on her live website using her own info.

- [ ] **Step 2: Confirm the welcome touches arrive**

Within 30 seconds: welcome email arrives at Sabrina's inbox.
Within 10 minutes: SMS arrives on Sabrina's phone.

- [ ] **Step 3: Test cross-channel reply-stop**

Sabrina replies "STOP" to the SMS.

Within 1 minute: Sabrina checks CreaitOS → her contact has `flag:reply-stop` tag.
Continues observing for 24 hours: no further nurture touches arrive (email or SMS).

- [ ] **Step 4: Test stage-advance trigger**

Maurice creates a second test contact (his email + phone), submits form.

Maurice manually drags the contact's opportunity to "Contacted" stage in CreaitOS.

Within 1 minute: contact has `campaign-warm` tag, `campaign-cold` tag removed. W2's Day-0 email fires.

- [ ] **Step 5: Test "Quoted" stage**

Maurice drags the same opportunity through "Quote Requested" → "Quoted" stage. (The intermediate "Quote Requested" stage also maps to `campaign-warm`, so the tag should not change between Contacted → Quote Requested.)

Within 1 minute of reaching "Quoted": contact has `campaign-quoted` tag, `campaign-warm` removed. W3's Day-0 email fires (the "Your quote is ready" template).

- [ ] **Step 6: Sabrina states the gate verdict out loud**

After observing the above, Sabrina says either:

- "OK, this isn't going to embarrass me. Proceed to Phase 2." → **Gate passed.**
- "Something feels off about [X]." → **Gate not passed.** Document [X] specifically. Iterate before proceeding.

- [ ] **Step 7: Document the gate result**

Update `/Users/reecebyob/creait/Creait Clients/Sabrina/active/2026-05-05-franklin-build-design.md`'s Decision Log section with:

```markdown
| 2026-MM-DD | Phase 1 gate passed | [Sabrina's verbatim words] |
```

If the gate didn't pass, document the friction and re-iterate.

---

## Self-review

(to be performed after writing the plan, fixing inline)

---

## Definition of Done — Phase 1

All of the following must be true to call Phase 1 complete:

- [ ] All 22 tasks above checked off
- [ ] `pytest -q` is green on `main` branch
- [ ] Railway is deployed with the latest code
- [ ] CreaitOS sub-account has all 28 custom fields, 6 standing tags, 3 pipelines, 1 form, 7-page funnel, 6 workflows, 1 Conversation AI bot, social planner connected, newsletter scheduled
- [ ] DNS at `franklininsurancesolutions.com` points to CreaitOS, A2P registration submitted (approval pending is acceptable)
- [ ] Sabrina has personally tested form → nurture → reply-stop → stage-advance flow and stated the gate verdict
- [ ] `docs/franklin/specs/workflows/messages/` contains drafted copy for every message in W1-W4
- [ ] Decision log updated with gate result
