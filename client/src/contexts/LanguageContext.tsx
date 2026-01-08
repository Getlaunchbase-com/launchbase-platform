import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation } from "wouter";

export type Language = "en" | "es" | "pl";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "launchbase_language";

function getInitialLanguage(): Language {
  // 1. Check URL parameter (?lang=es)
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get("lang");
  if (urlLang === "es" || urlLang === "pl" || urlLang === "en") {
    return urlLang;
  }

  // 2. Check localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "es" || stored === "pl" || stored === "en") {
    return stored;
  }

  // 3. Default to English
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const [, setLocation] = useLocation();

  // Persist language changes to localStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  // Sync URL parameter on mount (if present)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    if (urlLang === "es" || urlLang === "pl" || urlLang === "en") {
      if (urlLang !== language) {
        setLanguage(urlLang);
      }
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
