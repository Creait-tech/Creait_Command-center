# Claude Design Prompt — AGN Animated Landing

**Paste the block below into Claude Design (or any agent/IDE) to generate the AGN animated landing page.**
**Date:** 2026-05-25
**Based on:** vishnuai.in/animated-website-guide template, restructured for Adult Game Nights.

---

## THE PROMPT (copy everything between the bars)

---

Create a React + Vite + Tailwind CSS v4 landing page for "Adult Game Nights" (AGN) — an Atlanta-born, culture-led adult drinking card game brand whose flagship product is The Liquor Store Board Game. The page has a scroll-driven cinematic video background ("The Function Frozen" — a game night frozen mid-chaos), 3 content sections, and a glassmorphism footer. Use ONLY these dependencies: react 19, motion (framer-motion v12+), gsap, lucide-react, tailwindcss v4 with @tailwindcss/vite plugin. The design is dark cinematic with AGN's red/yellow/cream brutalist comic palette as accent. Use Luckiest Guy (display headings), Bangers (display kickers), and Manrope (body/sans) fonts.

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

vite.config.ts: Use @tailwindcss/vite plugin + @vitejs/plugin-react. Alias @ to project root.

index.html: Standard HTML5 with `<meta name="theme-color" content="#1A0A0A">`. AGN favicon. Title: "Adult Game Nights — The Liquor Store Game". OG image set to a still frame of the cinematic video.

src/index.css — EXACT:
```css
@import url('https://assets.cdn.filesafe.space/1uN6mnlvX9JQ5QvrLewp/media/6a14f3887e7c5a2f715f1dd8.mp4');
@import "tailwindcss";

@theme {
  --font-display: "Luckiest Guy", Impact, sans-serif;
  --font-display-2: "Bangers", Impact, sans-serif;
  --font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;

  --color-agn-red: #E8242C;
  --color-agn-red-dark: #B81820;
  --color-agn-yellow: #FFD23F;
  --color-agn-yellow-dim: #F5B800;
  --color-agn-ink: #1A0A0A;
  --color-agn-cream: #FFF8E7;
}
```

Define keyframe animations: `flyOutRight / flyInLeft` (250% translateX, 0.5s) for arrow button hover, and `flyOutUp / flyInUp` (150% translateY, 0.4s) for nav text hover. All use `cubic-bezier(0.4, 0, 0.2, 1)` easing with `forwards` fill mode.

## COMPONENT: ScrollReveal

A GSAP-powered word-by-word scroll reveal component with three ScrollTrigger animations (rotation from baseRotation to 0, opacity from baseOpacity to 1 with 0.05 stagger, blur from blurStrength to 0px). Use AGN display font (Luckiest Guy) with `[-webkit-text-stroke:2px_var(--color-agn-ink)]` and `[text-shadow:4px_4px_0_var(--color-agn-red)]` to render in the AGN brutalist style.

## COMPONENT: Reveal

A motion.div wrapper for viewport-triggered fade-in with easing `[0.16, 1, 0.3, 1]`.

## COMPONENT: NavItem

Hover-animated navigation link with vertical text fly animation using a cycle counter pattern. Render labels in `font-display-2` (Bangers) at small caps with 0.2em letter-spacing. Default color cream; on hover swap to yellow.

## MAIN APP ARCHITECTURE

- Video URL constant — `/hero-frozen.mp4` (a cinematic 8-12s shot of an Atlanta rooftop game night frozen mid-chaos — the camera does a smooth 180° orbital pan AROUND the group of players, revealing each frozen face, suspended drink, and mid-air die from new angles; constant height, no zoom, steadicam pace).
- State: arrowCycle, videoRef, videoContainerRef, isLoaded, screen3Ref.
- scrollY from motion's `useScroll()`; `headerY = useTransform(scrollY, [0, 500, 800], [0, 0, -150])`.

## SCROLL-DRIVEN VIDEO — CRITICAL

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

## LAYER STRUCTURE

1. Fixed video background (`fixed inset-0 z-0 bg-agn-ink`) with `object-fit: cover`. Overlay a subtle `bg-gradient-to-t from-agn-ink/85 via-agn-ink/20 to-agn-ink/50` for text legibility.
2. Fixed header (`z-20`) animated via headerY transform.
3. Scrollable content (`relative z-10 pointer-events-none`) with `pointer-events-auto` on interactive areas.

## SECTION 1: HERO

- 12-col grid.
- Display-2 kicker (`font-display-2 tracking-[0.3em] text-agn-yellow text-sm uppercase`) top-left: "ADULT GAME NIGHTS · ATLANTA · 21+"
- Headline (`font-display`, `clamp(3rem, 10vw, 8rem)`, leading-[0.95], color agn-yellow, text-shadow `6px 6px 0 var(--color-agn-red)`, -webkit-text-stroke `2px var(--color-agn-ink)`) bottom-left: "WELCOME TO THE FUNCTION"
- Description paragraph center-right at `max-w-[460px]` (font-sans, agn-cream/80, text-lg): "The drinking card game that built itself off TikTok. Atlanta-born. 21+ only. 4 to 15 players. 1 mission: make it home. Pull up."
- Two CTAs, brutalist-style with hard 5px shadows:
  - Primary: "COP THE GAME · $34.04" → `https://adultgamenights.com` — `bg-agn-red text-white font-display text-xl tracking-wide px-8 py-4 rounded-full border-[3px] border-agn-ink shadow-[5px_5px_0_var(--color-agn-ink)]`
  - Secondary: "BOOK A GAME NIGHT 🎲" → `https://agn.getcreait.com/book-game-night` — `bg-agn-yellow text-agn-ink font-display text-xl tracking-wide px-8 py-4 rounded-full border-[3px] border-agn-ink shadow-[5px_5px_0_var(--color-agn-ink)]`
- On hover both buttons translate `-2px -2px` and shadow grows to `7px 7px 0` — uses the cubic-bezier easing.

## SECTION 2: THE GAME — ScrollReveal heading + 3-column grid

Use ScrollReveal for the heading: **"100 cards. 4–15 players. 1 mission: make it home."**

Below it, a 3-column grid (collapses to 1-col on mobile). Each tile is a glass card (rgba(26,10,10,0.55), backdrop-blur 80px, border rgba(255,210,63,0.15), rounded-2xl, padding 8) with an icon (lucide-react), kicker, and short copy:

| Tile | Kicker (Bangers, agn-yellow) | Title (Luckiest Guy, agn-cream) | Body (Manrope, agn-cream/65) |
|---|---|---|---|
| 1 | THE PRODUCT | The Liquor Store Game | "Box, board, 100 cards, dice, mini bottles. Cards range from chill to felony. You been warned." |
| 2 | THE SERVICE | In-Home Game Nights | "We bring AGN to your function. Three packages from $199. Drop-off, host, or full experience." |
| 3 | THE CULTURE | Atlanta-Born, 21+ | "Built for adults who hold a drink and a conversation. Pro-Black, hype, irreverent. Pull up." |

Each tile has a lucide icon at top-left: `Dice5`, `Calendar`, `Sparkles` (or similar — keep iconography minimal, color agn-yellow, size 28).

## SECTION 3: FOOTER (ref={screen3Ref}) — Glassmorphism

Glass card with `rgba(26,10,10,0.6)`, backdrop-blur 80px, border `rgba(255,210,63,0.1)`. Rounded `[2rem]`. Internal padding clamp-based.

Top CTA inside the footer card:
- ScrollReveal heading (Luckiest Guy, agn-yellow): **"Ready to pull up to the next drop?"**
- Sub (Manrope, agn-cream/60): "Join the AGN list. First dibs on Smoking Section, event RSVPs, exclusive codes."
- Inline newsletter form: email input (transparent bg, border-bottom agn-yellow/40, no rounding, text agn-cream, placeholder agn-cream/40) + submit button styled like the hero primary CTA but smaller (text "LOCK ME IN")

4-col footer grid (collapses to 2-col on tablet, 1-col on mobile):

**Column 1 — Brand**
- AGN logo (yellow rounded-rect with red dice icon — render inline SVG)
- Tagline: "Atlanta · 21+ only · culture-built"
- Three address-style lines: "Atlanta, GA · adultgamenights@gmail.com · 478-654-9574"

**Column 2 — Shop**
Links (open in new tab to adultgamenights.com paths):
- The Liquor Store Game
- Smoking Section (Coming Soon)
- AGN Merch
- Accessories
- Wholesale

**Column 3 — Experiences**
Links (open to GHL forms at agn.getcreait.com):
- Book a Game Night
- Sponsor AGN
- Upcoming Events
- Creator Program

**Column 4 — Connect**
Social icons row (lucide-react: Instagram, Music2 for TikTok, Youtube, Facebook). Each agn-cream, hover agn-yellow. Below: small print "Drink responsibly · Terms · Privacy"

Copyright bar at very bottom: `© 2026 Adult Game Nights · Made in Atlanta` (Manrope, 12px, agn-cream/40, tracking-[0.15em], uppercase).

## FIXED HEADER

motion.header sliding out via headerY when user scrolls past the hero.

Left: AGN logo (yellow rounded-rect with red "AGN" wordmark in Luckiest Guy, optional dice glyph).

Right: nav with 5 NavItem links — `THE GAME`, `BOOK`, `EVENTS`, `SPONSOR`, `STORE` — all in Bangers letter-spacing wide. Plus one solid CTA on far right: "COP THE GAME" (`bg-agn-yellow text-agn-ink font-display rounded-full border-[3px] border-agn-ink shadow-[3px_3px_0_var(--color-agn-red)] px-5 py-2 text-base`).

## DESIGN TOKENS

- Base background: `#1A0A0A` (agn-ink — deep wine-black, not pure black; matches AGN's brand).
- Text scale: `agn-cream` (primary), `agn-cream/80`, `agn-cream/60`, `agn-cream/40`, `agn-cream/25`.
- Accents: `agn-red #E8242C`, `agn-yellow #FFD23F`.
- Glass surface: `rgba(26,10,10,0.55)`, backdrop-blur 80px, border `rgba(255,210,63,0.15)`.
- Brutalist shadows on all CTAs and floating cards: `5px 5px 0` with no spread, no blur, color either `var(--color-agn-ink)` or `var(--color-agn-red)`.
- Display headings always have `-webkit-text-stroke: 2px var(--color-agn-ink)` + `text-shadow: 4-6px 4-6px 0 var(--color-agn-red)` for the brutalist comic effect.
- Easing: motion `[0.16, 1, 0.3, 1]`, CSS `cubic-bezier(0.4, 0, 0.2, 1)`.
- Spacing: 90% viewport width container with clamp-based responsive values: `clamp(1.5rem, 4vw, 4rem)` horizontal padding.

## TONE + COPY RULES

Brand voice = Atlanta hype DJ-host. Use these words naturally: "Yo," "Bet," "Pull up," "Lock in," "Heard you," "🎲".

**Never use:**
- "Welcome," "Hello," "Thanks for visiting"
- "How may we help you"
- "Industry-leading," "world-class," "innovative" (corporate-speak)
- More than 2 emojis per visible block

**21+ disclaimer:** include a small line in the footer near the social row: "21+ only. Drink responsibly. Don't drink and drive."

## CRITICAL ACCESSIBILITY

- Video has `muted playsInline preload="auto"` plus a `poster` attribute set to a still PNG of the first frame so users on slow connections still see the brand frame.
- Add `prefers-reduced-motion` media query: when reduced-motion is enabled, replace the scroll-scrubbed video with a static poster image and disable the GSAP word-reveal animations (fall back to instant display).
- All CTAs have `aria-label` for screen readers describing the destination.
- Color contrast: agn-yellow text on agn-ink background must hit WCAG AA — verify with contrast checker.

---

(End of prompt — paste everything from "Create a React + Vite + Tailwind CSS v4 landing page" down to here into Claude Design.)

---

## OPTIONAL — HOW TO TWEAK BEFORE PASTING

Want to swap any of these elements? Quick guide:

| Want to change | Edit this section |
|---|---|
| Headline copy | Section 1 Hero — the `<h1>` text |
| CTA destinations | Section 1 Hero — the two CTA button hrefs |
| 3 tile content | Section 2 — the tile table |
| Footer columns | Section 3 — Columns 1-4 |
| Brand colors | `@theme` block at top |
| Fonts | First line of `index.css` |
| Video file path | "Video URL constant" line |

---

## AFTER CLAUDE DESIGN OUTPUTS THE CODE

1. Run `npm create vite@latest agn-cinematic -- --template react-ts` (or react)
2. Replace generated `src/`, `vite.config.ts`, `index.html`, `index.css` with what Claude generated
3. Drop your `hero-frozen.mp4` into `/public/`
4. Drop a `hero-frozen-poster.jpg` (first frame of video) also into `/public/`
5. `npm install` then `npm run dev`
6. Deploy via `npx vercel` — point a subdomain like `liquorstore.adultgamenights.com` at the Vercel project

---

## CINEMATIC HERO VIDEO SOURCING

The video referenced as `/hero-frozen.mp4` needs to be created first. Use the prompts in `docs/ANIMATED-SITE-AGN-GUIDE.md` Steps 1-2 to:
1. Generate the still image via GPT Image / Midjourney / Flux (the "Function Frozen" cinematic still)
2. Animate it into video via Seedance / Runway / Luma Dream Machine
3. Compress to ~5-8 MB WebM + MP4 (use ffmpeg or HandBrake)
4. Place in `/public/hero-frozen.mp4` of the Vite project

