import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { Link } from "wouter";

type TierKey = "standard" | "growth" | "premium";

interface TierInfo {
  key: TierKey;
  label: string;
  badge: string;
  summary: string;
  whatChanges: string[];
  note: string;
}

const tiers: TierInfo[] = [
  {
    key: "standard",
    label: "Standard",
    badge: "Polish pass",
    summary: "Tightened messaging, better spacing, clearer CTA hierarchy.",
    whatChanges: [
      "Cleaner hero hierarchy and CTAs",
      "Improved spacing + typography consistency",
      "Sharper above-the-fold messaging"
    ],
    note: "Best for fast cleanup and clarity improvements."
  },
  {
    key: "growth",
    label: "Growth",
    badge: "Conversion pass",
    summary: "Trust strip, outcome bullets, proof elements that increase confidence.",
    whatChanges: [
      "Outcome-driven bullets and proof elements",
      "Trust strip + credibility reinforcement",
      "More conversion-focused section ordering"
    ],
    note: "Best for turning traffic into leads."
  },
  {
    key: "premium",
    label: "Premium",
    badge: "Full transformation",
    summary: "Premium positioning, tighter design system, strongest hierarchy.",
    whatChanges: [
      "Premium positioning and narrative clarity",
      "Full-page hierarchy rebuild (not just surface polish)",
      "Design system consistency across key pages"
    ],
    note: "Best for a full redesign that looks and feels premium."
  }
];

export default function Examples() {
  const [activeTier, setActiveTier] = useState<TierKey>("standard");
  const currentTier = tiers.find(t => t.key === activeTier) || tiers[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0A0A0A] to-black text-white">
      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Real transformations by tier
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-8">
              See what LaunchBase delivers at each tier — from a quick polish pass to a full premium redesign.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/apply"
                className="inline-flex items-center justify-center gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white px-8 py-4 rounded-lg font-semibold transition"
              >
                Get started
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link 
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white px-8 py-4 rounded-lg font-semibold transition"
              >
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Tier Toggle Section */}
      <section className="py-16 md:py-20 px-4 bg-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">Choose a tier to preview</h2>
          <p className="text-center text-white/70 mb-12 max-w-2xl mx-auto">
            Each tier changes different things. Select one to see what you should expect.
          </p>
          
          {/* Tier Toggle Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {tiers.map((tier) => (
              <button
                key={tier.key}
                onClick={() => setActiveTier(tier.key)}
                className={`px-6 py-3 rounded-lg font-semibold transition min-h-[44px] ${
                  activeTier === tier.key
                    ? "bg-[#FF6A00] text-white"
                    : "bg-white/10 text-white/70 hover:bg-white/15"
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>

          {/* Active Tier Details */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-4xl mx-auto">
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wider text-white/60">{currentTier.badge}</span>
              <h3 className="text-2xl font-bold mt-2 mb-3">{currentTier.label}</h3>
              <p className="text-white/80">{currentTier.summary}</p>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-[#FF6A00]">What changes:</h4>
              <ul className="space-y-2">
                {currentTier.whatChanges.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/80">
                    <Check className="h-5 w-5 text-[#1ED760] mt-0.5 flex-shrink-0" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <p className="text-sm text-white/60 pt-4 border-t border-white/10">
              {currentTier.note}
            </p>
          </div>
        </div>
      </section>

      {/* Before/After Gallery Section */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">Before → After snapshots</h2>
          <p className="text-center text-white/70 mb-12 max-w-2xl mx-auto">
            Each tier changes different things. The patterns below show what you should expect.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Example 1: Local service business */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="mb-4">
                <h3 className="text-xl font-semibold mb-1">Local service business</h3>
                <p className="text-sm text-white/60">Home services</p>
              </div>
              
              <div className="space-y-6">
                {/* Before */}
                <div>
                  <h4 className="text-sm font-semibold text-white/60 mb-2">Before</h4>
                  <div className="bg-white/10 rounded-lg aspect-video mb-3 flex items-center justify-center text-white/40">
                    [Screenshot placeholder]
                  </div>
                  <ul className="space-y-1 text-sm text-white/70">
                    <li>• CTA hierarchy unclear</li>
                    <li>• Sections feel unstructured</li>
                    <li>• Mobile spacing inconsistent</li>
                  </ul>
                </div>
                
                {/* After */}
                <div>
                  <h4 className="text-sm font-semibold text-[#1ED760] mb-2">After</h4>
                  <div className="bg-white/10 rounded-lg aspect-video mb-3 flex items-center justify-center text-white/40">
                    [Screenshot placeholder]
                  </div>
                  <ul className="space-y-1 text-sm text-white/80">
                    <li>• Clear primary CTA and hierarchy</li>
                    <li>• Better spacing + scannability</li>
                    <li>• Mobile layout tightened</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Example 2: B2B service company */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="mb-4">
                <h3 className="text-xl font-semibold mb-1">B2B service company</h3>
                <p className="text-sm text-white/60">Professional services</p>
              </div>
              
              <div className="space-y-6">
                {/* Before */}
                <div>
                  <h4 className="text-sm font-semibold text-white/60 mb-2">Before</h4>
                  <div className="bg-white/10 rounded-lg aspect-video mb-3 flex items-center justify-center text-white/40">
                    [Screenshot placeholder]
                  </div>
                  <ul className="space-y-1 text-sm text-white/70">
                    <li>• Weak credibility signals</li>
                    <li>• Generic headline</li>
                    <li>• Proof buried below fold</li>
                  </ul>
                </div>
                
                {/* After */}
                <div>
                  <h4 className="text-sm font-semibold text-[#1ED760] mb-2">After</h4>
                  <div className="bg-white/10 rounded-lg aspect-video mb-3 flex items-center justify-center text-white/40">
                    [Screenshot placeholder]
                  </div>
                  <ul className="space-y-1 text-sm text-white/80">
                    <li>• Trust strip + outcomes</li>
                    <li>• Sharper value proposition</li>
                    <li>• Proof brought above the fold</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Empty State */}
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-8 max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-2">More examples coming soon</h3>
            <p className="text-white/70">
              We'll keep adding verified before/after case studies. For now, start an intake and we'll generate your first preview.
            </p>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className="py-16 md:py-20 px-4 bg-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">What you get at each tier</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Standard</h3>
              <ul className="space-y-3">
                {[
                  "Fast polish pass",
                  "Clearer CTA + messaging",
                  "Better spacing + hierarchy"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/80">
                    <Check className="h-5 w-5 text-[#1ED760] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Growth</h3>
              <ul className="space-y-3">
                {[
                  "Conversion-focused improvements",
                  "Trust + proof elements",
                  "Stronger section structure"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/80">
                    <Check className="h-5 w-5 text-[#1ED760] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Premium</h3>
              <ul className="space-y-3">
                {[
                  "Full premium transformation",
                  "Design system consistency",
                  "Highest-impact page hierarchy"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/80">
                    <Check className="h-5 w-5 text-[#1ED760] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center text-sm text-white/60 mt-8">
            Revisions are credit-based. Approving is always free.
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Want your before → after?</h2>
          <p className="text-xl text-white/70 mb-8">
            Submit your intake and we'll generate your first preview.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/apply"
              className="inline-flex items-center justify-center gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white px-8 py-4 rounded-lg font-semibold transition"
            >
              Get started
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link 
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white px-8 py-4 rounded-lg font-semibold transition"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
