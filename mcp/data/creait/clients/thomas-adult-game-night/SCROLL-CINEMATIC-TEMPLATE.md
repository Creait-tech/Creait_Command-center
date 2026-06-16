# Scroll-Driven Cinematic Landing — Reusable Prompt Template

**What this is:** A drop-in template for building scroll-driven cinematic landing pages for ANY brand. Fill in the placeholders, paste into Claude Design / Cursor / Codex / Lovable / any AI design tool, get a working site.

**Pattern source:** Restructured from [vishnuai.in/animated-website-guide](https://vishnuai.in/animated-website-guide). The scroll-scrub `video.seeking` guard is the technical trick that makes it actually work without frame tearing.

**Use this for:**
- Product launches (single hero product, cinematic story)
- Brand reveal sites (founder bio, brand-led narrative)
- Event landing pages (festival, concert, launch party)
- High-touch portfolios (designers, directors, artists)
- App pre-launch pages

---

## 🧭 STEP 0 — Fill out this brief BEFORE pasting the prompt

Write down YOUR answers to each line. The fewer you skip, the better the AI output.

```yaml
# === BRAND IDENTITY ===
brand_name:             # e.g. "Adult Game Nights"
brand_short_name:       # e.g. "AGN" — used in nav + small spots
brand_one_liner:        # e.g. "Atlanta-born culture-led drinking card game"
brand_location:         # e.g. "Atlanta", "Los Angeles", "Brooklyn"
brand_age_gate:         # e.g. "21+", "18+", "all ages"

# === HERO PRODUCT / OFFER ===
hero_product:           # e.g. "The Liquor Store Board Game"
hero_price:             # e.g. "$34.04"
hero_cta_primary:       # e.g. "COP THE GAME · $34.04"
hero_cta_primary_url:   # e.g. "https://adultgamenights.com"
hero_cta_secondary:     # e.g. "BOOK A GAME NIGHT 🎲"
hero_cta_secondary_url: # e.g. "https://agn.getcreait.com/book-game-night"
hero_headline:          # 2-4 words, all caps. e.g. "WELCOME TO THE FUNCTION"
hero_kicker:            # tiny label above headline. e.g. "AGN · ATLANTA · 21+"
hero_subhead:           # one sentence under headline. e.g. "The drinking card game that built itself off TikTok. Pull up."

# === CINEMATIC VIDEO ===
video_url:              # publicly hosted .mp4 (CORS-open). e.g. "/hero-frozen.mp4"
video_concept:          # what the cinematic shows. e.g. "Atlanta rooftop game night frozen mid-chaos"
video_camera_move:      # e.g. "180° orbital pan around the players at constant height"

# === BRAND COLORS (hex) ===
color_primary:          # main accent. e.g. "#E8242C" (AGN red)
color_secondary:        # second accent. e.g. "#FFD23F" (AGN yellow)
color_ink:              # text + borders. e.g. "#1A0A0A" (deep wine-black)
color_cream:            # background-tinted neutral. e.g. "#FFF8E7"
color_white:            # pure white. usually "#FFFFFF"

# === FONTS (Google Fonts names) ===
font_display:           # bold display headlines. e.g. "Luckiest Guy"
font_display_2:         # kickers / small caps. e.g. "Bangers"
font_body:              # body text. e.g. "Manrope" or "Inter"

# === SECTION 2: 3-TILE GRID ===
tile_1_kicker:          # e.g. "THE PRODUCT"
tile_1_title:           # e.g. "The Liquor Store Game"
tile_1_copy:            # 1-2 sentences

tile_2_kicker:          # e.g. "THE SERVICE"
tile_2_title:           # e.g. "In-Home Game Nights"
tile_2_copy:            # 1-2 sentences

tile_3_kicker:          # e.g. "THE CULTURE"
tile_3_title:           # e.g. "Atlanta-Born, 21+"
tile_3_copy:            # 1-2 sentences

# === SECTION 3: FOOTER NEWSLETTER ===
newsletter_headline:    # e.g. "Ready to pull up to the next drop?"
newsletter_sub:         # e.g. "Join the AGN list. First dibs on drops + codes."
newsletter_cta_label:   # e.g. "LOCK ME IN"

# === FOOTER COLUMNS ===
shop_links:             # array: [{label, url}, ...]
experience_links:       # array
social_links:           # IG / TikTok / YouTube / etc.
business_email:         # e.g. "info@adultgamenights.com"
business_phone:         # e.g. "478-654-9574"

# === HEADER NAV (5 links + 1 CTA) ===
nav_links:              # e.g. ["THE GAME", "BOOK", "EVENTS", "SPONSOR", "STORE"]
header_cta_label:       # e.g. "COP THE GAME"
header_cta_url:         # e.g. "https://adultgamenights.com"

# === BRAND VOICE ===
voice_words_use:        # e.g. "Yo, Bet, Pull up, Lock in, 🎲"
voice_words_avoid:      # e.g. "Hello, Best regards, How may I help"
voice_tone:             # one sentence. e.g. "Hype DJ-host, Atlanta-rooted, irreverent"
```

---

## 🎬 STEP 1 — THE PROMPT (paste this block into Claude Design / Cursor / Codex)

Copy everything below this line, then **find-and-replace every `{{PLACEHOLDER}}` with your value from Step 0**.

---

Create a React + Vite + Tailwind CSS v4 landing page for **"{{brand_name}}"** — {{brand_one_liner}}. The page has a scroll-driven cinematic video background ({{video_concept}}), 3 content sections, and a glassmorphism footer. Use ONLY these dependencies: react 19, motion (framer-motion v12+), gsap, lucide-react, tailwindcss v4 with @tailwindcss/vite plugin. The design is dark cinematic with **{{color_primary}}/{{color_secondary}}/{{color_cream}}** as the accent palette. Use **{{font_display}}** (display headings), **{{font_display_2}}** (display kickers), and **{{font_body}}** (body/sans) fonts.

## GLOBAL SETUP

package.json dependencies (exact):
- react, react-dom ^19.0.0
- motion ^12.23.24
- gsap ^3.14.2
- lucide-react ^0.546.0
- tailwindcss ^4.1.14
- @tailwindcss/vite ^4.1.14
- @vitejs/plugin-react ^5.0.4
- vite ^6.2.0

vite.config.ts: Use @tailwindcss/vite + @vitejs/plugin-react. Alias `@` to project root.

index.html: Standard HTML5 with `<meta name="theme-color" content="{{color_ink}}">`. Favicon. Title: "{{brand_name}} — {{hero_product}}". OG image set to a still frame of the cinematic video.

src/index.css — EXACT:
```css
@import url('https://fonts.googleapis.com/css2?family={{font_display_url}}&family={{font_display_2_url}}&family={{font_body_url}}:wght@300;400;500;600;700;800&display=swap');
@import "tailwindcss";

@theme {
  --font-display: "{{font_display}}", Impact, sans-serif;
  --font-display-2: "{{font_display_2}}", Impact, sans-serif;
  --font-sans: "{{font_body}}", ui-sans-serif, system-ui, sans-serif;

  --color-brand-primary:    {{color_primary}};
  --color-brand-secondary:  {{color_secondary}};
  --color-brand-ink:        {{color_ink}};
  --color-brand-cream:      {{color_cream}};
}
```

Define keyframe animations: `flyOutRight / flyInLeft` (250% translateX, 0.5s) for arrow button hover, and `flyOutUp / flyInUp` (150% translateY, 0.4s) for nav text hover. All use `cubic-bezier(0.4, 0, 0.2, 1)` easing with `forwards` fill mode.

## COMPONENT: ScrollReveal
A GSAP-powered word-by-word scroll reveal component with three ScrollTrigger animations (rotation from baseRotation to 0, opacity from baseOpacity to 1 with 0.05 stagger, blur from blurStrength to 0px). Use the display font with text-shadow + text-stroke for a brutalist visual punch.

## COMPONENT: Reveal
A motion.div wrapper for viewport-triggered fade-in with easing `[0.16, 1, 0.3, 1]`.

## COMPONENT: NavItem
Hover-animated navigation link with vertical text fly animation using a cycle counter pattern. Render labels in the display-2 font at small caps with 0.2em letter-spacing. Default color cream; on hover swap to primary accent.

## MAIN APP ARCHITECTURE

- Video URL constant — `{{video_url}}` ({{video_concept}} — camera does {{video_camera_move}}).
- State: arrowCycle, videoRef, videoContainerRef, isLoaded, screen3Ref.
- scrollY from motion's `useScroll()`; `headerY = useTransform(scrollY, [0, 500, 800], [0, 0, -150])`.

## SCROLL-DRIVEN VIDEO — CRITICAL (do not modify this section)

Use a `video.seeking` guard inside the scroll handler. Without it, rapid scroll events queue up competing `currentTime` assignments causing visible frame tearing. Map scroll fraction from 0 (top) to 1 (when footer is 20% of viewport from top).

```jsx
const onScroll = () => {
  if (video.seeking) return;  // CRITICAL
  const rect = container.getBoundingClientRect();
  const winH = window.innerHeight;
  const fraction = Math.max(0, Math.min(1, -rect.top / (rect.height - winH)));
  if (video.duration) video.currentTime = fraction * video.duration;
};
```

**Mobile-critical additions** (these prevent iOS Safari + URL-bar issues):
- Add `playsInline`, `webkit-playsinline="true"`, `muted`, `defaultMuted`, `disableRemotePlayback` to the `<video>` element.
- On first `touchstart` / `scroll` / `click` (whichever fires first), call `video.play()` then immediately `video.pause()`. This unlocks programmatic `currentTime` seeking on iOS Safari, which is blocked until the video is user-activated.
- Cache `window.innerHeight` once at mount, recalc only on `resize` + `orientationchange`. iOS Safari's `innerHeight` jitters as the URL bar shrinks/expands during scroll, which makes scroll-fraction calculations wobble.
- Use both `100vh` and `100dvh` (in that order) on `.hero` and `.screen` heights. The `dvh` value accounts for mobile URL bar.
- Add `transform: translateZ(0)` to the fixed video background — forces GPU compositing so the fixed element doesn't disappear during iOS URL-bar transitions.
- On mobile, only update `video.currentTime` if the delta is > 1 frame (~33ms @ 30fps) to reduce iOS seek thrashing.

## LAYER STRUCTURE

1. Fixed video background (`fixed inset-0 z-0 bg-brand-ink`) with `object-fit: cover`. Overlay a subtle `bg-gradient-to-t from-brand-ink/85 via-brand-ink/20 to-brand-ink/50` for text legibility.
2. Fixed header (`z-20`) animated via headerY transform.
3. Scrollable content (`relative z-10 pointer-events-none`) with `pointer-events-auto` on interactive areas.

## SECTION 1: HERO

- 12-col grid.
- Display-2 kicker (`font-display-2 tracking-[0.3em] text-brand-secondary text-sm uppercase`) top-left: **"{{hero_kicker}}"**
- Headline (`font-display`, `clamp(3rem, 10vw, 8rem)`, leading-[0.95], color brand-secondary, text-shadow `6px 6px 0 var(--color-brand-primary)`, -webkit-text-stroke `2px var(--color-brand-ink)`) bottom-left: **"{{hero_headline}}"**
- Description paragraph center-right at `max-w-[460px]` (font-sans, brand-cream/80, text-lg): "{{hero_subhead}}"
- Two CTAs, brutalist-style with hard 5px shadows:
  - Primary: "**{{hero_cta_primary}}**" → `{{hero_cta_primary_url}}` — `bg-brand-primary text-white font-display text-xl tracking-wide px-8 py-4 rounded-full border-[3px] border-brand-ink shadow-[5px_5px_0_var(--color-brand-ink)]`
  - Secondary: "**{{hero_cta_secondary}}**" → `{{hero_cta_secondary_url}}` — `bg-brand-secondary text-brand-ink font-display text-xl tracking-wide px-8 py-4 rounded-full border-[3px] border-brand-ink shadow-[5px_5px_0_var(--color-brand-ink)]`
- On hover both buttons translate `-2px -2px` and shadow grows to `7px 7px 0`.

## SECTION 2: THE PRODUCT / SERVICE / STORY — ScrollReveal heading + 3-column grid

ScrollReveal heading (Luckiest Guy display font): **"{{tile_1_title}}. {{tile_2_title}}. {{tile_3_title}}."** (or a tighter one-line statement that combines all three).

3-tile glass-card grid:

| Tile | Kicker | Title | Body |
|---|---|---|---|
| 1 | {{tile_1_kicker}} | {{tile_1_title}} | {{tile_1_copy}} |
| 2 | {{tile_2_kicker}} | {{tile_2_title}} | {{tile_2_copy}} |
| 3 | {{tile_3_kicker}} | {{tile_3_title}} | {{tile_3_copy}} |

Each tile: glass card (rgba(brand_ink, 0.55), backdrop-blur 80px, border rgba(brand_secondary, 0.15), rounded-2xl, padding 8) with a lucide-react icon top-left (color brand-secondary, size 28).

## SECTION 3: FOOTER (ref={screen3Ref}) — Glassmorphism

Glass card with rgba(brand_ink, 0.6), backdrop-blur 80px, border rgba(brand_secondary, 0.1). Rounded `[2rem]`.

Top CTA inside the footer card:
- ScrollReveal heading (display font, brand-secondary): **"{{newsletter_headline}}"**
- Sub (body font, brand-cream/60): "{{newsletter_sub}}"
- Inline newsletter form: email input (transparent bg, border-bottom brand-secondary/40, no rounding, text brand-cream, placeholder brand-cream/40) + submit button styled like the hero primary CTA but smaller, text "**{{newsletter_cta_label}}**"

4-col footer grid (collapses to 2-col on tablet, 1-col on mobile):

**Column 1 — Brand**
- Logo (`/assets/logo.png` with graceful SVG fallback)
- Tagline: "{{brand_location}} · {{brand_age_gate}} only · culture-built"
- Address: "{{brand_location}} · {{business_email}} · {{business_phone}}"

**Column 2 — Shop**
Links: {{shop_links}}

**Column 3 — Experiences**
Links: {{experience_links}}

**Column 4 — Connect**
Social icons (lucide-react). Below: 21+ disclaimer + Terms / Privacy.

Copyright bar at bottom: "© {{current_year}} {{brand_name}} · Made in {{brand_location}}" (body font, 12px, brand-cream/40, tracking-[0.15em], uppercase).

## FIXED HEADER

motion.header sliding out via headerY when user scrolls past the hero.

Left: brand logo (`/assets/logo.png` with SVG fallback).

Right: nav with 5 NavItem links — **{{nav_links}}** — all in display-2 font letter-spacing wide. Plus one solid CTA on far right: "**{{header_cta_label}}**" → `{{header_cta_url}}` styled as a small pill button.

## DESIGN TOKENS

- Base background: **{{color_ink}}** (NOT pure black — slightly tinted to match the brand).
- Text scale: brand-cream (primary), brand-cream/80, /60, /40, /25.
- Accents: brand-primary {{color_primary}}, brand-secondary {{color_secondary}}.
- Glass surface: rgba(brand_ink, 0.55), backdrop-blur 80px, border rgba(brand_secondary, 0.15).
- Brutalist shadows on all CTAs: `5px 5px 0` (no spread, no blur). Color brand-ink or brand-primary.
- Display headings always have `-webkit-text-stroke: 2px var(--color-brand-ink)` + `text-shadow: 4-6px 4-6px 0 var(--color-brand-primary)` for the brutalist comic effect.
- Easing: motion `[0.16, 1, 0.3, 1]`, CSS `cubic-bezier(0.4, 0, 0.2, 1)`.
- Spacing: 90% viewport width container with clamp-based responsive values: `clamp(1.5rem, 4vw, 4rem)` horizontal padding.

## TONE + COPY RULES

Brand voice = **{{voice_tone}}**.

**Use:** {{voice_words_use}}

**Never use:** {{voice_words_avoid}}

**{{brand_age_gate}} disclaimer:** include a small line in the footer near the social row stating the age restriction + responsibility messaging if relevant (alcohol / adult / cannabis brands).

## CRITICAL ACCESSIBILITY

- Video has `muted playsInline webkit-playsinline="true" preload="auto"` plus a `poster` attribute set to a still PNG of the first frame so users on slow connections still see the brand frame.
- Add `prefers-reduced-motion` media query: when reduced-motion is enabled, replace the scroll-scrubbed video with a static poster image and disable the GSAP word-reveal animations (fall back to instant display).
- All CTAs have `aria-label` for screen readers describing the destination.
- Color contrast: any accent text on the ink background must hit WCAG AA — verify with contrast checker.

---

(End of prompt — copy everything from "Create a React + Vite..." through here, then run find-and-replace on the `{{PLACEHOLDER}}` slots.)

---

## 🛠️ STEP 2 — After the AI generates the code

1. Drop the cinematic video at the path you set in `video_url` (e.g. `/public/hero-frozen.mp4`)
2. Drop the brand logo at `/public/assets/logo.png` (the React component falls back to an SVG mark if missing)
3. Drop a 1200×630 OG image at `/public/og-image.jpg` for social shares
4. `npm install` → `npm run dev` → check it renders
5. Smoke test the scroll-scrub on real mobile (not just devtools)
6. Deploy: `npx vercel` → assign a subdomain

---

## 📋 NOTES — WHAT TO KEEP vs CHANGE

When you reuse this template for a NEW brand:

| ✅ Keep verbatim | ❌ Change |
|---|---|
| The `## SCROLL-DRIVEN VIDEO — CRITICAL` code block | The headline, subhead, tile copy |
| The dependency list + version pins | Brand colors, fonts |
| The mobile additions (iOS Safari unlock, 100dvh, GPU compositing) | Video URL + concept |
| The 3-layer architecture (fixed video, fixed header, scrolling content) | Nav labels + CTAs + footer links |
| The `prefers-reduced-motion` fallback | Voice rules (use/avoid words, tone) |
| The brutalist shadow recipe (`5px 5px 0`) | Age gate / disclaimer text |
| The glassmorphism math | Brand name in titles + footers |

---

## 🎬 COMPANION — Cinematic Video Source

The `video_url` you set in Step 0 needs to point at an actual cinematic asset. To generate one:

**For the image (still frame):** GPT Image / Midjourney / Flux prompt examples in [`ANIMATED-SITE-AGN-GUIDE.md`](ANIMATED-SITE-AGN-GUIDE.md) Step 1.

**For the video animation:** Seedance / Runway Gen-3 / Luma Dream Machine / Kie.ai prompt examples in [`ANIMATED-SITE-AGN-GUIDE.md`](ANIMATED-SITE-AGN-GUIDE.md) Step 2. The orbital-pan camera direction is reusable; just swap the subject.

**Output:** 1080p MP4 or WebM, 8-12 seconds, 4-8MB compressed.

**Hosting:** any CDN that returns `Access-Control-Allow-Origin: *` (Vercel, Cloudflare R2, S3 + CloudFront, GHL Media). Without CORS, the scroll-scrub will fail silently.

---

## 💡 EXAMPLES — Brand fills

### Example A: Adult Game Nights (the original)
- brand_name: "Adult Game Nights"
- color_primary: "#E8242C" (red)
- color_secondary: "#FFD23F" (yellow)
- font_display: "Luckiest Guy"
- video_concept: "Atlanta rooftop game night frozen mid-chaos"
- hero_headline: "WELCOME TO THE FUNCTION"

### Example B: a hypothetical premium coffee subscription
- brand_name: "Cold Storm Coffee"
- color_primary: "#0F4C5C" (deep teal)
- color_secondary: "#E36414" (burnt orange)
- font_display: "Anton"
- video_concept: "Slow pour of espresso frozen mid-cascade, droplets suspended in air"
- hero_headline: "THE FIRST SIP"

### Example C: an indie horror film promo
- brand_name: "The Hollow"
- color_primary: "#B91C1C" (blood red)
- color_secondary: "#E5E7EB" (bone white)
- font_display: "Creepster"
- video_concept: "Empty country road at dusk, camera slowly tracks toward a figure that may or may not be there"
- hero_headline: "DON'T LOOK BACK"

---

**Author:** Maurice / CREAIT
**Template version:** 1.0 — 2026-05-26
**Battle-tested on:** Adult Game Nights (live at https://agn-cinematic-landing.vercel.app, mobile scroll-scrub verified on iPhone 14 Pro + Pixel 7 + Desktop 1440)
