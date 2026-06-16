# Calendars — 2 calendars

**GHL Path:** Calendars → Calendar Settings → + New Calendar

Both calendars are personal (1-on-1 with Dustin). Team calendars are deferred until the assistant takes measurement-only appointments later.

---

## Calendar 1 — Private Style Consultation

| Setting | Value |
|---|---|
| Calendar Type | Personal Booking (1-on-1) |
| Calendar Name | Private Style Consultation |
| Slug (URL) | `/private-consultation` |
| Duration | 90 minutes |
| Availability | Tuesday–Saturday, 10:00 AM – 6:00 PM |
| Buffer Before | 30 minutes |
| Buffer After | 30 minutes |
| Minimum Notice | 24 hours |
| Max Bookings / Day | 3 |
| Max Bookings / Slot | 1 |
| Time Zone | Dustin's local TZ (confirm in Phase 1 Day 1) |
| Event Title | "Private Style Consultation — {{contact.first_name}}" |
| Meeting Location | Studio (physical address from custom value) |
| Form | Bespoke Inquiry form (short version — see file 06) |
| Confirmation Email | Enabled — use WF2 email copy |
| Google/Outlook Sync | Enabled — two-way sync |
| Booking Page Description | "Your private consultation with Dustin — we'll discuss your vision, explore fabrics, and take initial measurements. Complimentary, no obligation." |

**Booking widget settings:**
- Show "Powered by" footer: OFF (luxury)
- Primary color: match Dustin's brand (pull from logo — confirm hex)
- Allow reschedule: YES (calendar link in confirmation email)
- Allow cancel: YES (with 24hr minimum; under 24hr routes to personal note)

---

## Calendar 2 — Fitting Appointment

| Setting | Value |
|---|---|
| Calendar Type | Personal Booking (1-on-1) |
| Calendar Name | Fitting Appointment |
| Slug (URL) | `/fitting` |
| Duration | 60 minutes |
| Availability | Monday–Saturday, 10:00 AM – 5:00 PM |
| Buffer Before | 15 minutes |
| Buffer After | 15 minutes |
| Minimum Notice | 48 hours |
| Max Bookings / Day | 4 |
| Max Bookings / Slot | 1 |
| Time Zone | Same as Consultation |
| Event Title | "Fitting — {{contact.first_name}} ({{custom_fields.fabric_selected}})" |
| Meeting Location | Studio |
| Confirmation Email | Enabled — simpler than consult, just logistics |
| Booking Page Description | "Your fitting appointment — we'll try the garment, refine the silhouette, and walk through any adjustments needed before final delivery." |

**Access control:** Fitting calendar is NOT public. Only clients with pipeline stage ≥ 7 (In Production) can access the booking link. Dustin/assistant sends it manually or triggers via workflow.

---

## Reminder configuration (both calendars)

GHL Path: Calendar Settings → {Calendar} → Notifications

| Reminder | Timing | Channel | Copy source |
|---|---|---|---|
| Confirmation | Instant on booking | SMS + Email | WF2 (consult) or WF-fitting equivalent |
| 24-hour reminder | 24h before start | SMS | WF2 24hr template |
| 2-hour reminder | 2h before start | SMS | WF2 2hr template |
| Reschedule link | Embedded in all reminders | — | — |

---

## Questions to confirm with Dustin on Day 1

1. **Time zone** — studio location TZ for the account
2. **Studio address** — used in confirmation email and event title
3. **Brand color hex** — for booking widget
4. **Monday availability** — consult calendar is Tue–Sat by default (closed Sundays, closed Mondays for admin). Confirm.
5. **Buffer preference** — 30 min is generous. Confirm he wants the breathing room.
