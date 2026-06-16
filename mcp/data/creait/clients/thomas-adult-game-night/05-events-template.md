# Landing Page Template: `/events/[event-name]`

**Form embed:** Form 3 — Event Registration (with Event Selection pre-set)
**Status:** SPEC ONLY (build in UI as a template, duplicate per event).

---

## Dynamic merge variables
- `{{event_name}}` — e.g., "Russell Center Game Night"
- `{{event_date}}` — e.g., "July 3, 2026"
- `{{event_location}}` — e.g., "Russell Center, Atlanta"
- `{{event_time}}` — e.g., "7:00 PM"
- `{{event_description}}` — short paragraph

## Hero
- **Headline:** {{event_name}}
- **Subhead:** {{event_date}} • {{event_location}} • {{event_time}}
- **Primary CTA:** Register Free → (anchor to form)
- **Background:** Event-specific photo or graphic

## Event Details
- 📅 **When:** {{event_date}} at {{event_time}}
- 📍 **Where:** {{event_location}} (with embedded map)
- 🎲 **What to expect:** {{event_description}}
- 👕 **Dress code:** Casual + comfortable
- 🎁 **Bring:** Just yourself + a phone for the app
- 🅿️ **Parking:** Free on-site

## Embedded Form
Form 3 at `#register`. Pre-select Event Selection dropdown using URL param `?event={{event_id}}` so the dropdown defaults correctly.

## Map Embed
Google Maps iframe at the event address.

## FAQ (event-level)
1. **Is there a cost?** — Most events are free. Premium events are noted in the headline.
2. **Can I bring a guest?** — Yes — register them separately so we can prep their seat.
3. **What if I can't make it?** — No worries. Reply to the confirmation email if your plans change.
4. **Will there be food/drinks?** — Varies by event — see {{event_description}}.

## CTA Footer
- Big "Register Free" button → scroll to form
- 📞 478-654-9574 / ✉️ adultgamenights@gmail.com

---

## Inaugural instance: `/events/russell-center-july-3`
First event to build using this template.

| Variable | Value |
|---|---|
| event_name | Adult Game Nights @ Russell Center |
| event_date | July 3, 2026 |
| event_location | Russell Center for Innovation & Entrepreneurship, Atlanta |
| event_time | 7:00 PM – 11:00 PM |
| event_description | Live game night experience: 5 adult games, prize giveaways, full bar, photographer, and a few surprises. |

**Note:** July 3, 2026 is already blocked on the booking calendar (no service bookings allowed) since Thomas is at this event.

---

**Tracking:** `utm_campaign=event-{{event_slug}}`. Form auto-tags `source-event`.
