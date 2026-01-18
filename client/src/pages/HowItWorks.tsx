import { Check, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0A0A0A] to-black text-white">
      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              How LaunchBase Works
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-8">
              You answer a short intake. We generate a build plan, produce a preview, and iterate with guarded revisions—then ship.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link 
                href="/intake"
                className="inline-flex items-center justify-center gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white px-8 py-4 rounded-lg font-semibold transition"
              >
                Start the intake
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link 
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white px-8 py-4 rounded-lg font-semibold transition"
              >
                See pricing
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              {[
                "Preflight checks for missing info",
                "Swarm produces a proposal packet",
                "Critic validates clarity + mobile"
              ].map((badge, i) => (
                <div key={i} className="flex items-center gap-2 text-white/70">
                  <Check className="h-5 w-5 text-[#1ED760]" />
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-16 md:py-20 px-4 bg-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">The 6-step flow</h2>
          
          <div className="space-y-6">
            {[
              {
                title: "1) Intake",
                body: "Tell us what you do, who you serve, and what you want the site to accomplish."
              },
              {
                title: "2) Preflight",
                body: "We validate the inputs, flag missing details, and prevent made-up claims before anything is generated."
              },
              {
                title: "3) Field General plan",
                body: "A deterministic plan sets tier budgets, allowed surfaces, and the work order for specialists."
              },
              {
                title: "4) Swarm run",
                body: "Specialists propose changes and a selector composes a coherent set of improvements."
              },
              {
                title: "5) Preview packet",
                body: "You receive a ShipPacket proposal that's ready to review, with clear deltas and rationale."
              },
              {
                title: "6) Approve or request changes",
                body: "You can approve, or request another iteration using your included credits."
              }
            ].map((step, i) => (
              <div 
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-white/20 transition"
              >
                <h3 className="text-xl font-semibold mb-2 text-[#FF6A00]">{step.title}</h3>
                <p className="text-white/70">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Receive Section */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">What you receive</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Build plan",
                body: "A structured plan that defines page goals, sections, CTAs, and constraints."
              },
              {
                title: "Proposal packet (ShipPacket)",
                body: "A reviewable proposal with recommended changes, reasoning, and what will be built next."
              },
              {
                title: "Quality gates",
                body: "A critic review focused on clarity, hierarchy, and mobile usability—so problems are caught early."
              }
            ].map((card, i) => (
              <div 
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-white/20 transition"
              >
                <h3 className="text-xl font-semibold mb-3">{card.title}</h3>
                <p className="text-white/70">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers Section */}
      <section className="py-16 md:py-20 px-4 bg-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">How tiers differ</h2>
          <p className="text-center text-white/70 mb-12 max-w-2xl mx-auto">
            Choose the level of iteration and tooling you need. All tiers keep changes guarded and reviewable.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Standard",
                badge: "Polish pass",
                bullets: [
                  "1 included change request credit",
                  "Showroom-style preview flow",
                  "Best for: tighten messaging + spacing + CTA hierarchy"
                ]
              },
              {
                name: "Growth",
                badge: "Conversion pass",
                bullets: [
                  "3 included change request credits",
                  "Showroom-style preview flow",
                  "Best for: add proof elements + conversion structure"
                ]
              },
              {
                name: "Premium",
                badge: "Full transformation",
                bullets: [
                  "10 included change request credits",
                  "Builder-enabled on approved marketing surfaces",
                  "Best for: positioning + design system + strongest hierarchy"
                ],
                footnote: "Premium Builder access is limited to approved UI surfaces only."
              }
            ].map((tier, i) => (
              <div 
                key={i}
                className={`rounded-xl p-6 border ${
                  tier.name === "Premium" 
                    ? "border-[#FF6A00] bg-[#FF6A00]/10" 
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="mb-4">
                  <span className="text-xs uppercase tracking-wider text-white/60">{tier.badge}</span>
                  <h3 className="text-2xl font-bold mt-1">{tier.name}</h3>
                </div>
                
                <ul className="space-y-3 mb-4">
                  {tier.bullets.map((bullet, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-white/80">
                      <Check className="h-4 w-4 text-[#1ED760] mt-0.5 flex-shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                
                {tier.footnote && (
                  <p className="text-xs text-white/60 mt-4 pt-4 border-t border-white/10">
                    {tier.footnote}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Critic Checks Section */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">What the critic checks</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 text-[#FF6A00]">Must-pass signals</h3>
              <ul className="space-y-3">
                {[
                  "Clear single primary CTA",
                  "Readable mobile hierarchy",
                  "No cluttered or conflicting offers",
                  "Trust and proof placed where it matters"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/80">
                    <Check className="h-5 w-5 text-[#1ED760] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-4 text-[#FF6A00]">Common fixes</h3>
              <ul className="space-y-3">
                {[
                  "CTA hierarchy and wording cleanup",
                  "Section order for comprehension",
                  "Pricing card stacking on mobile",
                  "Spacing rhythm and headings"
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
            Critic review is a quality gate, not a promise of outcomes.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-20 px-4 bg-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">FAQ</h2>
          
          <div className="space-y-6">
            {[
              {
                q: "What counts as a change request?",
                a: "A change request is one additional improvement loop. Approving your proposal does not consume credits."
              },
              {
                q: "Can I buy more revisions?",
                a: "Yes—when you run out of included credits, you can purchase additional change requests."
              },
              {
                q: "What does Premium Builder access mean?",
                a: "Premium allows Builder-powered UI execution on approved marketing surfaces only. Core backend and sensitive areas are out of scope."
              }
            ].map((item, i) => (
              <div 
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-6"
              >
                <h3 className="text-lg font-semibold mb-2">{item.q}</h3>
                <p className="text-white/70">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Ready to see your plan?</h2>
          <p className="text-xl text-white/70 mb-8">
            Start with the intake. If anything is missing, we'll ask before generating work.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/intake"
              className="inline-flex items-center justify-center gap-2 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white px-8 py-4 rounded-lg font-semibold transition"
            >
              Start the intake
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link 
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white px-8 py-4 rounded-lg font-semibold transition"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
