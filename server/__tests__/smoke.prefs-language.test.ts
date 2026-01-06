/**
 * Smoke test: Browser language auto-detection with explicit choice tracking
 * 
 * Forever rule: Detection = suggestion, User choice = authority
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock localStorage for Node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

// Mock window
const windowMock = {
  localStorage: localStorageMock,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

// Setup global mocks
beforeEach(() => {
  vi.stubGlobal("window", windowMock);
  vi.stubGlobal("localStorage", localStorageMock);
  localStorageMock.clear();
  // Clear module cache so each test gets fresh imports
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorageMock.clear();
});

describe("Browser Language Auto-Detection", () => {
  it("should auto-detect Spanish from navigator on first visit", async () => {
    // Arrange: Set navigator to Spanish
    vi.stubGlobal("navigator", { language: "es-ES" });

    // Import after mocks are set up
    const { readLanguageForBoot } = await import("../../client/src/lib/prefs");

    // Act
    const detectedLang = readLanguageForBoot();

    // Assert
    expect(detectedLang).toBe("es");
  });

  it("should auto-detect Polish from navigator on first visit", async () => {
    // Arrange: Set navigator to Polish
    vi.stubGlobal("navigator", { language: "pl-PL" });

    // Import after mocks are set up
    const { readLanguageForBoot } = await import("../../client/src/lib/prefs");

    // Act
    const detectedLang = readLanguageForBoot();

    // Assert
    expect(detectedLang).toBe("pl");
  });

  it("should default to English for unsupported languages", async () => {
    // Arrange: Set navigator to French (unsupported)
    vi.stubGlobal("navigator", { language: "fr-FR" });

    // Import after mocks are set up
    const { readLanguageForBoot } = await import("../../client/src/lib/prefs");

    // Act
    const detectedLang = readLanguageForBoot();

    // Assert
    expect(detectedLang).toBe("en");
  });

  it("FOREVER RULE: explicit choice beats navigator detection", async () => {
    // Arrange: Set navigator to Spanish
    vi.stubGlobal("navigator", { language: "es-ES" });

    // Import after mocks are set up
    const { readLanguageForBoot, setLanguage, getPrefs } = await import(
      "../../client/src/lib/prefs"
    );

    // Act 1: First visit - should detect Spanish
    const firstVisit = readLanguageForBoot();
    expect(firstVisit).toBe("es");

    // Act 2: User explicitly chooses English
    setLanguage("en");

    // Act 3: Change navigator back to Spanish (simulate browser language change)
    vi.stubGlobal("navigator", { language: "es-MX" });

    // Act 4: Check language again
    const afterExplicitChoice = readLanguageForBoot();

    // Assert: Explicit choice (EN) wins over navigator (ES)
    expect(afterExplicitChoice).toBe("en");

    // Verify explicit flag is set
    const prefs = getPrefs();
    expect(prefs.languageExplicit).toBe(true);
  });

  it("should persist explicit choice across page refreshes", async () => {
    // Arrange: Set navigator to Spanish
    vi.stubGlobal("navigator", { language: "es-ES" });

    // Import after mocks are set up
    const { setLanguage, readLanguageForBoot } = await import(
      "../../client/src/lib/prefs"
    );

    // Act 1: User explicitly chooses Polish
    setLanguage("pl");

    // Act 2: Simulate page refresh by re-reading prefs
    const afterRefresh = readLanguageForBoot();

    // Assert: Polish persists even though navigator says Spanish
    expect(afterRefresh).toBe("pl");
  });

  it("should handle missing navigator.language gracefully", async () => {
    // Arrange: Remove navigator.language
    vi.stubGlobal("navigator", { language: undefined });

    // Import after mocks are set up
    const { detectLanguageFromNavigator } = await import(
      "../../client/src/lib/prefs"
    );

    // Act
    const detectedLang = detectLanguageFromNavigator();

    // Assert: Should default to English
    expect(detectedLang).toBe("en");
  });
});
