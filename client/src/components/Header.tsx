import { useEffect, useState } from "react";
import { getPrefs, setPrefs, subscribePrefs, type Audience, type Language } from "@/lib/prefs";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Building2 } from "lucide-react";

export function Header() {
  const [prefs, setLocal] = useState(() => getPrefs());

  useEffect(() => subscribePrefs(() => setLocal(getPrefs())), []);
  useEffect(() => {
    // keep same-tab changes in sync too
    setLocal(getPrefs());
  }, []);

  function updateLanguage(language: Language) {
    console.log('[Header] updateLanguage called:', language);
    setPrefs({ language });
    setLocal(getPrefs());
    console.log('[Header] prefs updated:', getPrefs());
  }

  function updateAudience(audience: Audience) {
    console.log('[Header] updateAudience called:', audience);
    setPrefs({ audience });
    setLocal(getPrefs());
    console.log('[Header] prefs updated:', getPrefs());
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
      <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center flex-1 mr-4 md:flex-none md:mr-0">
          <Link href="/">
            <img src="/logo-cropped.png" alt="LaunchBase" className="h-10 w-auto md:h-8 cursor-pointer" />
          </Link>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <Link href="/how-it-works" className="text-sm text-gray-400 hover:text-white transition">
            How It Works
          </Link>
          <Link href="/expand" className="text-sm text-gray-400 hover:text-white transition">
            Expand
          </Link>
          <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition">
            Pricing
          </a>
        </div>

        <div className="flex items-center gap-3">
          {/* Audience Selector */}
          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={prefs.audience}
              onChange={(e) => updateAudience(e.target.value as Audience)}
              className="bg-transparent text-sm text-white border-none outline-none cursor-pointer"
            >
              <option value="biz" className="bg-[#1a1a1d] text-white">Business</option>
              <option value="org" className="bg-[#1a1a1d] text-white">Organization</option>
            </select>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            <Globe className="w-4 h-4 text-gray-400" />
            <select
              value={prefs.language}
              onChange={(e) => updateLanguage(e.target.value as Language)}
              className="bg-transparent text-sm text-white border-none outline-none cursor-pointer"
            >
              <option value="en" className="bg-[#1a1a1d] text-white">EN</option>
              <option value="es" className="bg-[#1a1a1d] text-white">ES</option>
              <option value="pl" className="bg-[#1a1a1d] text-white">PL</option>
            </select>
          </div>

          <Link href="/apply">
            <Button className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white">
              Hand It Off <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
