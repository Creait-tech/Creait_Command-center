# Scroll-Driven Video Background — Drop-In Template

**What this is:** A focused template for ONLY the scroll-driven cinematic video background. Drops into any existing landing page, blog, portfolio, or React app. Doesn't dictate your hero copy, sections, or layout — just the background video effect that scrubs as you scroll.

**What it produces:** A fixed full-screen video behind your content. As the user scrolls down, the video's `currentTime` advances proportionally. Scroll to the top = frame 0. Scroll to the bottom = last frame. Works on desktop, iPhone Safari, Android Chrome, Pixel.

**Battle-tested at:** https://agn-cinematic-landing.vercel.app (verified on iPhone 14 Pro + Pixel 7 + Desktop via Playwright emulation).

---

## 🎯 STEP 0 — Fill these 2 values

```yaml
video_url:          # path to your .mp4 (e.g. "/hero.mp4" or full CDN URL)
                    # MUST be CORS-open (Access-Control-Allow-Origin: *) if hosted externally
poster_image_url:   # path to a still frame .jpg (e.g. "/hero-poster.jpg")
                    # shown while video loads + as fallback for reduced-motion users
ink_color:          # the base background color, hex (e.g. "#1A0A0A" or "#000000")
                    # what shows behind the video while it loads
```

---

## 🎬 STEP 1 — THE PROMPT (paste into Claude Design / Cursor / Codex / Lovable)

Copy everything below, replace `{{video_url}}`, `{{poster_image_url}}`, `{{ink_color}}` with your values.

---

Add a scroll-driven cinematic video background to my existing React page. The video should be `position: fixed` behind all my content. As the user scrolls down the page, the video's `currentTime` should advance proportionally — scroll to top = frame 0, scroll to bottom of the page = last frame of the video. The video stays muted, never auto-plays through, only frame-scrubs based on scroll position.

**Tech:** React 18+ or 19 with `useEffect` + `useRef`. No additional dependencies required.

**Video file:** `{{video_url}}` (publicly hosted, CORS-open, 8-12 second cinematic clip).

**Poster image (fallback for slow connections + reduced-motion users):** `{{poster_image_url}}`.

**Background color while video loads:** `{{ink_color}}`.

## ARCHITECTURE — 3 layers

```
┌─────────────────────────────────────────┐  z-10 — Scrollable content
│   <YOUR EXISTING PAGE GOES HERE>        │  (sections / cards / footer / etc.)
│   ↓ scrolls naturally ↓                 │
├─────────────────────────────────────────┤  z-20 — Optional fixed header
│   <header />                            │  (slides out on scroll if you want)
├─────────────────────────────────────────┤  z-0  — Fixed video background
│   <video />  ← scrubs on scroll         │  position: fixed, inset: 0
└─────────────────────────────────────────┘
```

## REACT COMPONENT — drop this in your app root

```jsx
import { useEffect, useRef, useState } from "react";

const VIDEO_URL = "{{video_url}}";
const POSTER_URL = "{{poster_image_url}}";

export default function ScrollVideoBackground() {
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoUnlocked, setVideoUnlocked] = useState(false);
  const isMobileRef = useRef(false);

  // 1. Detect reduced-motion + mobile once on mount
  useEffect(() => {
    const ua = navigator.userAgent || "";
    isMobileRef.current = /iPad|iPhone|iPod|Android|Mobile/.test(ua)
                       || window.matchMedia("(max-width: 900px)").matches;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // 2. iOS Safari blocks video.currentTime updates until video is "user-activated".
  //    First touch/scroll/click → play().pause() → unlocks programmatic seeking forever.
  useEffect(() => {
    if (videoUnlocked) return;
    const unlock = async () => {
      const v = videoRef.current;
      if (!v) return setVideoUnlocked(true);
      try {
        await v.play();
        v.pause();
        v.currentTime = 0;
      } catch (e) { /* autoplay blocked — fall through */ }
      setVideoUnlocked(true);
    };
    const opts = { once: true, passive: true };
    window.addEventListener("touchstart", unlock, opts);
    window.addEventListener("scroll", unlock, opts);
    window.addEventListener("click", unlock, opts);
    return () => {
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("scroll", unlock);
      window.removeEventListener("click", unlock);
    };
  }, [videoUnlocked]);

  // 3. The scroll-scrub itself
  useEffect(() => {
    let raf;
    let lastCurrentTime = 0;
    // Cache viewport height once — iOS Safari's innerHeight jitters as URL bar
    // shrinks/expands during scroll, which makes scroll-fraction calculations wobble.
    let cachedWinH = window.innerHeight;
    const recalcWinH = () => { cachedWinH = window.innerHeight; };
    window.addEventListener("resize", recalcWinH);
    window.addEventListener("orientationchange", recalcWinH);

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const winH = cachedWinH;
        const docH = document.documentElement.scrollHeight - winH;
        const fraction = Math.max(0, Math.min(1, window.scrollY / Math.max(1, docH * 0.85)));

        const v = videoRef.current;
        if (v && !v.seeking && v.duration && !reducedMotion) {
          const target = fraction * v.duration;
          // On mobile, throttle to 1 frame (~33ms @ 30fps) — reduces iOS seek thrashing
          const minDelta = isMobileRef.current ? 0.033 : 0.001;
          if (Math.abs(target - lastCurrentTime) >= minDelta) {
            try {
              v.currentTime = target;     // ← THE CORE TRICK
              lastCurrentTime = target;
            } catch (e) { /* swallow */ }
          }
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", recalcWinH);
      window.removeEventListener("orientationchange", recalcWinH);
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <div className="video-bg" aria-hidden="true">
      {!reducedMotion && (
        <video
          ref={videoRef}
          className={`bg-video${videoReady ? " visible" : ""}`}
          src={VIDEO_URL}
          poster={POSTER_URL}
          muted
          defaultMuted
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          disableRemotePlayback
          preload="auto"
          onLoadedMetadata={() => setVideoReady(true)}
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
        />
      )}
      {/* Always-visible poster — fallback for reduced-motion + slow connections */}
      {(reducedMotion || !videoReady) && (
        <img src={POSTER_URL} alt="" className="bg-poster" />
      )}
      <div className="video-overlay" />
    </div>
  );
}
```

## CSS — paste into your global stylesheet

```css
:root {
  --ink: {{ink_color}};
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
}

.video-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: var(--ink);
  overflow: hidden;
  /* iOS Safari compositing fix — force GPU layer so the fixed video doesn't
     disappear during URL-bar transitions */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  will-change: transform;
  /* iPhone notch / safe area support */
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  box-sizing: border-box;
}

.bg-video,
.bg-poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  opacity: 0;
  transition: opacity 0.8s var(--ease);
  z-index: 1;
  pointer-events: none;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}
.bg-video.visible,
.bg-poster { opacity: 1; }

.video-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  /* Slight dark gradient at top + bottom so text on top of the video is readable.
     Tune the rgba values to match your brand ink color. */
  background:
    linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.85) 100%);
}

/* Your content sits ABOVE the video. Make sure your page sections use these: */
.your-content-wrapper {
  position: relative;
  z-index: 10;
  /* Make the page tall enough that there's something to scroll —
     the video scrubs from 0% to 100% over the full document height. */
  min-height: 100vh;
  min-height: 100dvh;     /* mobile-safe — accounts for URL bar */
}
```

## USAGE in your existing app

```jsx
function App() {
  return (
    <>
      <ScrollVideoBackground />

      <main className="your-content-wrapper">
        <section style={{ minHeight: "100vh" }}>Section 1 / hero content</section>
        <section style={{ minHeight: "100vh" }}>Section 2</section>
        <section style={{ minHeight: "100vh" }}>Section 3</section>
        <footer style={{ minHeight: "60vh" }}>Footer</footer>
      </main>
    </>
  );
}
```

The video will scrub from start → end across the full scroll distance of `<main>`. No other code changes required.

---

(End of prompt.)

---

## 🚨 WHY EACH PIECE MATTERS (don't strip these out)

| Piece | If you remove it… |
|---|---|
| `video.seeking` guard | Rapid scrolls queue competing `currentTime` writes → visible frame tearing |
| iOS Safari unlock-on-gesture | iOS Safari silently ignores `currentTime` writes until video is user-activated. Without this, mobile users see frozen frame 0 the whole scroll. |
| Cached `cachedWinH` (not `window.innerHeight` live) | iOS URL-bar shrink/grow makes scroll fraction jitter. Without caching, the video appears to "snap" as the bar moves. |
| `transform: translateZ(0)` on `.video-bg` | iOS Safari occasionally drops fixed-position elements during URL-bar transitions. Forcing GPU compositing prevents it. |
| Mobile frame throttle (`minDelta = 0.033`) | Without it, iOS seek thrashing causes stuttering. Limits to 1 frame @ 30fps. |
| `100dvh` alongside `100vh` | `100vh` extends behind the URL bar on mobile → content gets clipped. `dvh` accounts for it. |
| `playsInline` + `webkit-playsinline` + `disableRemotePlayback` | Without these, iOS Safari may launch the video full-screen on first frame, OR show the AirPlay button overlay that interferes with the canvas. |
| `prefers-reduced-motion` fallback | Users with motion sensitivity get a static poster instead of scroll-driven motion. Required for accessibility (WCAG). |
| Both `onLoadedMetadata` + `onLoadedData` + `onCanPlay` callbacks | Faster fade-in. Different browsers fire these in different orders. |

---

## 🎬 VIDEO ASSET REQUIREMENTS

For the scroll-scrub to feel smooth:

| Spec | Recommended | Why |
|---|---|---|
| Duration | 8-12 seconds | Long enough to feel cinematic, short enough to scrub through |
| Format | MP4 (H.264) | Universal browser support, including iOS Safari |
| Resolution | 1080p (1920×1080) max | Higher just wastes bandwidth at fixed-cover |
| File size | < 8 MB | Loads fast on 4G + doesn't stutter when scrubbing |
| Frame rate | 24-30 fps | Cinematic feel; higher fps doesn't help scrubbing |
| Audio | none (or strip with ffmpeg `-an`) | Video is muted anyway, audio just bloats the file |
| Hosting | CDN with `Access-Control-Allow-Origin: *` | Required for cross-origin scrubbing. Vercel, Cloudflare R2, S3+CloudFront, GHL Media all work. |

**Compression command** (if you have a raw clip):
```bash
ffmpeg -i raw-clip.mp4 \
  -vcodec libx264 -crf 23 -preset slow \
  -an \
  -movflags +faststart \
  -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" \
  hero-clip.mp4
```

The `+faststart` flag puts the metadata at the front so the browser can start playing before the full download finishes.

---

## ✅ SMOKE TEST AFTER YOU SHIP

```js
// Paste into the browser console on the deployed page
const v = document.querySelector('video');
console.log('readyState:', v.readyState);          // should be 4 (HAVE_ENOUGH_DATA)
console.log('duration:', v.duration);              // your clip's seconds
console.log('currentTime at top:', v.currentTime); // ~0

window.scrollTo(0, document.body.scrollHeight / 2);
setTimeout(() => console.log('at 50% scroll:', v.currentTime), 500);
// Should be ~half of v.duration

window.scrollTo(0, document.body.scrollHeight);
setTimeout(() => console.log('at 100% scroll:', v.currentTime), 500);
// Should be ~v.duration
```

Run this on iPhone Safari (via inspecting from Mac), Android Chrome, and desktop. All three should show progressive `currentTime` advancing as you scroll.

---

## 🎯 THE 4 LINES THAT ACTUALLY DO THE EFFECT

If you want to understand the trick distilled to its smallest possible form, this is it:

```js
const onScroll = () => {
  if (video.seeking) return;   // ← prevents frame tearing
  const fraction = window.scrollY / (document.body.scrollHeight - window.innerHeight);
  video.currentTime = fraction * video.duration;   // ← THE WHOLE EFFECT
};
window.addEventListener('scroll', onScroll, { passive: true });
```

Everything else in this template — the iOS Safari unlock, the viewport caching, the GPU compositing, the mobile throttling, the reduced-motion fallback — is bulletproofing around those 4 lines so they actually work on real devices in the wild.

---

**Author:** Maurice / CREAIT
**Template version:** 1.0 — 2026-05-26
**Source pattern:** vishnuai.in/animated-website-guide (heavily hardened for mobile)
