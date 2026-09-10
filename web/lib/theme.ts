/**
 * Light / dark theme for the Command Center.
 *
 * Three choices, not two: a person who picks "System" is saying "follow my
 * laptop", which is a different statement from "always light" and has to
 * survive the OS flipping at sunset. `light` and `dark` are explicit and never
 * change under you.
 *
 * The choice lives in `localStorage`, per browser, because it is a preference
 * about this screen rather than a fact about the person — the same founder on
 * a bright projector and a dark office wants different answers, and neither
 * should wait on a network round trip to render.
 *
 * No stored choice means dark, which is what the app looked like before this
 * existed. Defaulting to `system` would have silently flipped every teammate
 * whose laptop is set to light, which is a change nobody asked for; opting in
 * is the only way the theme moves.
 */

export const THEME_STORAGE_KEY = "cc-theme";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_CHOICES: ThemeChoice[] = ["light", "dark", "system"];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * The script that runs before first paint.
 *
 * It has to be inline and synchronous in `<head>`: anything that waits for
 * React has already let the browser paint one frame of the wrong theme, and a
 * white flash on the way into a dark app is worse than no toggle at all.
 * Written as a string rather than a module for the same reason — it must not
 * be a separate request. Deliberately tiny, and wrapped in try/catch because
 * `localStorage` throws outright in a locked-down browser.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var d=s==="light"?false:s==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches:true;
document.documentElement.classList.toggle("dark",d);
document.documentElement.style.colorScheme=d?"dark":"light";
}catch(e){document.documentElement.classList.add("dark");}})();`;

/** Read the stored choice. Falls back to "dark" when unset or unreadable. */
export function readThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(raw) ? raw : "dark";
  } catch {
    return "dark";
  }
}

/** What a choice actually renders as right now. */
export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === "light" || choice === "dark") return choice;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Put a resolved theme on the document. The single place the class is set. */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

/**
 * The choice as an external store, so React can read it with
 * `useSyncExternalStore` instead of copying it into state inside an effect.
 * `localStorage` genuinely is an external store, and this is the primitive
 * built for one: it renders the server snapshot during hydration and swaps to
 * the real value in the same commit, with no mismatch and no cascading render.
 */
const THEME_EVENT = "cc-theme-change";

/** In-memory mirror, so `getSnapshot` is cheap and returns a stable value. */
let cachedChoice: ThemeChoice | null = null;

export function subscribeThemeChoice(onChange: () => void): () => void {
  const handle = () => {
    cachedChoice = null;
    onChange();
  };
  window.addEventListener(THEME_EVENT, handle);
  // Another tab changing the preference should move this one too.
  window.addEventListener("storage", handle);
  return () => {
    window.removeEventListener(THEME_EVENT, handle);
    window.removeEventListener("storage", handle);
  };
}

export function getThemeChoiceSnapshot(): ThemeChoice {
  if (cachedChoice === null) cachedChoice = readThemeChoice();
  return cachedChoice;
}

/** The server cannot know this browser's choice; the default until hydrated. */
export function getThemeChoiceServerSnapshot(): ThemeChoice {
  return "dark";
}

/** Persist a choice and apply it. A storage failure must not block the change. */
export function storeThemeChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // A browser with site data blocked still gets the theme for this session.
  }
  cachedChoice = choice;
  applyTheme(resolveTheme(choice));
  window.dispatchEvent(new Event(THEME_EVENT));
}
