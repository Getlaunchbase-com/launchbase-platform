import { Link } from "wouter";
import { ArrowRight, Eye, Brain, Shield, Zap, Check } from "lucide-react";

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img src="/logo-cropped.png" alt="LaunchBase" className="h-8 w-auto" />
          </Link>
          <Link 
            href="/apply"
            className="rounded-xl bg-[#FF6A00] px-4 py-2 text-sm font-medium text-black hover:brightness-110 transition"
          >
            Apply now
          </Link>
        </div>
      </nav>

      <div className="pt-28 pb-20">
        <div className="mx-auto max-w-4xl px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 mb-4">
              <span className="h-2 w-2 rounded-full bg-[#1ED760]" />
              Automation without abdication
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">
              How LaunchBase works
            </h1>
            <p className="mt-4 text-lg text-white/70 max-w-2xl mx-auto">
              LaunchBase observes what's happening around your business and acts only when it matters — with your approval.
            </p>
          </div>

          {/* The Loop */}
          <div className="mb-20">
            <h2 className="text-2xl font-semibold mb-8 text-center">The Intelligence Loop</h2>
            
            <div className="grid md:grid-cols-4 gap-6">
              <LoopStep
                icon={<Eye className="h-6 w-6" />}
                title="Observe"
                description="LaunchBase monitors weather, events, and local context around your business 24/7."
                color="#FF6A00"
              />
              <LoopStep
                icon={<Brain className="h-6 w-6" />}
                title="Decide"
                description="Our system determines if there's a relevant, safe moment to engage your audience."
                color="#1ED760"
              />
              <LoopStep
                icon={<Shield className="h-6 w-6" />}
                title="Approve"
                description="You review and approve posts before they go live. Nothing happens without your say."
                color="#3B82F6"
              />
              <LoopStep
                icon={<Zap className="h-6 w-6" />}
                title="Act"
                description="Approved content posts automatically at the optimal time for maximum impact."
                color="#A855F7"
              />
            </div>
          </div>

          {/* What makes it different */}
          <div className="mb-20">
            <h2 className="text-2xl font-semibold mb-8 text-center">What makes it different</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <DifferenceCard
                title="Silence is valid output"
                description="Most automation tools spam your audience. LaunchBase knows when NOT to post. If there's nothing relevant to say, we say nothing."
              />
              <DifferenceCard
                title="Weather-aware and safety-gated"
                description="Every post passes through weather and safety checks. We'll never post about a fun event during a local emergency."
              />
              <DifferenceCard
                title="Local context, not generic content"
                description="We reference what's actually happening in your area — game days, school schedules, community events — not generic marketing copy."
              />
              <DifferenceCard
                title="You're always in control"
                description="Choose Auto, Guided, or Custom mode. Approve individual posts or set rules. Change your mind anytime."
              />
            </div>
          </div>

          {/* Control Modes */}
          <div className="mb-20">
            <h2 className="text-2xl font-semibold mb-8 text-center">Choose your control level</h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              <ModeCard
                title="Auto"
                description="LaunchBase handles everything. You approve major changes only."
                features={[
                  "Hands-off operation",
                  "Weekly summary emails",
                  "Override anytime",
                ]}
              />
              <ModeCard
                title="Guided"
                description="Review and approve posts before they go live."
                features={[
                  "Preview every post",
                  "Edit before publishing",
                  "Suggested alternatives",
                ]}
                recommended
              />
              <ModeCard
                title="Custom"
                description="Full control with guardrails. For advanced users."
                features={[
                  "Set custom rules",
                  "Adjust cadence",
                  "Fine-tune triggers",
                ]}
              />
            </div>
          </div>

          {/* Pricing Preview */}
          <div className="mb-20 rounded-2xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-semibold mb-2 text-center">Simple, transparent pricing</h2>
            <p className="text-white/60 text-center mb-8">
              Choose your cadence. Add context layers. That's it.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <PricingTier
                name="Low"
                price={79}
                frequency="1–2 posts/week"
                description="Stay present without noise"
              />
              <PricingTier
                name="Medium"
                price={129}
                frequency="2–3 posts/week"
                description="Balanced, timely presence"
                recommended
              />
              <PricingTier
                name="High"
                price={199}
                frequency="4–6 posts/week"
                description="Maximum visibility"
              />
            </div>

            <div className="text-center text-sm text-white/60">
              <p>Add local context layers: Sports (+$29/mo) • Community (+$39/mo) • Trends (+$49/mo)</p>
              <p className="mt-1">One-time setup: $249 base + $99 per layer</p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4">Ready to get started?</h2>
            <p className="text-white/60 mb-6">
              Apply in 3–5 minutes. Preview before anything goes live.
            </p>
            <Link 
              href="/apply"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 text-base font-medium text-black hover:brightness-110 transition"
            >
              Apply for LaunchBase
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoopStep({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <div 
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </div>
      <h3 className="font-medium mb-2">{title}</h3>
      <p className="text-sm text-white/60">{description}</p>
    </div>
  );
}

function DifferenceCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="font-medium mb-2">{title}</h3>
      <p className="text-sm text-white/60">{description}</p>
    </div>
  );
}

function ModeCard({
  title,
  description,
  features,
  recommended,
}: {
  title: string;
  description: string;
  features: string[];
  recommended?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-6 ${
      recommended 
        ? "border-[#FF6A00] bg-[#FF6A00]/10" 
        : "border-white/10 bg-white/5"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-medium">{title}</h3>
        {recommended && (
          <span className="rounded-full bg-[#FF6A00]/20 text-[#FF6A00] px-2 py-0.5 text-xs">
            Most popular
          </span>
        )}
      </div>
      <p className="text-sm text-white/60 mb-4">{description}</p>
      <ul className="space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-white/80">
            <Check className="h-4 w-4 text-[#1ED760]" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PricingTier({
  name,
  price,
  frequency,
  description,
  recommended,
}: {
  name: string;
  price: number;
  frequency: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-6 text-center ${
      recommended 
        ? "border-[#FF6A00] bg-[#FF6A00]/10" 
        : "border-white/10 bg-white/5"
    }`}>
      <div className="flex items-center justify-center gap-2 mb-2">
        <h3 className="font-medium">{name}</h3>
        {recommended && (
          <span className="rounded-full bg-[#FF6A00]/20 text-[#FF6A00] px-2 py-0.5 text-xs">
            Recommended
          </span>
        )}
      </div>
      <div className="text-3xl font-semibold mb-1">${price}<span className="text-lg text-white/60">/mo</span></div>
      <div className="text-sm text-white/60 mb-2">{frequency}</div>
      <p className="text-xs text-white/50">{description}</p>
    </div>
  );
}
