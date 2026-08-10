# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two distinct audiences share this codebase.

**Internal (the dashboard, behind Clerk):** CREAiT's four co-founders — Maurice Grant,
John McGhee, Ashaela Bowen, Jaylyn Maddox. They run the company out of this app: EOS
Level 10 meetings, Rocks, To-Dos, the GHL-fed scoreboard, the War Room. They use it at a
desk during a meeting and on a phone immediately after one. John's post-class attendance
check-off is a 30-second job done on a phone.

**External (public routes):** owner-led service businesses, roughly $200K–$5M revenue,
1–50 employees, usually running 3+ disconnected tools. They arrive cold from a link
someone sent them, most often on a phone. They are not technical, they are skeptical of
AI hype, and they typically cannot answer basic questions about their own funnel.

## Product Purpose

CREAiT is an AI consulting agency in Atlanta. The Command Center is its system of record
and, increasingly, the surface its prospects touch first.

CREAiT sells through one offer ladder, and nothing off-ladder gets built or sold:
free weekly Tuesday class → $1,500 Constraint Session → $7,500 Growth & AI Diagnostic
(max 4/month capacity) → Builds $4.5–14K → Advisory $2.5–3.5K/mo → $297/mo volume lane.
Retainers stacking is where the revenue floor comes from.

The Tuesday class ("AI Tuesday — CREAiT Live", Tuesdays 6:00–7:30 PM ET, 90 minutes, on
Zoom) is the top of that ladder. It is free, weekly, and its job is to earn a second
conversation — not to close. Registration exists so GHL owns the reminder cadence and so
show rate becomes a number the founders can see instead of guess.

## Positioning

CREAiT shows its arithmetic. The flagship deliverable (the Executive Blueprint at
`app/assessments/[id]/report`) prints the math beside every figure, says "not examined"
where nothing was examined, discloses evidence confidence per indicator, and
overlap-adjusts portfolio totals rather than summing them. That refusal to overstate is
the position — a competitor selling the same category ships confident round numbers.

The public class page inherits that: an honest description of a free 90-minute working
session, no urgency devices, no invented social proof.

## Operating Context

- **GHL (GoHighLevel)** is the CRM and owns all outbound SMS/email. Location
  `3dmrDLvJkzlWQbzqKFyF` (app.getcreait.com). Tags are the interface between this app and
  GHL automation: this app writes tags, GHL workflows read them and send the messages.
- **Zoom** hosts the class and, via Server-to-Server OAuth, feeds recordings/transcripts
  into the War Room.
- **Supabase** is the database, with RLS keyed on the Clerk `org_id` claim.
- **Inngest** runs crons and background jobs; functions are not auto-registered on deploy.
- Public prospects register from phones; founders mark attendance from phones.

## Capabilities and Constraints

- Dashboard routes live in `app/(dashboard)/` and redirect unauthenticated visitors to
  `/sign-in` at the page/layout level. Public routes simply do not call `auth()`.
- The app shell is hard-committed to dark (`<html class="dark">`, `color-scheme: dark` in
  `globals.css`). A light client-facing surface must pin its own scheme inside its own
  subtree, as the Executive Blueprint does.
- Base UI, not Radix: no `asChild`, use `render={<Component/>}`.
- Registration must never be lost to a third-party failure: if GHL rejects a write, the
  Supabase row still lands and the visitor still sees success.
- Class tags, as of this build: `tuesday-registered` is permanent list membership applied
  once and never removed; `attended-tuesday` and `missed-tuesday` are per-week outcome
  tags that GHL's own workflows remove when their sequence finishes.
- Attendance is tri-state. Unmarked is a real state and must not be tagged as either
  outcome — a half-finished check-off must never text an attendee that we missed them.

## Brand Commitments

- Name is **CREAiT** (lowercase i). Logo at `web/public/logo.svg`.
- Voice: plain, anti-hype, educational, value-first. No marketing superlatives, no
  invented metrics, no urgency theater. Speaks to owners who know they need help and are
  tired of being sold to.
- Client-facing artifacts use the Executive Blueprint's light print palette:
  blue `#0284c7`, ink `#111827`, muted `#5b6675`, hairline `#e4e9f0`, tint `#f4fafd`.
  (Binding constraint, confirmed in the build brief.)
- The internal dashboard keeps its dark brand palette (`--color-brand-*` in globals.css).

## Evidence on Hand

- Real class facts: free, weekly, Tuesdays 6:00 PM Eastern, 90 minutes, on Zoom.
- Real booking link for the next step:
  `https://api.leadconnectorhq.com/widget/booking/UvQUpWdVrhv82iDmMOi4` (15-min fit call).
- Real next-rung offer: the $7,500 Growth & AI Diagnostic, already built and stress-tested.
- **Absent, and must not be fabricated:** attendance counts, testimonials, alumni names,
  past-session topics, seat counts, outcome statistics, logos of attending companies.
  There is no show-rate history at all — measuring it is the reason this build exists.

## Product Principles

1. Show the arithmetic; never state a number the reader cannot check.
2. Never lose a registration to someone else's outage.
3. Tags are contracts with GHL — only write what a human explicitly decided.
4. The free rung sells the next conversation, not the ladder.
5. Both audiences are on phones; the phone is the design target, not the fallback.

## Accessibility & Inclusion

`globals.css` already enforces a visible `:focus-visible` ring and honors
`prefers-reduced-motion`. Public surfaces must keep both, and meet WCAG AA contrast on
their own light ground rather than inheriting the dark shell's ratios.

---

_Facts in this record were confirmed from the repository (CLAUDE.md, globals.css, the
Executive Blueprint report, migrations) and from an explicit written build brief. No
interactive question round was possible in the session that wrote this file; nothing here
was inferred beyond those two sources._
