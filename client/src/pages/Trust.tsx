import { Link } from "wouter";
import { ArrowLeft, Shield, Eye, Lock, MessageSquare, Clock, CreditCard, ChevronRight } from "lucide-react";

export default function Trust() {
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
        <div className="mx-auto max-w-3xl px-4">
          {/* Back Link */}
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-8 transition">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          {/* Hero */}
          <div className="mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 mb-4">
              <Shield className="h-3 w-3" />
              Our Commitments
            </div>
            <h1 className="text-4xl font-semibold tracking-tight mb-4">
              What we promise
            </h1>
            <p className="text-lg text-white/70">
              This isn't marketing copy. These are binding commitments that shape every feature, every decision, and every line of code.
            </p>
          </div>

          {/* Core Promise */}
          <div className="mb-16 p-8 rounded-2xl border border-[#FF6A00]/30 bg-[#FF6A00]/5">
            <p className="text-xl font-medium text-center">
              "You can always see what LaunchBase is doing — and change it anytime."
            </p>
          </div>

          {/* Commitments Grid */}
          <div className="space-y-12 mb-16">
            <CommitmentSection
              icon={<Eye className="h-6 w-6" />}
              title="Transparency of Decisions"
              description="Every action LaunchBase takes on behalf of your business is logged and visible."
              items={[
                { label: "Posts published", detail: "Content, timestamp, and trigger reason — all visible" },
                { label: "Posts silenced", detail: "Why we stayed quiet, with full context" },
                { label: "Decisions made", detail: "Weather, safety, and relevance factors explained" },
                { label: "Configuration changes", detail: "What changed, when, and by whom" },
              ]}
              commitment="No decision happens in the dark. Silence is logged as carefully as action."
            />

            <CommitmentSection
              icon={<Shield className="h-6 w-6" />}
              title="Safety as Non-Negotiable"
              description="Certain rules cannot be disabled by any customer, regardless of plan or preference."
              items={[
                { label: "No political content", detail: "Never posts about elections, candidates, or partisan issues" },
                { label: "No tragedy exploitation", detail: "Never references deaths, disasters, or sensitive events" },
                { label: "Weather gating", detail: "Outdoor recommendations blocked during dangerous conditions" },
                { label: "Brand protection", detail: "No content that could damage your reputation" },
              ]}
              commitment="Controls change relevance — not safety. Weather, safety, and brand protection are always enforced."
            />

            <CommitmentSection
              icon={<Lock className="h-6 w-6" />}
              title="Customer Control"
              description="You retain full control over your LaunchBase configuration at all times."
              items={[
                { label: "Cadence", detail: "Change posting frequency anytime" },
                { label: "Context layers", detail: "Enable or disable any layer anytime" },
                { label: "Approval mode", detail: "Switch between Auto, Guided, or Custom anytime" },
                { label: "Cancel service", detail: "No contracts, no penalties, no lock-in" },
              ]}
              commitment="Nothing is permanent. You can change cadence, context, or pause posting at any time."
            />

            <CommitmentSection
              icon={<MessageSquare className="h-6 w-6" />}
              title="Explainability Over Complexity"
              description="LaunchBase will never hide behind 'the algorithm.'"
              items={[
                { label: "Instead of 'The AI decided'", detail: "We say: 'We stayed silent because of the incoming storm'" },
                { label: "Instead of 'Based on our model'", detail: "We say: 'We posted because the Bears game starts in 2 hours'" },
                { label: "Instead of 'Optimized for engagement'", detail: "We say: 'We chose this timing because your customers are most active'" },
              ]}
              commitment="If we can't explain it simply, we won't do it."
            />
          </div>

          {/* What You Can Expect */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold mb-8">What you can expect</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <ExpectationCard
                icon={<Clock className="h-5 w-5" />}
                title="Response Times"
                items={[
                  "Configuration changes: Immediate",
                  "Support questions: Within 24 hours",
                  "Founding clients: Same day",
                  "Critical issues: Within 4 hours",
                ]}
              />
              <ExpectationCard
                icon={<CreditCard className="h-5 w-5" />}
                title="Pricing Integrity"
                items={[
                  "No hidden fees — price shown is price charged",
                  "No surprise increases",
                  "Founding client pricing locked 12 months",
                  "No penalties for changes",
                ]}
              />
            </div>
          </div>

          {/* Escalation */}
          <div className="mb-16 rounded-2xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-xl font-semibold mb-6">When something goes wrong</h2>
            
            <div className="space-y-4">
              <EscalationLevel
                level="1"
                title="Self-Service"
                description="View decision logs, adjust configuration, pause posting — all instant"
              />
              <EscalationLevel
                level="2"
                title="Support"
                description="Email support with full access to your decision history"
              />
              <EscalationLevel
                level="3"
                title="Founder Escalation"
                description="For founding clients and critical issues affecting reputation"
              />
              <EscalationLevel
                level="4"
                title="Service Credit"
                description="If we fail our commitments: full month credit or refund"
              />
            </div>
          </div>

          {/* The Test */}
          <div className="mb-16 text-center">
            <h2 className="text-xl font-semibold mb-4">The Test</h2>
            <p className="text-white/70 mb-6">
              Before shipping any feature, we ask ourselves:
            </p>
            <blockquote className="text-lg italic text-white/80 border-l-2 border-[#FF6A00] pl-6 text-left max-w-xl mx-auto">
              "Would I be comfortable if this happened to my business without my knowledge?"
            </blockquote>
            <p className="text-sm text-white/50 mt-4">
              If the answer is no, the feature doesn't ship until it passes.
            </p>
          </div>

          {/* Footer Quote */}
          <div className="text-center pt-8 border-t border-white/10">
            <p className="text-sm text-white/50 italic mb-6">
              "You're not buying software. You're deciding how much responsibility to hand off."
            </p>
            <p className="text-xs text-white/40">
              This contract ensures that whatever you hand off, you can always take back.
            </p>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Link 
              href="/apply"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-6 py-3 text-base font-medium text-black hover:brightness-110 transition"
            >
              Apply for LaunchBase
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommitmentSection({
  icon,
  title,
  description,
  items,
  commitment,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: { label: string; detail: string }[];
  commitment: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-[#FF6A00]/10 text-[#FF6A00]">
          {icon}
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <p className="text-white/70 mb-6">{description}</p>
      
      <div className="space-y-3 mb-6">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] mt-2 flex-shrink-0" />
            <div>
              <span className="font-medium text-white">{item.label}</span>
              <span className="text-white/60"> — {item.detail}</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 rounded-lg border border-white/10 bg-white/[0.02]">
        <p className="text-sm text-white/80">
          <span className="text-[#1ED760] mr-2">✓</span>
          {commitment}
        </p>
      </div>
    </div>
  );
}

function ExpectationCard({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-[#FF6A00]">{icon}</div>
        <h3 className="font-medium">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-white/70 flex items-start gap-2">
            <span className="text-white/40">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EscalationLevel({
  level,
  title,
  description,
}: {
  level: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium flex-shrink-0">
        {level}
      </div>
      <div>
        <h3 className="font-medium mb-1">{title}</h3>
        <p className="text-sm text-white/60">{description}</p>
      </div>
    </div>
  );
}
