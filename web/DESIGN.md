---
name: CREAiT Command Center
description: Two deliberate visual worlds — a dark internal app shell, and a light print sheet for everything a client sees.
colors:
  desk: "#eef1f5"
  sheet: "#ffffff"
  ink: "#111827"
  muted: "#5b6675"
  muted-deep: "#3d4653"
  hairline: "#e4e9f0"
  hairline-faint: "#f0f3f7"
  tint: "#f4fafd"
  tint-line: "#bcd9ea"
  accent-mark: "#0284c7"
  accent-text: "#0369a1"
  accent-text-deep: "#075985"
  accent-text-muted: "#3f7191"
  entry-rule: "#94a3b8"
  field-rule: "#64748b"
  write-on-rule: "#cbd5e1"
  danger: "#b91c1c"
  notice-error-bg: "#fdf5f5"
  notice-error-line: "#f1c9c9"
  notice-error-ink: "#8f2020"
  notice-warn-bg: "#fdf9f0"
  notice-warn-line: "#e6d2a8"
  notice-warn-ink: "#6b4e12"
  shell-ink: "#0a0e1a"
  shell-charcoal: "#111827"
  shell-slate: "#1a2235"
  shell-fog: "#2a3447"
  shell-mist: "#94a3b8"
  shell-paper: "#f1f5f9"
  shell-electric: "#3b82f6"
  shell-aqua: "#6ee7b7"
  shell-violet: "#8b5cf6"
  shell-gold: "#f59e0b"
  shell-danger: "#ef4444"
typography:
  display:
    fontFamily: "Inter, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.75rem, 6.4vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.09
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.125rem, 2.7vw, 1.4375rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Inter, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.012em"
  lede:
    fontFamily: "Inter, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.0625rem, 2.3vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.68
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.07em"
  caption:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.09em"
    fontFeature: "tnum"
  micro:
    fontFamily: "Inter, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  square: "0"
  panel: "8px"
  panel-lg: "10px"
  shell: "0.625rem"
spacing:
  hair: "4px"
  micro: "8px"
  para: "14px"
  row: "15px"
  block: "26px"
  field: "34px"
  section: "46px"
  section-lg: "62px"
components:
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "46px 56px 64px"
    width: "46rem"
  row-ruled:
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "15px 0"
  panel-tint:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "22px 24px"
  panel-report:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel-lg}"
    padding: "18px 22px"
  input-underline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "4px 2px 10px"
    height: "46px"
  input-underline-focus:
    backgroundColor: "{colors.tint}"
  textarea-ruled:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 12px 8px"
    height: "136px"
  button-primary:
    backgroundColor: "{colors.accent-text}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.square}"
    padding: "15px 30px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.accent-text-deep}"
  button-primary-disabled:
    backgroundColor: "{colors.accent-text-muted}"
  label-mono:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  label-question:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
---

# Design System: CREAiT Command Center

## Overview

**Creative North Star: "The Working Sheet"**

This project runs two visual worlds on purpose, and conflating them would be the
single worst thing anyone could do to it. Behind Clerk, `app/(dashboard)/**` is a
dark analytics console: Tailwind + Base UI + shadcn-shaped tokens from
`globals.css`, an OLED-leaning near-black ground, electric blue as the one live
colour. In front of Clerk, everything a client ever sees is a **light print
sheet** — a white page laid on a cool grey desk, set in ink and hairlines, built
to survive a browser's print dialog and a cold prospect's phone with equal
composure. The Executive Blueprint (`app/assessments/[id]/report`) established
that world; `/tuesday` inherits it without alteration. They are one system.

The sheet's character is a working document, not a brochure. Its material is the
**ruled line**: a rule under the letterhead, a rule under every row, a rule you
could write an answer on, a rule that doubles as the input field. Nothing floats.
There are no cards inside the sheet — a list is a stack of hairline-separated
rows, and the only filled surfaces are a pale blue tint panel and the sheet
itself. Depth exists exactly once, at the sheet's own edge, as a real offset
shadow that says "paper on a desk". Everything above that plane is flat.

The voice this serves is CREAiT's product commitment: show the arithmetic, never
overstate. So the type is quiet and dense, the accent is rationed, the hierarchy
runs on weight and rule rather than on colour, and the one authored animation on
each surface resolves to the finished document rather than assembling it — a
reader who has motion disabled, or whose browser drops the animation, sees a
complete sheet, never an empty one.

**Key Characteristics:**
- Two pinned worlds: dark app shell, light client sheet; neither leaks into the other.
- White sheet on `#eef1f5` desk; ink `#111827`, muted `#5b6675`, hairline `#e4e9f0`.
- Ruled lines are the recurring material; every list is a row, never a card.
- Square corners and hairline borders on the sheet and on every form control.
- Depth once, at the sheet edge — offset plus blur, never a halo.
- One authored motion moment per surface, whose resting state is the finished page.
- Inter for everything set as prose; Geist Mono, uppercase and letterspaced, for field names and stamps.

## Colors

Two palettes, pinned to two subtrees. The client sheet is a cool neutral print
palette with a single blue that splits into two values by job; the app shell is a
dark console palette whose brand tokens are declared once in `globals.css`.

### Primary

- **Sheet Blue** (`accent-mark`, `#0284c7`): the sheet's accent for **marks, not
  words** — rules, panel borders, the 4px left bar on a highlighted block, the
  focus outline, chart strokes. On white it measures 4.09:1, which is fine for a
  graphical object and not fine for text.
- **Reading Blue** (`accent-text`, `#0369a1`): every blue thing that is *text or
  a filled button* — links, the required-field asterisk, the primary submit
  ground. 5.9:1 on white. `accent-text-deep` `#075985` is its hover;
  `accent-text-muted` `#3f7191` is the disabled submit (4.9:1 against white
  16px/600, chosen because a slow phone sits in the pending state longest).
- **Electric** (`shell-electric`, `#3b82f6`): the dark shell's one live colour —
  primary buttons, the `--ring` focus outline, `chart-1`, the `.glow-electric`
  halo. It never appears on a client-facing sheet.

### Secondary

- **Tint** (`#f4fafd`) with **Tint Line** (`#bcd9ea`): the only filled panel
  inside the sheet — the facts grid, the next-step block, the evidence callout,
  and the background an input takes while focused. It is the system's substitute
  for a card.

### Neutral

- **Ink** (`#111827`): all primary text, the 2px letterhead rule, the 44×2px rule
  under a report section heading. Also the shell's `--card` colour, by
  coincidence rather than by link — do not wire the two together.
- **Muted** (`#5b6675`): secondary prose, mono labels, table headers, captions,
  fine print. `muted-deep` `#3d4653` is the report appendix body, one step darker
  because it runs long.
- **Hairline** (`#e4e9f0`): every separator and default border on the sheet.
  `hairline-faint` `#f0f3f7` is the report's table-row rule, one step lighter so
  a dense table doesn't turn into a grid.
- **Desk** (`#eef1f5`): the ground the sheet sits on, painted onto `html` and
  `body` inside the pinned subtree so no dark edge survives.
- **Entry Rule** (`#94a3b8`) and **Field Rule** (`#64748b`): the two greys the
  ruled lines use — the lighter for a decorative blank the reader cannot fill in,
  the darker for a real input's underline. **Write-on Rule** (`#cbd5e1`) is the
  report's print-only line the owner writes on.
- **Shell neutrals**: `shell-ink` `#0a0e1a` (background), `shell-charcoal`
  `#111827` (cards), `shell-slate` `#1a2235` (muted/secondary/accent),
  `shell-fog` `#2a3447` (borders/inputs), `shell-mist` `#94a3b8` (muted
  foreground), `shell-paper` `#f1f5f9` (foreground).

### Tertiary

- **Status** on the sheet is a bordered strip, never a coloured pill: error
  `#f1c9c9` / `#fdf5f5` / `#8f2020`, warning `#e6d2a8` / `#fdf9f0` / `#6b4e12`,
  inline field error `danger` `#b91c1c`. Each is a border, a near-white ground,
  and a dark ink — the same construction as everything else on the sheet.
- **Chart colours** exist only in the dark shell: `chart-1..5` map to
  `shell-electric`, `shell-aqua` `#6ee7b7`, `shell-violet` `#8b5cf6`,
  `shell-gold` `#f59e0b`, `shell-danger` `#ef4444`.

### Named Rules

**The Two Worlds Rule.** The app shell is hard-committed to dark
(`<html class="dark">` plus `color-scheme: dark`). A client-facing surface does
not fight that globally — it pins its own scheme inside its own subtree with
`html:has(.report-root)` / `html:has(.tuesday-root)`, setting `color-scheme:
light` and painting `html` and `body` with the desk colour. Every new
client-facing surface adds its own `html:has(.<name>-root)` block and lives
inside a root element carrying that class. Never flip the shell.

**The Accent Split Rule.** `#0284c7` is a mark; `#0369a1` is a word. If the blue
thing renders glyphs or fills a button a human clicks, it is `#0369a1`. If it is
a rule, a border, an outline or a chart stroke, it is `#0284c7`. There is no
third blue on a client sheet — the shell's `#3b82f6` is out of bounds here, which
is exactly why `/tuesday` overrides the global focus ring's colour.

**The Rationed Accent Rule.** On a finished sheet the accent appears in single
digits: the focus ring, the required asterisk, one link, one button, one panel
border. Ink and hairline do the hierarchy; colour is not a level.

## Typography

**Display / Body Font:** Inter (`--font-inter`, next/font), with
`-apple-system, "Segoe UI", sans-serif`
**Label / Mono Font:** Geist Mono (`--font-geist-mono`), with
`ui-monospace, SFMono-Regular, monospace`

**Character:** One neutral grotesque doing all the reading, and a monospace used
strictly as *stationery* — small, uppercase, letterspaced, tabular — for field
names, dates, exhibit captions and the colophon. The mono never sets a sentence.
Hierarchy is carried by weight (400 / 500 / 600 / 700 / 800) and by negative
letter-spacing that tightens as size grows.

### Hierarchy

- **Display** (700, `clamp(1.75rem, 6.4vw, 2.75rem)`, lh 1.09, ls −0.03em,
  `text-wrap: balance`): the one page title. The Executive Blueprint, being a
  print deliverable where viewport units are meaningless, sets its equivalents in
  fixed points instead — cover 40/800, success title `clamp(1.375rem, 4vw,
  1.875rem)`/700. Fluid on screen surfaces, fixed on the printed one.
- **Headline** (700–800, `clamp(1.125rem, 2.7vw, 1.4375rem)` on screen / 27px in
  print, lh 1.2–1.25, ls −0.018em): section headings. In the report a headline is
  a **message title** — it states the finding — followed by an optional 14px deck
  and a 44×2px ink rule.
- **Title** (600–700, 1.0625rem / 15–18px, lh 1.35): panel titles, the row key
  column (0.9375rem/600), fact values (1rem/600).
- **Lede** (400, `clamp(1.0625rem, 2.3vw, 1.1875rem)`, lh 1.6, max 34em): the one
  paragraph directly under the display title.
- **Body** (400, 1rem, lh 1.68, `muted`, max 36em): running prose. The report
  runs denser — 13–13.5px at lh 1.7–1.8 — because it is set for paper. Measure is
  always capped: 34em lede, 36em body, 40em fine print, 30ch report headline,
  62ch deck, 64ch letter, 72ch appendix.
- **Label** (Geist Mono, 12px, ls 0.07em, uppercase, `muted`): form field names.
  12px and not 10.5px deliberately — these label the one region a phone user must
  read in order to act, and at caption size they were smaller than their own hint
  text.
- **Caption** (Geist Mono, 10.5–11px, ls 0.05–0.11em, uppercase where it names an
  exhibit, `tabular-nums`): letterhead date, colophon, fact keys, table headers,
  exhibit captions. An exhibit caption names a *different* thing than the text
  under it ("You said" over a quotation); it never restates the heading below.
- **Micro** (400, 0.8125rem, lh 1.55, `muted`): hints, fine print, inline field
  errors (500 weight, `danger`).

### Named Rules

**The CREAiT Rule.** The brand is `CREAiT`, lowercase *i*, and `text-transform:
uppercase` destroys it silently. Uppercasing is allowed on exactly one class of
text: short mono field names and exhibit captions that contain no brand name. The
wordmark is set at its own size and weight, never transformed.

**The 16px Field Rule.** Every text input and textarea is `font-size: 16px`
exactly. Below 16px iOS Safari zooms the viewport on focus, and this form is
filled in on a phone more often than not. This is a floor, not a preference.

**The Tabular Figures Rule.** Anything numeric that can change — dates, counts,
money, ratings, list numbers — carries `font-variant-numeric: tabular-nums`. The
mono classes bake it in; the shell exposes `.tabular-nums` and `[data-numeric]`.

## Layout

**Container.** One centred column. The screen sheet is `max-width: 46rem`; the
print sheet is `max-width: 8.5in` with `@page { size: letter; margin: 0.55in }`.
Both are a single measure — there is no multi-column page grid, and no sidebar.

**Sheet padding.** `26px 20px 40px` on a phone, `46px 56px 64px` from 768px. The
outer desk gutter is `28px 12px 56px`, becoming `64px 24px 96px` from 768px. In
print the sheet drops to `0.2in 0.15in` with the shadow removed and
`break-after: page` on each section.

**Vertical rhythm.** Sections are separated by 46px, 62px from 768px. Inside a
section: heading → 14px → paragraph → 22–26px → the ruled block. Ruled rows are
`15px 0` with a 1px bottom hairline, and the block opens with a 1px top hairline
so the first row is enclosed. Form fields sit 34px apart — deliberately generous,
because in an underline field the rule *is* the input and adjacent fields would
otherwise read as one ruled block.

**Internal grids.** Every two-column arrangement is CSS Grid with a fixed first
column, and every one collapses to a single stacked column below its own
breakpoint:
- ruled row — `15rem 1fr`, gap 24px, from 640px
- ruled blank — `1.6rem 21rem 1fr`, gap 16px, from 600px (a grid, not flex, so
  the number column stays a column when one question is short)
- facts panel — 2 equal columns, gap `18px 32px`, from 560px
- form — 2 equal columns, gap `34px 28px`, from 640px, with a `field-wide`
  modifier spanning `1 / -1`

**Breakpoints** observed in the built world: 560, 600, 640, 768. They are chosen
per component, at the width where that component's own content stops working —
not from a global device scale. Adding a component means finding its breakpoint,
not reaching for 768.

### Named Rules

**The Hairline Row Rule.** A list is a stack of rows separated by 1px `hairline`,
opened by a 1px top hairline. Not cards, not a bordered box per item, not a
bulleted list. Key on the left, value on the right, baseline-aligned, collapsing
to stacked key-over-value on a phone. This is the system's most-repeated pattern
and the thing that makes an unfamiliar section still read as the same document.

**The Capped Measure Rule.** No prose element runs to the container edge. Every
paragraph carries a `max-width` in `em` or `ch`. A paragraph with no measure cap
is a bug.

## Elevation & Depth

The sheet is **flat inside and lifted at its edge**. Exactly one element in the
client world casts a shadow — the sheet itself — and that shadow is a real
offset-plus-blur, never a zero-offset halo. Everything on the sheet gets its
separation from hairlines, from the tint panel, and from whitespace. There are no
hover lifts, no elevated cards, no layered surfaces. In print all shadows are
removed and the page relies on `@page` margins alone.

The dark shell has its own, separate answer: `.glow-electric` — a 1px electric
ring plus a tight outer bloom via `color-mix` — reserved for hero metrics and
primary CTAs on the console. It is a dark-world device and does not belong on a
sheet.

### Shadow Vocabulary

- **Sheet lift** (`box-shadow: 0 1px 2px rgba(17,24,39,0.05), 0 14px 36px -14px
  rgba(17,24,39,0.18)`): the screen sheet on the desk. Two layers — a contact
  shadow and a wide soft cast.
- **Print sheet lift** (`box-shadow: 0 2px 16px rgba(17,24,39,0.12)`): the
  Executive Blueprint's page on screen; removed entirely under `@media print`.
- **Button lift** (`box-shadow: 0 1px 2px rgba(3,105,161,0.28), 0 8px 18px -10px
  rgba(3,105,161,0.55)`): the primary submit only, tinted from its own blue.
  Removed in the disabled state.

### Named Rules

**The Offset Shadow Rule.** A shadow has a y-offset and a blur. A zero-offset,
evenly-spread shadow is a glow, and a glow on a light print sheet is a defect.

**The Flat Interior Rule.** Nothing inside the sheet is elevated. If a block
needs to separate from the prose around it, it gets a hairline border, the tint
ground, or both — never a shadow.

## Shapes

The sheet and every form control are **square** — `border-radius: 0`, stated
explicitly on the input, the textarea, the submit button, and even the focus
ring, because the shell's base ring rounds to 4px and a rounded ring on a page of
square rules reads as a foreign object. The sheet's own edge is a 1px `hairline`
border with no radius.

Inside the Executive Blueprint, **panels carry soft corners**: 8px on smaller
callouts and status strips, 10px on the larger path and evidence blocks. That is
a genuine, load-bearing difference between the two client surfaces — the print
deliverable softens its interior blocks; `/tuesday` does not use a boxed panel
at all except the tint grid, which it leaves square. Use 8/10px only for a
bordered panel inside a report-lineage document; never on a control, and never on
the sheet.

Border weights are a vocabulary of four:
- **1px hairline** — every separator, panel border, sheet edge.
- **1.5px** — an entry rule (`entry-rule`) or an input underline (`field-rule`).
  The rule is the field, so it is heavier than a separator.
- **2px** — the letterhead rule and the 44px stub under a report section
  heading, both in `ink`; also an input underline while focused, in `accent-mark`.
- **4px left bar** — `accent-mark` on the one highlighted evidence block.

### Named Rules

**The Square Control Rule.** Inputs, textareas, buttons and the focus ring are
square, always. A rounded control on this sheet is out of world.

## Components

### Sheet

The page itself. White, 1px `hairline` border, no radius, centred at 46rem
(8.5in in print), lifted by the sheet shadow, `overflow-wrap: anywhere` so a
pasted URL in free text can never push the page sideways. Every client-facing
surface is one sheet; the report is a stack of them, one per printed page.

### Letterhead & Colophon

- **Style:** `display: flex; justify-content: space-between; align-items:
  baseline`, wrapping, with a 2px `ink` bottom border (letterhead) or a 1px
  `hairline` top border (colophon).
- **Content:** wordmark at 15px/700/−0.01em on the left; a mono 11px `muted`
  tabular string on the right. The colophon repeats the same pair in mono.

### Ruled Row

- **Style:** grid, `15rem 1fr` from 640px, 24px gap, baseline-aligned, `15px 0`
  padding, 1px `hairline` bottom border; the containing block adds a 1px top
  border.
- **Type:** key 0.9375rem/600 in `ink`; value 0.9375rem/1.62 in `muted`.
- **Behavior:** below 640px it stacks with a 4px gap. This is the replacement for
  every card grid, feature list and timeline in the system.

### Ruled Blank (signature)

The `/tuesday` page's defining component: a numbered question whose answer is a
rule the reader cannot fill in.

- **Structure:** grid `1.6rem 21rem 1fr` from 600px (`1.6rem 1fr` stacked below),
  so the number column stays a column and every answer rule starts at the same x.
- **Parts:** mono 11px `muted` ordinal; 1rem/500 question; a zero-height span
  with a 1.5px `entry-rule` bottom border, `transform-origin: left center`,
  bottom-aligned with a 4px offset.
- **Motion:** each rule draws itself left to right on load (see Motion).

### Facts Panel / Next-Step Panel

- **Style:** `tint` ground, 1px `tint-line` border, square, 18px padding rising to
  `22px 24px`; a 2-column grid from 560px for facts, single column for next-step.
- **Type:** mono uppercase 10.5px `caption` key over a 1rem/600 value; the
  next-step variant uses a 1.0625rem/700 title over 0.9375rem/1.65 `muted` body.

### Inputs / Fields

- **Underline input:** transparent ground, no border except a 1.5px `field-rule`
  bottom, square, `padding: 4px 2px 10px`, `min-height: 46px`, 16px text. The gap
  under the label (7px) is deliberately tighter than the gap to the field above
  (34px) — in an underline field the rule is the input, so the label must bind
  downward.
- **Hover:** underline goes `ink`. **Focus:** underline goes `accent-mark` and
  2px, ground goes `tint`. **Error:** underline goes `danger`, with a 0.8125rem
  `danger` message wired through `aria-describedby`.
- **Ruled textarea:** the worksheet answer box. 1px `field-rule` border, square,
  `line-height: 32px` matched exactly to a 32px `repeating-linear-gradient` period
  in `hairline`, with `background-attachment: local` so the rules scroll with the
  text. Text sits *on* the rules. 136px min-height, vertical resize only.
- **Labels:** mono uppercase 12px `muted` for field names; for the one question
  the class is actually built on, a real question typography instead —
  1rem/600 `ink`. A sentence set in uppercase mono is a wall nobody reads.
- **Focus ring:** `outline-color: var(--tc-accent); border-radius: 0` scoped to
  the light root, overriding the shell's 2px `#3b82f6` at 4px radius. The shell's
  2px width and 2px offset are kept.

### Buttons

- **Shape:** square (0), full-width on a phone, auto width from 640px.
- **Primary:** `accent-text` ground, white 1rem/600 text, `15px 30px` padding,
  52px min-height, button lift shadow.
- **Hover:** `accent-text-deep`. **Active:** `translateY(1px)` over 120ms.
  **Disabled:** `accent-text-muted`, no shadow, `cursor: progress`.
- There is no secondary or ghost button in the built system. A secondary action is
  a link: `accent-text`, 600, underlined at 1px with a 3px offset, darkening to
  `accent-text-deep` on hover.

### Notice Strips

Inline, full-width, square, 1px border + near-white ground + dark ink, `12–16px`
padding, 0.9375rem/1.5 text, placed in the flow at the point of consequence
(never as a floating toast). Error and warning variants only; the error strip
spans `1 / -1` in the form grid and carries `role="alert"`.

### Report Section Heading

- **Style:** a message-titled `h2` at 27px/800/−0.022em capped to 30ch, an
  optional 14px `muted` deck capped to 62ch, then a 44×2px `ink` rule 16px below.
- **Behavior:** no kicker. An eyebrow above a heading restates the heading in
  smaller type, and this system refuses it by construction.

## Do's and Don'ts

### Do:

- **Do** pin every new client-facing surface into the light world with its own
  `html:has(.<name>-root)` block setting `color-scheme: light` and the `#eef1f5`
  desk on both `html` and `body`, exactly as `.report-root` and `.tuesday-root` do.
- **Do** split the blue by job: `#0284c7` for rules, borders, outlines and chart
  strokes; `#0369a1` for any blue text or filled button.
- **Do** build every list as hairline-separated rows (`15px 0`, 1px `#e4e9f0`),
  and open the block with a top hairline.
- **Do** keep inputs at exactly `font-size: 16px` and give them 46px+ of height
  and 34px of separation from their neighbours.
- **Do** cap every prose block with a `max-width` in `em`/`ch` (34em lede, 36em
  body, 40em fine print).
- **Do** author animation so the keyframe supplies only a `from` — the resting
  state must be the finished element.
- **Do** ship the light world's colours as a static CSS string inside the route
  that owns them, hoisted via `<style href="…" precedence="high">` so it lands in
  `<head>` and a cold phone never flashes the dark shell.
- **Do** use `tabular-nums` on every figure that can change.

### Don't:

- **Don't** put the dark shell's `#3b82f6`, `.glow-electric`, or any shadcn
  surface token on a client-facing sheet; and don't flip the shell to light to
  make a light surface easier.
- **Don't** set `#0284c7` as text, and don't introduce a third blue.
- **Don't** wrap sheet content in a card, a bordered box per item, or anything
  with a shadow — depth exists once, at the sheet's edge.
- **Don't** use a zero-offset shadow anywhere; a shadow has a y-offset and a blur.
- **Don't** round a control. Inputs, textareas, buttons and the focus ring are 0.
  The 8/10px radii belong only to bordered panels inside a report-lineage page.
- **Don't** `text-transform: uppercase` anything that could contain "CREAiT", and
  don't set a sentence in uppercase mono — mono uppercase is for short field
  names, exhibit captions and stamps.
- **Don't** add a kicker or eyebrow above a heading.
- **Don't** animate anything a second time on a surface: one authored moment per
  page, gated behind `prefers-reduced-motion: no-preference`, and killed outright
  under `@media print`.
- **Don't** put a status message in a floating toast on a client sheet; it goes
  inline, in the flow, where the consequence is.

---

## Motion

Motion is documented here rather than as a token group because the schema has no
place for it and because it is a policy, not a scale.

**One authored moment per surface.** `/tuesday` has exactly one: the three
answer rules draw themselves left to right — `tc-draw`, `scaleX(0)` → identity,
760ms `cubic-bezier(0.16, 1, 0.3, 1)`, `both`, staggered by a per-element
`--d` of `140 + i × 130`ms. The Executive Blueprint has one entrance vocabulary
for its exhibits — `rp-grow-x` (820ms), `rp-fade` (460ms), `rp-seg` (520ms),
`rp-needle` (1000ms at 300ms), `rp-rise` (620ms) — all on
`cubic-bezier(0.22, 1, 0.36, 1)` with a `--d` delay.

**The Resting State Rule.** Every keyframe supplies only a `from`. The element's
declared state *is* its finished state, so a reduced-motion user, a print run, or
an engine that drops the animation all land on a complete, correct sheet rather
than an empty one. This is why the animations are additive `from`-only and never
`opacity: 0` in the base rule.

**Gating.** Every animation block is wrapped in `@media (prefers-reduced-motion:
no-preference)` — the report adds `screen and` — and the report additionally
forces `animation: none !important; opacity: 1 !important; transform: none
!important` under `@media print`. The shell's global `prefers-reduced-motion:
reduce` block in `globals.css` is a backstop, not the primary defence.

**State transitions** are short and property-scoped: `140ms ease` on
`border-color` and `background-color` for inputs, `140ms ease` on
`background-color` plus `120ms ease` on `transform` for the submit. No transition
runs longer than 140ms, and none is declared on `all`.

**Programmatic scrolling** uses `behavior: "auto"`, never `"smooth"` — the jump
to a validation error or to the success state is a correction, not an effect, and
carries `scroll-margin-top: 28px` so the target never pins to y=0 with nothing
above it.
