/**
 * LaunchBase Preferences - Single Source of Truth
 * Manages language and audience selection across the site
 */

export type Language = "en" | "es" | "pl";
export type Audience = "biz" | "org";

const KEY = "launchbase:prefs:v1";

type Prefs = { language: Language; audience: Audience };

const DEFAULTS: Prefs = { language: "en", audience: "biz" };

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);

    const language: Language =
      parsed?.language === "es" || parsed?.language === "pl" ? parsed.language : "en";

    const audience: Audience = parsed?.audience === "org" ? "org" : "biz";

    return { language, audience };
  } catch {
    return DEFAULTS;
  }
}

export function setPrefs(next: Partial<Prefs>) {
  if (typeof window === "undefined") return;
  const curr = getPrefs();
  const merged: Prefs = {
    language: next.language ?? curr.language,
    audience: next.audience ?? curr.audience,
  };
  localStorage.setItem(KEY, JSON.stringify(merged));
  // Dispatch custom event for same-page reactivity
  window.dispatchEvent(new CustomEvent("launchbase:prefs"));
}

export function subscribePrefs(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  // Listen for same-page changes
  const customHandler = () => callback();
  window.addEventListener("launchbase:prefs", customHandler);
  // Also listen for cross-tab changes
  const storageHandler = (e: StorageEvent) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener("launchbase:prefs", customHandler);
    window.removeEventListener("storage", storageHandler);
  };
}

// Legacy exports for backward compatibility (will be removed later)
export const getLangFromUrlOrStorage = () => getPrefs().language;
export const getAudienceFromUrlOrStorage = () => getPrefs().audience;
export const setLang = (lang: Language) => setPrefs({ language: lang });
export const setAudience = (aud: Audience) => setPrefs({ audience: aud });
