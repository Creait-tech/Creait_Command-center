"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The one client component in the report. It exists only so the anchor number
 * counts up on screen.
 *
 * SSR-safe by construction: the server renders the FINAL value, so the printed
 * PDF, a JS-disabled browser, and a reduced-motion reader all see the real
 * score immediately. The animation only ever runs after mount, on screen, when
 * motion is welcome — and it always lands exactly on `value`.
 */
export function CountUp({
  value,
  durationMs = 1100,
}: {
  value: number;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(value);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Never animate into a print render.
    const printing = window.matchMedia("print").matches;
    if (reduced || printing || value <= 0) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // Exponential ease-out: fast off the line, settles on the number.
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <>{display}</>;
}
