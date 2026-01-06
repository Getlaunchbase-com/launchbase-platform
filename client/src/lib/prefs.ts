/**
 * LaunchBase Preferences - Single Source of Truth
 * Manages language and audience selection across the site
 */

export type Language = "en" | "es" | "pl";
export type Audience = "biz" | "org";

// Storage key (single source of truth)
const KEY = "launchbase:prefs:v1";

type Prefs = {
  language: Language;
  audience: Audience;
  languageExplicit?: boolean;
  audienceExplicit?: boolean;
};

const DEFAULTS: Prefs = {
  language: "en",
  audience: "biz",
  languageExplicit: false,
  audienceExplicit: false,
};

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);

    const language: Language =
      parsed?.language === "es" || parsed?.language === "pl" ? parsed.language : "en";

    const audience: Audience = parsed?.audience === "org" ? "org" : "biz";

    // Backward-compat: default explicit flags to false if missing
    const languageExplicit = parsed?.languageExplicit === true;
    const audienceExplicit = parsed?.audienceExplicit === true;

    return { language, audience, languageExplicit, audienceExplicit };
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
    languageExplicit: next.languageExplicit ?? curr.languageExplicit,
    audienceExplicit: next.audienceExplicit ?? curr.audienceExplicit,
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

// ============================================================================
// Browser Language Auto-Detection (Forever-Safe)
// ============================================================================

/**
 * Detect language from browser navigator (read-only helper).
 * Forever rule: Detection = suggestion, User choice = authority.
 */
export function detectLanguageFromNavigator(): Language {
  if (typeof window === "undefined") return "en";
  const nav = (navigator.language || "en").toLowerCase();
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("pl")) return "pl";
  return "en";
}

/**
 * Read language for app boot/initialization.
 * Uses explicit choice if exists, otherwise detects from browser.
 */
export function readLanguageForBoot(): Language {
  const prefs = getPrefs();
  if (prefs.language && prefs.languageExplicit) return prefs.language;
  return detectLanguageFromNavigator();
}

/**
 * Set language explicitly (marks as user choice, disables auto-detection).
 */
export function setLanguage(lang: Language) {
  if (typeof window === "undefined") return;
  const curr = getPrefs();
  setPrefs({
    ...curr,
    language: lang,
    languageExplicit: true,
  });
}

/**
 * Set audience explicitly (marks as user choice).
 */
export function setAudience(aud: Audience) {
  if (typeof window === "undefined") return;
  const curr = getPrefs();
  setPrefs({
    ...curr,
    audience: aud,
    audienceExplicit: true,
  });
}

// ============================================================================
// Legacy exports for backward compatibility (will be removed later)
// ============================================================================
export const getLangFromUrlOrStorage = () => getPrefs().language;
export const getAudienceFromUrlOrStorage = () => getPrefs().audience;
export const setLang = setLanguage; // Now uses explicit tracking
export const setAud = setAudience; // Now uses explicit tracking
