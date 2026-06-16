# AGN Animated Site — Cinematic Build Guide

**Inspired by:** vishnuai.in/animated-website-guide (3-step cinematic hero method)
**Adapted for:** Adult Game Nights — Liquor Store Game launch experience
**Date:** 2026-05-25
**Outcome:** A scroll-driven cinematic landing page where the chaos of a real AGN game night unfolds as the visitor scrolls.

---

## 🎬 THE CONCEPT — "The Function Frozen"

Where the original guide does a fantasy warrior frozen mid-battle, AGN does **a game night frozen mid-chaos**.

The hero video is one continuous cinematic shot: the camera glides through a Atlanta-rooftop game night where everything is suspended in time — dice mid-roll, drinks splashing in mid-air, cards flying, friends mid-laugh, a "Uh Ohh! You're too drunk go directly to AA meeting" card pinned in slow-mo descent — and the camera lands on the **Liquor Store Game** box glowing in the center of the table like the holy grail of the chaos.

That's the brand promise visualized: AGN doesn't sell a card game, it sells **the function**.

---

## STEP 1 — GENERATE THE CINEMATIC IMAGE

**Tool:** GPT Image / Midjourney / Flux (any of: Kie.ai gateway, OpenAI image API, or free GPT-Img)

### The AGN Image Prompt

```
Create a cinematic 16:9 hyper-realistic freeze-frame photograph of an Atlanta rooftop game night party, late golden-hour light bleeding into night, frozen in time mid-chaos. 

In the center of a wooden table sits The Liquor Store board game by Adult Game Nights — bright yellow box with bold red "LIQUOR STORE" lettering and red-and-white storefront awning illustration, mini liquor bottles, red dice, an "Uh Ohh! You're too drunk go directly to AA meeting" card visible. The game box is the hero, lit subtly from above as if a spotlight.

Around the table: 6-8 stylish Black and Brown adults in their late 20s frozen mid-celebration. Dice tumbling mid-air. Shot glasses suspended at lip-level. A drink mid-pour cascading in a glittering arc. Playing cards fanned and falling like leaves. One person mid-laugh head thrown back. Another reaching for the game box. Sparks of glow from string-lights drifting overhead. Cigarette/cigar smoke curled and frozen.

Background: Atlanta skyline silhouette at dusk, a Bluetooth speaker, red Solo cups, half-eaten food. Neon-style "AGN" sign glowing in red against the dark.

Style: Cinematic, shot on RED camera, anamorphic lens, shallow depth of field with the game box in tack-sharp focus. Color palette grounded in AGN brand: warm cream/yellow highlights, blood-red accents, deep ink-black shadows. Pro-Black culture, Atlanta-rooted, hype DJ-host energy, irreverent and joyful. Dramatic but not dark — feel like a million-dollar movie poster for "the best party of your life."
```

**Output target:** 1920×1080 minimum, ideally 3840×2160 for retina sharpness. Save as `hero-frozen.png`.

**If first generation isn't right:** keep the prompt, add "more saturated yellow box, sharper logo, brighter party lights" or "less crowded, fewer people, more focus on the game box."

---

## STEP 2 — ANIMATE THE IMAGE INTO VIDEO

**Tool:** Seedance · Higgsfield · Runway Gen-3 · Kie.ai (your Kie key is in `~/.env`) · or Luma Dream Machine

### The AGN Video Prompt (orbital camera around the players)

```
Animate this image into an 8-12 second cinematic shot.

The original picture — all the people, the game box, the table, the drinks, the cards, the dice, the environment, the lighting — must remain EXACTLY the same. Only the camera moves. No character animation, no facial expression changes, no body shifts. The subjects stay locked in their frozen pose.

Camera move: smooth orbital arc AROUND the group of people playing the game. Start the shot from one side of the table (about waist-to-chest height, looking slightly across at the players), then dolly laterally around the table in a continuous semi-circle (roughly 180° of arc), keeping the players + game box in frame the entire time. The camera stays at a consistent height — no rise, no fall — like a steadicam operator walking around the table. Subtle camera shake for handheld realism.

Pacing: continuous and slow — the orbit should reveal each frozen face, each suspended drink, each mid-air die, each falling card from a new angle as the camera passes. NO zoom in, NO zoom out, NO push-in, NO dolly forward. Only lateral motion in a circle around the subjects. Parallax between foreground (closest player) and background (Atlanta skyline) sells the depth.

Frozen elements stay frozen — dice still in mid-air, drinks still suspended, cards still falling slow-motion, faces locked mid-laugh. Only the camera moves. Lighting can subtly shift as the camera passes around — warm rim-light catches the players from one side, cooler dusk fill on the other side, golden-hour kiss on the AGN game box as the camera passes the "front" of the table.

Atmospheric motion (very subtle, optional): drifting embers from a cigar, gentle haze from string-lights, dust particles catching the light. NO motion on the people, the cards, the dice, or the drinks themselves.

Final frame: camera lands back near its starting angle (or holds at the moment the AGN game box is dead-center in frame, depending on where the 180° arc completes). Soft cinematic vignette, barely-there color-grade boost on the AGN red and yellow.
```

**Output target:** 1080p MP4 or WebM, 8-12 seconds, ~5-10MB compressed. Save as `hero-frozen.mp4`.

**Troubleshooting prompts to regenerate with if the first attempt misses:**

- *If the AI animates the people:* "EVERYTHING except camera position stays locked. The people do NOT move. The cards do NOT fall. The dice do NOT roll. This is a frozen tableau and only the camera orbits around it."
- *If the AI does a zoom-in instead of an orbit:* "NO zoom, NO push-in, NO dolly forward. The camera maintains a constant distance from the subjects. The camera ONLY moves laterally in a circle around the table."
- *If the orbit is too fast:* "Slow the camera move down significantly. The orbit should take the full 8-12 seconds to complete 180°. Think steadicam at walking pace, not a whip-pan."
- *If the camera loses framing:* "The players and game box must stay centered in the frame throughout the entire orbit. Treat the table as the focal point and orbit around it like a turntable."

---

## STEP 3 — BUILD THE ANIMATED SITE

### Where to host this

Three options ranked by speed-to-ship:

| Option | Time | Pros | Cons |
|---|---|---|---|
| **A. Standalone landing on Vercel** at `liquorstore.adultgamenights.com` | 4-6 hours | Full creative control, all animations work, free hosting | Separate from CRM/checkout (link to Shopify for buy) |
| **B. Embed inside GHL Sites page** | 2-3 hours | Stays in GHL ecosystem | GHL strips some JS, animations may degrade |
| **C. Custom Shopify section** | 6-8 hours | Lives at adultgamenights.com directly | Shopify limits some libraries, slower iteration |

**Recommended: Option A** — build it standalone, ship it in 1-2 sessions, link from Shopify and from GHL.

---

### Tech Stack (AGN edition)

Same stack the guide recommends — works clean for this use case:

```json
{
  "react": "^19.0.0",
  "vite": "^6.2.0",
  "tailwindcss": "^4.0.0",
  "@tailwindcss/vite": "^4.0.0",
  "framer-motion": "^12.23.24",
  "gsap": "^3.14.2",
  "lucide-react": "^0.546.0"
}
```

**Fonts (AGN brand match):**
```html
<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Bangers&family=Manrope:wght@400;500;700;800&display=swap" rel="stylesheet">
```

**Design tokens (AGN-specific — overrides the guide's pure-black aesthetic):**

```css
:root {
  --agn-red: #E8242C;
  --agn-red-dark: #B81820;
  --agn-yellow: #FFD23F;
  --agn-yellow-dim: #F5B800;
  --agn-ink: #1A0A0A;
  --agn-cream: #FFF8E7;
  --agn-white: #FFFFFF;

  --font-display: 'Luckiest Guy', Impact, sans-serif;
  --font-display-2: 'Bangers', Impact, sans-serif;
  --font-body: 'Manrope', system-ui, sans-serif;

  --easing-cinematic: cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

### The 5 Sections of the AGN Animated Landing

The original guide had 3 sections (Hero, Content Grid, Footer). For AGN's product launch context, expand to 5 because we have more conversion lanes.

```
SECTION 1: Hero (scroll-driven video background)
  ├── Cinematic video loops + scrub on scroll
  ├── Headline: "WELCOME TO THE FUNCTION"
  ├── Sub: "The drinking card game that built itself off of TikTok."
  ├── 2 CTAs: "COP THE GAME" → Shopify · "BOOK A GAME NIGHT" → GHL form

SECTION 2: The Game (scroll-reveal product showcase)
  ├── Scroll-revealed product photos (the 4 photos provided)
  ├── ScrollReveal headline: "100 cards. 4-15 players. 1 mission: make it home."
  ├── Feature highlights (drag-fade as user scrolls)

SECTION 3: The Vibe (event/UGC reel)
  ├── Embedded TikTok highlight reel OR auto-playing customer UGC clips
  ├── Quote carousel: "247 reviews · 4.9 avg · As Seen On TikTok"
  ├── Stat counter that scroll-animates in

SECTION 4: The Lanes (4-tile grid)
  ├── BUY THE GAME — Shopify link
  ├── BOOK A GAME NIGHT — Service form
  ├── SPONSOR US — Sponsor form
  ├── WHOLESALE — Wholesale form

SECTION 5: Footer (glassmorphism)
  ├── Newsletter signup ("Pull up to the next drop")
  ├── 4 columns: Brand · Shop · Connect · Legal
  ├── AGN logo + "Atlanta · 21+"
```

---

### Custom Components (AGN-flavored)

#### Component 1: `<ScrollVideoHero />`

The flagship — video that **scrubs** as the user scrolls down. Same technique the original guide uses.

```jsx
// components/ScrollVideoHero.jsx
import { useRef, useEffect } from 'react';

export default function ScrollVideoHero() {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    video.pause();

    const onScroll = () => {
      if (video.seeking) return; // CRITICAL — prevents frame tearing
      const rect = container.getBoundingClientRect();
      const winH = window.innerHeight;
      const scrollFraction = Math.max(0, Math.min(1,
        -rect.top / (rect.height - winH)
      ));
      if (video.duration) {
        video.currentTime = scrollFraction * video.duration;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <video
          ref={videoRef}
          src="/hero-frozen.mp4"
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--agn-ink)]/80 via-transparent to-[var(--agn-ink)]/40" />
        <HeroContent />
      </div>
    </section>
  );
}
```

#### Component 2: `<ScrollReveal>` (word-by-word reveal)

Uses GSAP exactly as the guide does, but with AGN typography. Words rotate in, blur out → blur in, opacity 0 → 1.

```jsx
// components/ScrollReveal.jsx
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function ScrollReveal({ children, baseRotation = 3, baseOpacity = 0.1 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const words = el.querySelectorAll('.word');

    gsap.fromTo(words,
      { rotation: baseRotation, opacity: baseOpacity, filter: 'blur(4px)' },
      {
        rotation: 0, opacity: 1, filter: 'blur(0px)',
        stagger: 0.05,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
          end: 'bottom 60%',
          scrub: true
        }
      }
    );
  }, [baseRotation, baseOpacity]);

  // Split text into spans for word-by-word reveal
  const text = typeof children === 'string' ? children : '';
  return (
    <h2 ref={containerRef} className="font-display text-[clamp(2rem,6vw,5rem)] leading-[1.1] text-[var(--agn-yellow)] [text-shadow:4px_4px_0_var(--agn-ink)]">
      {text.split(' ').map((w, i) => (
        <span key={i} className="word inline-block mr-3">{w}</span>
      ))}
    </h2>
  );
}
```

#### Component 3: `<NavItem>` (vertical text flight on hover)

When you hover, the current word flies UP/OUT and a new word flies IN from below. Pure CSS keyframes — works on every browser.

```jsx
// components/NavItem.jsx
export default function NavItem({ label, href }) {
  return (
    <a href={href} className="nav-item group relative inline-block overflow-hidden h-6 leading-6 px-2 font-display-2 text-sm tracking-wider text-[var(--agn-cream)]">
      <span className="nav-label block transition-transform duration-[400ms] ease-[var(--easing-cinematic)] group-hover:-translate-y-full">{label}</span>
      <span className="nav-label-2 absolute top-0 left-2 block translate-y-full transition-transform duration-[400ms] ease-[var(--easing-cinematic)] group-hover:translate-y-0 text-[var(--agn-yellow)]">{label}</span>
    </a>
  );
}
```

#### Component 4: `<StickyCTA>` (mobile bottom bar)

Same anchored CTA from the website CRO patches doc — re-used here.

```jsx
// components/StickyCTA.jsx
export default function StickyCTA() {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-[var(--agn-ink)] border-t-2 border-[var(--agn-yellow)] px-3 py-2 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-[var(--agn-yellow)] border-2 border-[var(--agn-ink)] flex-shrink-0" />
      <div className="flex-1 min-w-0 text-[var(--agn-cream)]">
        <div className="font-display-2 text-sm tracking-wide truncate">Liquor Store Game</div>
        <div className="text-xs"><s className="opacity-50">$59</s> <b className="text-[var(--agn-yellow)]">$34.04</b></div>
      </div>
      <a href="https://adultgamenights.com/products/the-liquor-store-board-game"
         className="bg-[var(--agn-yellow)] text-[var(--agn-ink)] font-display text-base px-4 py-2 rounded-full border-2 border-[var(--agn-ink)] shadow-[3px_3px_0_var(--agn-red-dark)]">
        BUY NOW
      </a>
    </div>
  );
}
```

---

### Hero Content (overlays on the scroll video)

```jsx
// inside ScrollVideoHero
function HeroContent() {
  return (
    <div className="relative z-10 h-screen flex flex-col justify-end pb-24 px-6 md:px-12 max-w-[90vw] mx-auto">
      <div className="font-display-2 text-sm tracking-[0.3em] text-[var(--agn-yellow)] mb-3">
        ADULT GAME NIGHTS · ATLANTA · 21+
      </div>
      <h1 className="font-display text-[clamp(3rem,10vw,8rem)] leading-[0.95] text-[var(--agn-yellow)] [text-shadow:6px_6px_0_var(--agn-red)] [-webkit-text-stroke:2px_var(--agn-ink)]">
        WELCOME TO<br/>THE FUNCTION
      </h1>
      <p className="font-body text-lg md:text-xl text-[var(--agn-cream)]/80 max-w-md mt-6">
        The drinking card game that built itself off of TikTok. Atlanta-born. 21+ only. Pull up.
      </p>
      <div className="flex flex-col md:flex-row gap-3 mt-8">
        <a href="https://adultgamenights.com/products/the-liquor-store-board-game"
           className="bg-[var(--agn-red)] text-white font-display text-xl tracking-wide px-8 py-4 rounded-full border-[3px] border-[var(--agn-ink)] shadow-[5px_5px_0_var(--agn-ink)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[7px_7px_0_var(--agn-ink)] transition-all">
          COP THE GAME · $34.04
        </a>
        <a href="https://agn.getcreait.com/book-game-night"
           className="bg-[var(--agn-yellow)] text-[var(--agn-ink)] font-display text-xl tracking-wide px-8 py-4 rounded-full border-[3px] border-[var(--agn-ink)] shadow-[5px_5px_0_var(--agn-ink)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[7px_7px_0_var(--agn-ink)] transition-all">
          BOOK A GAME NIGHT 🎲
        </a>
      </div>
    </div>
  );
}
```

---

### Section 2: The Game (product showcase, ScrollReveal driven)

Use the 4 product photos you have:

```
/public/products/
  ├── game-full-setup.jpg       ← the box with mini bottles + dice
  ├── too-drunk-card.jpg         ← close-up of the AA card
  ├── board-angled.jpg           ← angled shot of the game on box
  └── liquor-store-sign.jpg      ← the red storefront piece
```

Layout:
- Sticky left column with `<ScrollReveal>` text
- Right column: product images that scale + fade in as user scrolls past

Headline copy:
> **100 cards. 4-15 players. 1 mission: make it home.**

Sub copy chunks (each its own ScrollReveal):
- "Spin the bottle. Roll the dice. Pull a card. Hope it's not the AA meeting one."
- "Built for adults who can hold a drink and a conversation at the same time."
- "Same crew. Same playlist. New chaos every round."

---

### Section 3: The Vibe (social proof + UGC)

```jsx
<section className="bg-[var(--agn-ink)] py-24 px-6">
  <ScrollReveal>The world is watching.</ScrollReveal>
  <div className="grid grid-cols-3 gap-4 mt-12 max-w-5xl mx-auto">
    <Stat label="TIKTOK VIEWS" value="400K+" />
    <Stat label="LIVE EVENTS" value="50+" />
    <Stat label="GAME NIGHTS HOSTED" value="∞" />
  </div>
  {/* Embed TikTok carousel here */}
</section>
```

Use `<motion.div>` from Framer Motion to count up the stats as they enter viewport.

---

### Section 4: The Lanes (4-tile conversion grid)

```jsx
<section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto p-6">
  <Lane title="BUY THE GAME" sub="$34.04 · free shipping over $50" href="https://adultgamenights.com" bg="var(--agn-red)" />
  <Lane title="BOOK A GAME NIGHT" sub="Packages $199–$499" href="https://agn.getcreait.com/book-game-night" bg="var(--agn-yellow)" />
  <Lane title="SPONSOR AGN" sub="Founder rates through Q3" href="https://agn.getcreait.com/sponsor" bg="var(--agn-cream)" />
  <Lane title="WHOLESALE" sub="44-57% retail margins" href="https://agn.getcreait.com/wholesale" bg="var(--agn-ink)" textColor="var(--agn-yellow)" />
</section>
```

Each lane is a tilt-on-hover card with the hard-shadow brutalist style.

---

### Section 5: Footer (glassmorphism, AGN brand)

Same glassmorphism pattern from the guide but with AGN palette:

```css
.footer-glass {
  background: rgba(26, 10, 10, 0.6);
  backdrop-filter: blur(80px);
  border: 1px solid rgba(255, 210, 63, 0.15);
}
```

4 columns:
- **Brand:** AGN logo, "Atlanta · 21+ only · culture-built"
- **Shop:** Liquor Store Game · Smoking Section (soon) · Merch · Accessories
- **Connect:** IG · TikTok · YouTube · Newsletter signup form
- **Legal:** Terms · Privacy · Drink Responsibly · Contact

---

## 🛠️ THE 6-DAY BUILD PLAN

| Day | What gets done | Hours |
|---|---|---|
| Day 1 | Generate hero image (4-6 attempts) + pick the winner | 2h |
| Day 2 | Generate hero video (3-4 attempts) + pick the winner | 2h |
| Day 3 | Scaffold Vite + React + Tailwind + Framer Motion + GSAP project | 1h |
| Day 4 | Build `<ScrollVideoHero>` + Hero content overlay | 3h |
| Day 5 | Build Sections 2-4 (Game · Vibe · Lanes) + `<ScrollReveal>` | 4h |
| Day 6 | Footer + responsive polish + deploy to Vercel at `liquorstore.adultgamenights.com` | 3h |

Total: ~15 hours of focused build time. Realistically 2-3 weekends if Thomas is collaborating on the cinematic concept.

---

## 🎯 WHAT THIS DELIVERS

| Asset | Outcome |
|---|---|
| 1 hero image (3840×2160) | Use everywhere: ads, social, press kit, deck covers |
| 1 hero video (10s loop, 5-10MB) | Plays as scroll-driven background on landing |
| 1 animated landing site | Conversion-optimized hero experience for product page traffic |
| Reusable component library | Other AGN pages (Smoking Section, Sex Store, future drops) can use the same animation patterns |

**Cost estimate:**
- Image gen: ~$5-15 across attempts (GPT Image / Kie / Flux)
- Video gen: ~$15-40 across attempts (Seedance / Runway / Kie)
- Hosting: $0 (Vercel free tier)
- Domain: $0 (subdomain of adultgamenights.com)
- Time: ~15 hours

**Expected lift:** Cinematic hero pages convert 2-3x better than static product pages for impulse-buy products in the $30-50 range (Liquor Store Game is in that sweet spot). The video also doubles as social ad creative — repurpose it as the hook for TikTok / Reels ads.

---

## 🔁 ITERATION HOOK

Once the Liquor Store cinematic ships:
- **Q3:** Smoking Section gets its own cinematic — "The Smoking Section Frozen" (similar concept, smoke + neon)
- **Q4:** Sex Store gets its own cinematic — "The After-Party Frozen" (lower lighting, more intimate)
- **Q1 2027:** Service Booking cinematic — "Your Game Night Frozen" (zooms into a private AGN-hosted event)

Each cinematic = ~2 weeks. By end of year you have a library of 4 cinematic landing pages, each driving a separate revenue lane.

---

## 🚦 STARTER COMMAND

When you're ready to scaffold:

```bash
# Pick a directory
cd ~/code
# Scaffold the Vite + React + Tailwind project
npm create vite@latest agn-liquor-cinematic -- --template react
cd agn-liquor-cinematic
npm install
npm install @tailwindcss/vite@^4 tailwindcss@^4 framer-motion gsap lucide-react
# Drop in the hero-frozen.mp4 + 4 product photos to /public/
# Replace /src/App.jsx with the structure above
# Run
npm run dev
# Deploy
npx vercel
```

---

## 📁 PROJECT STRUCTURE

```
agn-liquor-cinematic/
├── public/
│   ├── hero-frozen.mp4         ← cinematic video
│   ├── hero-frozen-poster.jpg  ← first frame as poster
│   └── products/
│       ├── game-full-setup.jpg
│       ├── too-drunk-card.jpg
│       ├── board-angled.jpg
│       └── liquor-store-sign.jpg
├── src/
│   ├── App.jsx                  ← page composition
│   ├── components/
│   │   ├── ScrollVideoHero.jsx
│   │   ├── ScrollReveal.jsx
│   │   ├── NavItem.jsx
│   │   ├── StickyCTA.jsx
│   │   ├── Stat.jsx
│   │   ├── Lane.jsx
│   │   └── Footer.jsx
│   ├── styles/
│   │   └── globals.css          ← AGN tokens + Tailwind directives
│   └── main.jsx
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## 💬 Where this lives in the AGN ecosystem

- **adultgamenights.com** (Shopify) — homepage stays as the e-comm hub, but add a banner: "🎬 Watch the trailer → liquorstore.adultgamenights.com"
- **liquorstore.adultgamenights.com** (this Vercel site) — the cinematic landing. "Cop the game" CTA points to Shopify checkout. "Book a game night" CTA points to GHL form.
- **GHL Funnel pages** — link out to this cinematic from any campaign that warrants a high-touch hero moment (sponsor pitches, event landing pages).
- **Social ads** — repurpose the 10s video clip directly as TikTok/Reels paid ad creative. Adds ROI to the production cost.

---

**Author:** Maurice / CREAIT
**Date:** 2026-05-25
**Source guide:** vishnuai.in/animated-website-guide
**Adapted for:** Adult Game Nights — Liquor Store Game launch experience
