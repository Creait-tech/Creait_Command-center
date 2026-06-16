# GHL API Quirks & Notes — Adult Game Nights Build

Discovered during Phase 1 (2026-05-04). Use this as a reference when building Phases 2-8.

## Authentication

**Token type used:** Private Integration Token (PIT) — location-scoped.

```
Authorization: Bearer pit-...
Version: 2021-07-28
Content-Type: application/json
Accept: application/json
```

### Confirmed PIT scopes (location-level)

| Resource | Read | Write |
|----------|------|-------|
| `/locations/{id}` | ✅ | ❌ 401 |
| `/locations/{id}/customFields` | ✅ | ✅ |
| `/locations/{id}/tags` | ✅ | ✅ |
| `/calendars` | ✅ | ✅ |
| `/calendars/events/block-slots` | n/a | ✅ |
| `/contacts` | ✅ | ✅ (assumed) |
| `/opportunities/pipelines` | ✅ | ❌ 401 |

For agency-level operations (location updates, pipelines), an Agency OAuth token is required.

---

## Custom Fields — `POST /locations/{id}/customFields`

### SINGLE_OPTIONS payload

✅ **Correct:** options as plain strings:
```json
{
  "name": "Service Tier",
  "dataType": "SINGLE_OPTIONS",
  "model": "contact",
  "options": ["Drop-off", "Host", "Premium"]
}
```

❌ **Wrong (returns `400 v.trim is not a function`):**
```json
{ "options": [{"name": "A", "value": "A"}] }
```

### Reserved standard-field names

You **cannot** create custom fields with names that match standard contact fields:
- `City`, `State`, `Country`, `Postal Code`, `Email`, `Phone`, `First Name`, `Last Name`, `Address`, …

Returns `400` with explicit message. **Workaround:** add a qualifier — e.g. `City (Game Nights)` or `Service City`.

### Data types

`TEXT`, `LARGE_TEXT`, `NUMERICAL`, `MONETORY` (yes, the API really spells it that way), `DATE`, `SINGLE_OPTIONS`, `MULTIPLE_OPTIONS`, `CHECKBOX`, `RADIO`, `FILE_UPLOAD`.

---

## Tags — `POST /locations/{id}/tags`

Direct CRUD works. Idempotent: re-creating returns the same tag without error in some cases, but our script checks for existing-by-name first.

```json
POST /locations/{id}/tags
{ "name": "buyer" }
```

Returns `{ "tag": { "id": "...", "name": "buyer", "locationId": "..." } }`.

**Delete:** `DELETE /locations/{id}/tags/{tagId}`.

---

## Calendars — `POST /calendars/`

### openHours: one day per entry

❌ **Wrong (returns 422 "must be a valid day of week"):**
```json
{ "daysOfTheWeek": [1, 2, 3, 4, 5], "hours": [...] }
```

✅ **Correct:** expand into one entry per day:
```json
[
  { "daysOfTheWeek": [1], "hours": [{"openHour": 9, "openMinute": 0, "closeHour": 17, "closeMinute": 0}] },
  { "daysOfTheWeek": [2], "hours": [{"openHour": 9, "openMinute": 0, "closeHour": 17, "closeMinute": 0}] }
]
```

Day numbers: `1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun` (matches existing personal calendar in account).

### Required fields for create

```json
{
  "locationId": "<id>",
  "name": "...",
  "slug": "...",                    // URL-safe, must be unique
  "calendarType": "event",
  "eventType": "RoundRobin_OptimizeForAvailability",
  "teamMembers": [{"userId": "...", "priority": 0.5, "selected": true}],
  "slotDuration": 30, "slotDurationUnit": "mins",
  "slotInterval": 30, "slotIntervalUnit": "mins",
  "slotBuffer": 0,
  "openHours": [...]                // one day per entry, see above
}
```

### Blocking out a day

`POST /calendars/events/block-slots`:
```json
{
  "calendarId": "<id>",
  "locationId": "<id>",
  "startTime": "2026-07-03T00:00:00-04:00",
  "endTime":   "2026-07-03T23:59:59-04:00",
  "title": "Russell Center event"
}
```

Verify via `GET /calendars/blocked-slots?locationId=<id>&calendarId=<id>&startTime=<ms>&endTime=<ms>` (note: timestamps as **milliseconds**).

---

## Pipelines — Blocked

`POST /opportunities/pipelines` returns `401 The token is not authorized for this scope.` for PITs. Tested also at `/opportunities/pipelines/`, `/locations/{id}/pipelines`, `/pipelines` — none work.

GET works. So a workflow can read pipeline IDs and move opportunities through stages, but the pipelines themselves must be created via the UI or an Agency OAuth key.

---

## Rate Limiting

Not encountered during Phase 1 (~80 requests total, low volume). Our `api-client.js` retries with exponential backoff (2s → 4s → 8s) on 429 and 5xx.

---

## Forms / Funnels / Pages — Not API-Supported

`POST /forms/` and `POST /funnels/page` both return:
> `401 — This route is not yet supported by the IAM Service. Please update your IAM config.`

This is platform-wide, NOT scope-specific. Forms and landing pages must be built in the CreateOS UI. `funnels.readonly` and `funnels/page.readonly` work for read-side operations.

Form spec → [`/config/forms.json`](../config/forms.json) + [`/docs/forms-manual-build-guide.md`](forms-manual-build-guide.md)
Landing page specs → [`/landing-pages/`](../landing-pages/)

---

## Email Templates — `POST /emails/builder` (creates stub only)

✅ POST works to create a named template stub:
```json
{ "locationId": "...", "title": "Welcome Email", "type": "blank" }
```

`type` must be one of: `html, folder, import, builder, blank, ai_template`.
- `import` requires `importProvider` (mailchimp, active_campaign) and `importURL` — not useful for raw HTML.
- `blank` works fine — just creates the empty template.

❌ **Body content cannot be set via API.** Tested:
- POST with `html`, `editorType`, `subject`, `previewText` fields → silently ignored
- PUT `/emails/builder/{id}` → 404
- PUT `/emails/builder/{locationId}/{id}` → 404
- PATCH any path → 404

Workaround: Generate HTML body files alongside stubs (saved to `/email-templates/<name>.html`) and manually paste in CreateOS UI builder.

✅ DELETE works at `/emails/builder/{locationId}/{templateId}` (locationId in path, not query).
✅ GET list at `/emails/builder?locationId={id}&limit=N` returns `{builders: [{id, name, previewUrl, ...}]}`.

---

## SMS Templates / Snippets — Not Available to PIT

`POST /locations/{id}/templates` returns 401 with PIT. `GET` works (returns empty in fresh accounts). Build snippets in CreateOS UI under Settings → Snippets.

---

## Useful Discovered Endpoints

| Method | Path | Use |
|--------|------|-----|
| GET | `/locations/{id}` | Read location info |
| PUT | `/locations/{id}` | Update location *(agency scope)* |
| GET | `/locations/{id}/customFields` | List custom fields |
| POST | `/locations/{id}/customFields` | Create custom field |
| GET | `/locations/{id}/tags` | List tags |
| POST | `/locations/{id}/tags` | Create tag |
| DELETE | `/locations/{id}/tags/{tagId}` | Delete tag |
| GET | `/calendars/?locationId={id}` | List calendars |
| POST | `/calendars/` | Create calendar |
| DELETE | `/calendars/{id}` | Delete calendar |
| GET | `/calendars/{id}` | Get calendar detail |
| POST | `/calendars/events/block-slots` | Block out time |
| GET | `/calendars/blocked-slots` | List blockouts |
| GET | `/opportunities/pipelines?locationId={id}` | List pipelines (read only with PIT) |
| GET | `/contacts/?locationId={id}` | List contacts |
| GET | `/forms/?locationId={id}` | List forms (read-only) |
| POST | `/forms/` | Create form *(IAM not yet supported)* |
| GET | `/emails/builder?locationId={id}&limit=N` | List email templates |
| POST | `/emails/builder` | Create email template stub (no body content) |
| DELETE | `/emails/builder/{locationId}/{id}` | Delete email template |
| GET | `/funnels/funnel/list?locationId={id}` | List funnels |
| GET | `/locations/{id}/templates` | List templates (SMS, etc) |
| POST | `/locations/{id}/templates` | Create template *(PIT not authorized)* |
| GET | `/knowledge-bases/?locationId={id}` | List KBs |
| POST | `/knowledge-bases/` | Create KB |
| GET | `/knowledge-bases/{kbId}?locationId={id}` | Read KB metadata |
| DELETE | `/knowledge-bases/{kbId}?locationId={id}` | Delete KB |
| POST | `/knowledge-bases/faqs/` | **Create FAQ** (only API-routable KB content type) |
| GET | `/knowledge-bases/faqs/?locationId={id}&knowledgeBaseId={kbId}` | List FAQs in a KB |
| DELETE | `/knowledge-bases/faqs/{faqId}?locationId={id}` | Delete FAQ |
| POST | `/knowledge-bases/rich-texts/` | ❌ 404 — not exposed |
| POST | `/knowledge-bases/urls/` | ❌ 404 — not exposed |
| POST | `/knowledge-bases/files/` | 🟡 multipart upload (deferred) |
| GET | `/voice-ai-agents/` | ❌ 404 — UI only |
| GET | `/conversation-ai/` | ❌ 404 — UI only |
| GET | `/agent-studio/` | ❌ 404 — UI only |
| GET | `/reviews/` | ❌ 404 — UI only |
| GET | `/phone-numbers/` | ❌ 404 — UI only |
