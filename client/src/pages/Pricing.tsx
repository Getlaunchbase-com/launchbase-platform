import { Link } from "wouter";
import { ArrowRight, Check, Info } from "lucide-react";
import { useState } from "react";

export default function Pricing() {
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img src="/logo-cropped.png" alt="LaunchBase" className="h-8 w-auto" />
          </Link>
          <Link 
            href="#plans"
            className="rounded-xl bg-[#FF6A00] px-4 py-2 text-sm font-medium text-black hover:brightness-110 transition"
          >
            Choose plan
          </Link>
        </div>
      </nav>

      <div className="pt-28 pb-20">
        <div className="mx-auto max-w-6xl px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 mb-4">
              Pricing
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Pick a tier. Get a site that's ready to ship.
            </h1>
            <p className="mt-4 text-lg text-white/70 max-w-2xl mx-auto">
              Standard is a polish pass. Growth adds conversion improvements. Premium is a full UI transformation with Builder execution.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4">
              <Link 
                href="#plans"
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 text-base font-medium text-black hover:brightness-110 transition"
              >
                Choose plan
              </Link>
              <Link 
                href="/how-it-works"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-base font-medium text-white hover:bg-white/5 transition"
              >
                How it works
              </Link>
            </div>
          </div>

          {/* Tier Plans */}
          <div id="plans" className="mb-20">
            <h2 className="text-3xl font-semibold mb-4 text-center">Plans</h2>
            <p className="text-white/60 text-center mb-12">
              Choose the tier that matches how much change you want.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              <TierCard
                tier="standard"
                label="Standard"
                badge="Polish pass"
                summary="Tighten messaging, improve hierarchy, clearer CTA."
                includedCredits={1}
                loops="1 initial loop"
                builder="No (showroom preview only)"
                highlights={[
                  "Messaging cleanup",
                  "Spacing + hierarchy improvements",
                  "CTA clarity"
                ]}
                ctaHref="/intake?tier=standard"
              />
              <TierCard
                tier="growth"
                label="Growth"
                badge="Conversion pass"
                summary="Everything in Standard plus trust + proof improvements."
                includedCredits={3}
                loops="2–3 initial loops"
                builder="No (showroom preview only)"
                highlights={[
                  "Trust strip + proof elements",
                  "Outcome bullets + clarity improvements",
                  "More iteration loops"
                ]}
                ctaHref="/intake?tier=growth"
              />
              <TierCard
                tier="premium"
                label="Premium"
                badge="Full transformation"
                summary="Premium positioning + design system + strongest hierarchy."
                includedCredits={10}
                loops="5–10 initial loops"
                builder="Yes (UI execution allowed on marketing surfaces)"
                highlights={[
                  "Design system consistency",
                  "Premium layout + positioning",
                  "Builder execution + pressure testing"
                ]}
                ctaHref="/intake?tier=premium"
                recommended
              />
            </div>
          </div>

          {/* Credits Explainer */}
          <div className="mb-20 rounded-2xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-semibold mb-4">Revisions & credits</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-white/80 mb-2">Each "Request changes" consumes 1 credit.</p>
              </div>
              <div>
                <p className="text-white/80 mb-2">"Approve" consumes 0 credits.</p>
              </div>
              <div>
                <p className="text-white/80 mb-2">When credits run out, you can buy more.</p>
              </div>
            </div>
            <p className="text-sm text-white/60">
              Credits limit iteration so the process stays fast and focused.
            </p>
            <div className="mt-4 space-y-2 text-sm text-white/60">
              <p>• No unlimited back-and-forth.</p>
              <p>• Every loop is pressure-tested before it's shown as ready.</p>
            </div>
          </div>

          {/* Add-On Engines */}
          <div className="mb-20">
            <h2 className="text-3xl font-semibold mb-4 text-center">Add-On Engines</h2>
            <p className="text-white/60 text-center mb-12">
              Optional upgrades that connect your business systems. Each has setup + ongoing care.
            </p>
            
            <div className="grid md:grid-cols-3 lg:grid-cols-3 gap-6">
              <EngineCard
                id="engine-inbox"
                name="Inbox Engine"
                tagline="Never miss a lead. Auto-reply + route."
                setupValue="Quoted"
                careValue="From $/mo"
                creditsImpact="Typical: +1 loop"
                bullets={[
                  "Business email setup + deliverability basics",
                  "Autoresponder + lead routing",
                  "Templates for quotes / scheduling / FAQs"
                ]}
                details={{
                  whatItDoes: [
                    "Sets up business email and ensures leads land reliably.",
                    "Auto-responds instantly and routes requests to the right place."
                  ],
                  requires: ["Domain access (DNS)", "Mailbox provider (Google Workspace / Microsoft 365 or preferred)"],
                  defaultAutomations: ["Instant reply", "Missed-lead follow-up", "Internal notify"],
                  maintenance: ["Inbox rules tuning", "Template updates", "Light deliverability monitoring"],
                  oftenUsedWith: ["Phone Engine", "Ads Engine"]
                }}
                isSelected={selectedEngine === "engine-inbox"}
                onSelect={() => setSelectedEngine(selectedEngine === "engine-inbox" ? null : "engine-inbox")}
              />
              <EngineCard
                id="engine-phone"
                name="Phone Engine"
                tagline="Forward calls + capture missed callers."
                setupValue="Quoted"
                careValue="From $/mo"
                creditsImpact="Typical: +1 loop"
                bullets={[
                  "Call forwarding / routing by hours",
                  "Missed-call follow-up via SMS/email",
                  "Optional call tracking"
                ]}
                details={{
                  whatItDoes: [
                    "Routes calls correctly and turns missed calls into follow-ups.",
                    "Adds lightweight tracking where needed."
                  ],
                  requires: ["Carrier/forwarding access or provider connection"],
                  defaultAutomations: ["Missed-call follow-up", "After-hours message", "Call summary to inbox (optional)"],
                  maintenance: ["Routing tweaks", "Message updates", "Spam filtering"],
                  oftenUsedWith: ["Inbox Engine", "Ads Engine"]
                }}
                isSelected={selectedEngine === "engine-phone"}
                onSelect={() => setSelectedEngine(selectedEngine === "engine-phone" ? null : "engine-phone")}
              />
              <EngineCard
                id="engine-social"
                name="Social Engine"
                tagline="Stay active automatically."
                setupValue="Quoted"
                careValue="From $/mo"
                creditsImpact="Typical: +1 loop"
                bullets={[
                  "Weekly auto-post schedule",
                  "Content prompts tied to services",
                  "Optional review/request loop"
                ]}
                details={{
                  whatItDoes: [
                    "Keeps posting consistent without manual effort.",
                    "Generates a simple content cadence aligned to offers."
                  ],
                  requires: ["Social account connections (FB/IG/LinkedIn, etc.)"],
                  defaultAutomations: ["Scheduled post queue", "Before/after prompt", "Seasonal promo templates"],
                  maintenance: ["Light review", "Monthly refresh", "Offer updates"],
                  oftenUsedWith: ["Ads Engine", "Inbox Engine"]
                }}
                isSelected={selectedEngine === "engine-social"}
                onSelect={() => setSelectedEngine(selectedEngine === "engine-social" ? null : "engine-social")}
              />
              <EngineCard
                id="engine-ads"
                name="Ads Engine"
                tagline="Turn intent into booked calls."
                setupValue="Quoted"
                careValue="From $/mo"
                creditsImpact="Typical: +2 loops"
                bullets={[
                  "Google Ads starter campaign structure",
                  "Landing page alignment (CTA + copy)",
                  "Basic tracking checklist"
                ]}
                details={{
                  whatItDoes: [
                    "Sets up a starter campaign framework and aligns the landing page.",
                    "Ensures you can measure conversions correctly."
                  ],
                  requires: ["Google Ads access", "Billing method", "Conversion goal definition"],
                  defaultAutomations: ["Lead follow-up sequence", "Keyword → CTA matching checklist", "Weekly pacing guardrails (if supported)"],
                  maintenance: ["Budget pacing", "Keyword hygiene", "Landing tweaks"],
                  oftenUsedWith: ["Phone Engine", "Books Engine"]
                }}
                isSelected={selectedEngine === "engine-ads"}
                onSelect={() => setSelectedEngine(selectedEngine === "engine-ads" ? null : "engine-ads")}
              />
              <EngineCard
                id="engine-books"
                name="Books Engine"
                tagline="Lead → invoice with less chaos."
                setupValue="Quoted"
                careValue="From $/mo"
                creditsImpact="Typical: +2 loops"
                bullets={[
                  "QuickBooks connection (OAuth)",
                  "Estimate/invoice workflow (basic)",
                  "Optional payment reminders"
                ]}
                details={{
                  whatItDoes: [
                    "Connects QuickBooks and streamlines customer + invoice creation.",
                    "Adds simple reminders and workflow guardrails."
                  ],
                  requires: ["QuickBooks Online admin access (OAuth)"],
                  defaultAutomations: ["Create customer", "Draft invoice/estimate", "Reminder schedule (optional)"],
                  maintenance: ["Workflow tuning", "Category mapping checks", "Failure alerts"],
                  oftenUsedWith: ["Inbox Engine", "Phone Engine"]
                }}
                isSelected={selectedEngine === "engine-books"}
                onSelect={() => setSelectedEngine(selectedEngine === "engine-books" ? null : "engine-books")}
              />
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-white/60 mb-4">
                We'll confirm required access before setup.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 text-base font-medium text-black hover:brightness-110 transition">
                  Add an Engine
                </button>
                <button className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-base font-medium text-white hover:bg-white/5 transition">
                  Talk to us first
                </button>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-20">
            <h2 className="text-3xl font-semibold mb-12 text-center">FAQ</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <FAQItem
                question="What happens after I submit the intake?"
                answer="We generate a plan and a preview. You review it, then approve or request changes."
              />
              <FAQItem
                question="Do you deploy changes automatically?"
                answer="We deploy after approval. Some changes may require access or confirmations depending on your setup."
              />
              <FAQItem
                question="Can I buy more revisions?"
                answer="Yes. When credits are exhausted, you can purchase more credits."
              />
              <FAQItem
                question="Does Premium include Builder execution?"
                answer="Yes—Premium allows Builder execution for approved marketing UI surfaces only."
              />
            </div>
          </div>

          {/* Closing CTA */}
          <div className="text-center">
            <h2 className="text-3xl font-semibold mb-4">Ready to start?</h2>
            <p className="text-white/60 mb-6">
              Pick a tier and submit your intake. We'll generate a preview you can approve or iterate on.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link 
                href="#plans"
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 text-base font-medium text-black hover:brightness-110 transition"
              >
                Choose plan
              </Link>
              <Link 
                href="/examples"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-base font-medium text-white hover:bg-white/5 transition"
              >
                See examples
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/10">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/">
              <img src="/logo-cropped.png" alt="LaunchBase" className="h-6 w-auto opacity-60 hover:opacity-100 transition cursor-pointer" />
            </Link>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/how-it-works" className="hover:text-white transition">How It Works</Link>
              <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
              <Link href="/examples" className="hover:text-white transition">Examples</Link>
            </div>
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} LaunchBase
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TierCard({
  tier,
  label,
  badge,
  summary,
  includedCredits,
  loops,
  builder,
  highlights,
  ctaHref,
  recommended,
}: {
  tier: string;
  label: string;
  badge: string;
  summary: string;
  includedCredits: number;
  loops: string;
  builder: string;
  highlights: string[];
  ctaHref: string;
  recommended?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-6 ${
      recommended 
        ? "border-[#FF6A00] bg-[#FF6A00]/10" 
        : "border-white/10 bg-white/5"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded-full bg-white/10 text-white/80 px-3 py-1 text-xs font-medium">
          {badge}
        </span>
        {recommended && (
          <span className="rounded-full bg-[#FF6A00]/20 text-[#FF6A00] px-2 py-0.5 text-xs">
            Recommended
          </span>
        )}
      </div>
      <h3 className="text-2xl font-semibold mb-2">{label}</h3>
      <p className="text-sm text-white/70 mb-4">{summary}</p>
      
      <div className="space-y-2 mb-6 text-sm">
        <div className="flex justify-between">
          <span className="text-white/60">Credits:</span>
          <span className="text-white">{includedCredits}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Loops:</span>
          <span className="text-white">{loops}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Builder:</span>
          <span className="text-white">{builder}</span>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4 mb-6">
        <ul className="space-y-2">
          {highlights.map((highlight, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/80">
              <Check className="h-4 w-4 text-[#1ED760] mt-0.5 flex-shrink-0" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link 
        href={ctaHref}
        className="block w-full rounded-xl bg-[#FF6A00] px-4 py-3 text-center text-sm font-medium text-black hover:brightness-110 transition"
      >
        Choose {label}
      </Link>
    </div>
  );
}

interface EngineDetails {
  whatItDoes: string[];
  requires: string[];
  defaultAutomations: string[];
  maintenance: string[];
  oftenUsedWith: string[];
}

function EngineCard({
  id,
  name,
  tagline,
  setupValue,
  careValue,
  creditsImpact,
  bullets,
  details,
  isSelected,
  onSelect,
}: {
  id: string;
  name: string;
  tagline: string;
  setupValue: string;
  careValue: string;
  creditsImpact: string;
  bullets: string[];
  details: EngineDetails;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div 
      className={`rounded-2xl border p-6 cursor-pointer transition ${
        isSelected 
          ? "border-[#FF6A00] bg-[#FF6A00]/10" 
          : "border-white/10 bg-white/5 hover:border-white/20"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">{name}</h3>
          <p className="text-sm text-white/60">{tagline}</p>
        </div>
        <button className="text-white/60 hover:text-white transition">
          <Info className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-white/60 mb-1">Setup</p>
          <p className="text-white font-medium">{setupValue}</p>
        </div>
        <div>
          <p className="text-white/60 mb-1">Care</p>
          <p className="text-white font-medium">{careValue}</p>
        </div>
      </div>

      <p className="text-xs text-white/50 mb-4">{creditsImpact}</p>

      <ul className="space-y-2 mb-4">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-white/80">
            <Check className="h-4 w-4 text-[#1ED760] mt-0.5 flex-shrink-0" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {isSelected && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-4 text-sm">
          <div>
            <p className="text-white/80 font-medium mb-2">What it does:</p>
            <ul className="space-y-1 text-white/60">
              {details.whatItDoes.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-white/80 font-medium mb-2">Requires:</p>
            <ul className="space-y-1 text-white/60">
              {details.requires.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-white/80 font-medium mb-2">Maintenance:</p>
            <ul className="space-y-1 text-white/60">
              {details.maintenance.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-white/80 font-medium mb-2">Often used with:</p>
            <p className="text-white/60">{details.oftenUsedWith.join(", ")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="font-medium mb-2">{question}</h3>
      <p className="text-sm text-white/60">{answer}</p>
    </div>
  );
}
