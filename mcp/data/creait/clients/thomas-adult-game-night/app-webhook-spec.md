# App Webhook Specification (Workflow 5 — App Lobby Capture)

**Audience:** Thomas's app developer.
**Purpose:** Define the webhook payload that the Liquor Store companion app sends to CreateOS so every player who scans into a game lobby becomes a CRM contact.
**Status:** Spec ready. Awaits app developer connection from Thomas.

---

## Why this matters

From Thomas's discovery transcript:
> "Everybody who's playing the game on the app... when they scan that QR code, they enter in that email address. After that, they'll drop into a lobby... When they're playing the game, they rolling the dice, hey pull a card, they pull one of the cards, and it's a QR code, they scan the card... that puts them into a minigame. Photos and videos hit my server. I can send them a recap."

Every player = a captured lead. With even 100 game nights at an average of 5 players each, that's 500 net-new contacts/month flowing into the CRM. This is the highest-leverage data flow in the system.

---

## Webhook URL

**To be obtained:** Track B builds Workflow 5 in the CreateOS UI Workflow Builder. When the trigger type is set to "Inbound Webhook", CreateOS generates a unique URL of the form:

```
https://services.leadconnectorhq.com/hooks/{webhook_id}/webhook-trigger/{trigger_id}
```

After the workflow is created, Maurice captures the URL into `/logs/workflow-5-webhook-url.txt` and sends it to the app developer.

Until the workflow is built, the dev can stub the integration by POSTing test payloads to a Pipedream/Hookdeck URL.

---

## HTTP method

`POST application/json`

No auth required by GHL inbound webhooks (security through URL secrecy). The dev should keep the URL out of client-side code — fire from server-side only.

---

## Payload schema

```json
{
  "event": "player_registered",
  "player": {
    "email": "string (required)",
    "name": "string (optional)",
    "phone": "string (E.164 format, optional)"
  },
  "session": {
    "id": "string — uuid for the game session (required)",
    "host_name": "string — the person who started the game (required)",
    "host_email": "string — host's email if known (optional)",
    "event_type": "birthday | holiday | reunion | corporate | cookout | other (optional)",
    "started_at": "ISO 8601 timestamp (required)"
  },
  "geo": {
    "city": "string (optional)",
    "state": "string (optional, 2-letter)",
    "country": "string (optional, ISO 3166-1 alpha-2, default 'US')"
  },
  "media": {
    "photos": ["url1", "url2"],
    "recap_video_url": "string (optional, sent on session_completed)"
  },
  "events": {
    "type": "player_registered | minigame_played | session_completed",
    "minigame": "bowling | this_or_that | dance_off (optional, only on minigame_played)",
    "score": "number (optional, only on minigame_played)"
  },
  "metadata": {
    "app_version": "string",
    "platform": "ios | android",
    "premium_user": "boolean"
  }
}
```

### Event types

The webhook fires on three event types — all hit the same URL, distinguished by the `event` field:

1. **`player_registered`** — fires when a player scans into the lobby. **This is the most important one.** Creates a CRM contact, tags `source-app-lobby` + `app-player`, attaches host_name, increments `Games Played in App` by 1.
2. **`minigame_played`** — fires after each minigame completes. Optional but useful for engagement scoring.
3. **`session_completed`** — fires when the host ends the game. Includes `recap_video_url`. Triggers the recap email to the host (and optionally to all registered players if their permission allows).

The dev should fire `player_registered` synchronously when the player scans in (don't batch). `session_completed` can fire 5-10 sec after the session ends to give the recap video time to render.

---

## Example payloads

### `player_registered` (the most common event)

```json
{
  "event": "player_registered",
  "player": {
    "email": "kenya.h@example.com",
    "name": "Kenya Holloway"
  },
  "session": {
    "id": "9e1f0b2a-44ce-49ad-b3f8-6c8be9a8b1d2",
    "host_name": "Thomas Gray",
    "host_email": "thomas@adultgamenights.com",
    "event_type": "birthday",
    "started_at": "2026-05-04T20:30:00-04:00"
  },
  "geo": {
    "city": "Atlanta",
    "state": "GA"
  },
  "events": { "type": "player_registered" },
  "metadata": {
    "app_version": "1.2.4",
    "platform": "ios",
    "premium_user": true
  }
}
```

### `session_completed`

```json
{
  "event": "session_completed",
  "session": {
    "id": "9e1f0b2a-44ce-49ad-b3f8-6c8be9a8b1d2",
    "host_name": "Thomas Gray",
    "host_email": "thomas@adultgamenights.com",
    "event_type": "birthday",
    "started_at": "2026-05-04T20:30:00-04:00"
  },
  "media": {
    "recap_video_url": "https://cdn.adultgamenights.com/recaps/9e1f0b2a/full.mp4"
  },
  "events": { "type": "session_completed" }
}
```

---

## CreateOS contact mapping

| Webhook field | CreateOS field |
|---|---|
| `player.email` | Contact email (matched on for upsert) |
| `player.name` | First Name + Last Name (split on first space) |
| `player.phone` | Contact phone |
| `session.host_name` | Custom field "Game Host Name" (Phase 1 ID `X0iYBPOP8a5sPcuCRAJ3`) |
| `session.id` | Custom field "Last Event Attended" (Phase 1 ID `mp3rtXAqBdQ5a8B9QUbD`) |
| `session.event_type` | Custom field "Event Type" (Phase 2 ID `9xcuo49mnWpYZgSkKjPW`) |
| `geo.city` | Standard `contact.city` (don't use the `City (Game Nights)` custom field for this) |
| `geo.state` | Standard `contact.state` |
| `media.recap_video_url` | Stored in CRM Notes (no dedicated custom field; can add one in Phase 9 if useful) |
| Always | Increment custom field "Games Played in App" by 1 (Phase 1 ID `E1XocPQpSl1vqiCB9hxV`) |
| Always | Apply tags: `source-app-lobby`, `app-player` |
| Always | Move opportunity in pipeline `Event Attendees` → stage `Played Game (App Lobby)` (Phase 4) |

If `metadata.premium_user` is `true`, additionally apply the custom field "App Version" = `Premium`. If `false`, set to `Free`.

---

## Error handling

The dev should:
- **Retry on 5xx** with exponential backoff (1s, 5s, 30s — give up after 3 retries)
- **Don't retry on 4xx** (CreateOS rejected the payload — log it and move on)
- **Buffer locally during outages** — if the app can't reach CreateOS, queue events to disk and replay when connectivity returns. Worst case is a delayed contact creation, not a missed one.
- **Log webhook responses** — CreateOS returns the workflow execution ID; useful for debugging.

CreateOS should return `200 OK` within 1-2 sec. If it's consistently slow, ping Maurice — workflow may be misconfigured.

---

## Privacy + consent

The webhook ships the player's email to the CRM. The app must collect explicit consent before sending — Thomas confirmed in transcript:

> "They have a... it's the same permissions they allow when they scan it, they agree to the permissions to allow us to use the camera, um, their camera on their phone. It's the same permissions they kind of agree to when they're doing different stuff, when they scan the QR codes, and using the camera and the microphone."

If the player declines marketing consent (separate from the camera/mic OS permission), the app must **not** fire the webhook. Build a checkbox in the lobby flow:

> ☐ Send me my recap video and updates from Adult Game Nights

Default: unchecked. Only fire the webhook if checked.

---

## Test plan once dev integrates

1. Dev fires test payload with a fake email (e.g., `webhook-test-2026-05@example.com`)
2. Maurice/Thomas verifies in CreateOS:
   - Contact appears within 30 sec
   - Tags applied
   - Custom fields populated correctly
   - Pipeline opportunity created
3. Dev fires the same payload again (with the same email) → verify it's an upsert (no duplicate contact)
4. Dev fires `session_completed` with the recap URL → verify the recap email queues for the host
5. Maurice deletes the test contact

---

## Roadmap (post-Pass 1)

When Thomas's voice samples are processed (Pass 2), the recap email's body gets refreshed to sound like Thomas. The webhook spec doesn't change — only the email template referenced by `Workflow 5` changes.

Future expansions to consider once basic flow is live:
- **Geographic dashboards** — heatmap of where players are scanning in
- **Sponsorship targeting** — flag contacts whose photos show specific brand logos (the AI Thomas mentioned in transcript)
- **Host loyalty scoring** — count sessions per host_name, surface power-hosts to Thomas
- **Multi-player message broadcast** — send "thanks for playing!" to all 5-8 players in a session simultaneously
