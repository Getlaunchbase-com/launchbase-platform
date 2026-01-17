import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Zap,
  CheckCircle,
  ChevronRight,
  Shield,
  Eye,
  Globe,
  Smartphone,
  Clock,
  Sparkles,
  TrendingUp,
  Users,
  AlertCircle,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "wouter";

// Website Preview Component
function WebsitePreview() {
  return (
    <div className="relative">
      {/* Browser chrome */}
      <div className="bg-[#1a1a1d] rounded-t-xl border border-white/10 border-b-0 px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-white/10 rounded-md px-3 py-1.5 text-xs text-gray-400 text-center">
            yourbusiness.com
          </div>
        </div>
      </div>
      {/* Website content */}
      <div className="bg-gradient-to-br from-[#151518] to-[#1a1a1d] rounded-b-xl border border-white/10 border-t-0 p-6 min-h-[280px]">
        <div className="space-y-4">
          {/* Nav */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-24 h-6 bg-[#FF6A00]/30 rounded" />
            <div className="flex gap-4">
              <div className="w-12 h-4 bg-white/10 rounded" />
              <div className="w-12 h-4 bg-white/10 rounded" />
              <div className="w-16 h-6 bg-[#FF6A00] rounded" />
            </div>
          </div>
          {/* Hero */}
          <div className="text-center py-6">
            <div className="w-3/4 h-8 bg-white/20 rounded mx-auto mb-3" />
            <div className="w-1/2 h-4 bg-white/10 rounded mx-auto mb-6" />
            <div className="w-32 h-10 bg-[#FF6A00] rounded mx-auto" />
          </div>
          {/* Cards */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/5 rounded-lg p-3 h-20" />
            <div className="bg-white/5 rounded-lg p-3 h-20" />
            <div className="bg-white/5 rounded-lg p-3 h-20" />
          </div>
        </div>
      </div>
      {/* Floating badge */}
      <div className="absolute -bottom-3 -right-3 bg-[#FF6A00] text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
        Built in 48 hours
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 pb-20 px-4 overflow-hidden">
        {/* Background gradient accents */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FF6A00]/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-l from-[#FF6A00]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="container max-w-5xl mx-auto relative z-10">
          <div className="space-y-10 max-w-3xl">
            {/* Premium badge */}
            <div className="inline-flex items-center gap-2 bg-white/8 border border-white/15 rounded-full px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition">
              <Sparkles className="w-4 h-4 text-[#FF6A00]" />
              <span>Premium business automation platform</span>
            </div>

            {/* Main headline */}
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
                <span className="block">Your Business</span>
                <span className="block">
                  <span className="text-[#FF6A00]">Runs Itself</span>
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl md:text-2xl text-gray-300 leading-relaxed max-w-2xl">
                Intelligent automation that handles your website,
                communications, and business operations.{" "}
                <span className="text-white font-medium">
                  So you focus on what matters.
                </span>
              </p>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-4 pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-[#1ED760]" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-[#1ED760]" />
                <span>See your site before you pay</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-[#1ED760]" />
                <span>Cancel anytime</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-8">
              <Link href="/apply">
                <Button
                  size="lg"
                  className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-base px-8 py-6 rounded-lg font-medium shadow-lg hover:shadow-xl transition w-full sm:w-auto"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5 hover:border-white/40 text-base px-8 py-6 rounded-lg font-medium transition w-full sm:w-auto"
                >
                  Watch Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 px-4 border-b border-white/5">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Most small businesses stall because no one owns the system.
          </h2>

          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            You have a website. You have tools. You have logins.
            <br />
            But you're still the one quietly checking if everything's okay.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-xl mx-auto">
            <p className="text-gray-300 text-lg mb-2">
              That background anxiety—
              <span className="text-white">"Am I missing something?"</span>
              —doesn't go away…
            </p>
            <p className="text-[#FF6A00] font-medium">
              until someone else takes responsibility.
            </p>
          </div>
        </div>
      </section>

      {/* What Stops Being Your Job */}
      <section className="py-20 px-4 border-b border-white/5 bg-white/[0.02]">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              LaunchBase doesn't add features. It removes mental load.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <p className="text-gray-500 text-sm mb-4 font-medium">
                You used to think about:
              </p>
              <ul className="space-y-3 text-gray-400">
                <li>"Is my site still up?"</li>
                <li>"Did that form actually send?"</li>
                <li>"Should I post something today?"</li>
                <li>"Is my SSL expiring?"</li>
                <li>"Did that update break something?"</li>
              </ul>
            </div>
            <div className="bg-[#FF6A00]/5 border border-[#FF6A00]/20 rounded-xl p-6">
              <p className="text-[#FF6A00] text-sm mb-4 font-medium">
                Now you don't:
              </p>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-[#FF6A00] shrink-0 mt-0.5" />
                  <span>LaunchBase monitors it.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-[#FF6A00] shrink-0 mt-0.5" />
                  <span>LaunchBase decides when it's safe.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-[#FF6A00] shrink-0 mt-0.5" />
                  <span>LaunchBase logs every action.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-[#FF6A00] shrink-0 mt-0.5" />
                  <span>LaunchBase can pause instead of guessing.</span>
                </li>
              </ul>
            </div>
          </div>

          <p className="text-center text-lg text-gray-300 mb-4">
            You retain visibility. You lose the burden.
          </p>
          <p className="text-center text-white font-medium">
            Non-action is always safe. Change is reversible.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 border-b border-white/5">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Here's exactly what happens. No mystery. No surprises.
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#FF6A00]/10 border border-[#FF6A00]/30 rounded-full flex items-center justify-center text-[#FF6A00] font-bold text-xl mx-auto mb-4">
                1
              </div>
              <h3 className="font-bold text-lg mb-2">
                Tell us about your business
              </h3>
              <p className="text-gray-400 text-sm">
                5 minutes. English, Spanish, or Polish.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-[#FF6A00]/10 border border-[#FF6A00]/30 rounded-full flex items-center justify-center text-[#FF6A00] font-bold text-xl mx-auto mb-4">
                2
              </div>
              <h3 className="font-bold text-lg mb-2">Review your real site</h3>
              <p className="text-gray-400 text-sm">
                Not a mockup. Your actual website.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-[#FF6A00]/10 border border-[#FF6A00]/30 rounded-full flex items-center justify-center text-[#FF6A00] font-bold text-xl mx-auto mb-4">
                3
              </div>
              <h3 className="font-bold text-lg mb-2">Approve & launch</h3>
              <p className="text-gray-400 text-sm">
                Nothing deploys until you approve.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-[#FF6A00]/10 border border-[#FF6A00]/30 rounded-full flex items-center justify-center text-[#FF6A00] font-bold text-xl mx-auto mb-4">
                4
              </div>
              <h3 className="font-bold text-lg mb-2">LaunchBase stays on</h3>
              <p className="text-gray-400 text-sm">
                Monitoring, deciding, protecting—continuously.
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500">
            Silence is a valid decision. We log it.
          </p>
        </div>
      </section>

      {/* Observability (Trust Section) */}
      <section className="py-20 px-4 border-b border-white/5 bg-white/[0.02]">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              You never wonder what LaunchBase is doing.
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Most platforms hide their automation. LaunchBase shows you—in
              plain language.
            </p>
          </div>

          <div className="bg-[#151518] border border-white/10 rounded-2xl p-6 max-w-2xl mx-auto mb-8">
            <div className="space-y-3 text-gray-300 text-sm font-mono">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#1ED760]" />
                <span>Monitoring uptime and forms</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#1ED760]" />
                <span>Checking SSL + domain health</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>Preparing a post (waiting for safe window)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#1ED760]" />
                <span>Applying your industry profile</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                <span>Holding action intentionally (with reason)</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link href="/how-it-works#observability">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5"
              >
                See how observability works
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* The Suite */}
      <section className="py-20 px-4 border-b border-white/5">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Expand when you're ready. Not before.
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              LaunchBase isn't a bundle you're locked into. It's a system you
              build on—intentionally.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Social Media Intelligence */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-3">
                  Social Media Intelligence
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Context-aware posting that adapts to your business, location,
                  and timing.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">4 posts / month</span>
                      <span className="text-sm text-gray-400">
                        Setup $149 • Monthly $59
                      </span>
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">8 posts / month</span>
                      <span className="text-sm text-gray-400">
                        Setup $199 • Monthly $99
                      </span>
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">12 posts / month</span>
                      <span className="text-sm text-gray-400">
                        Setup $249 • Monthly $149
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>• Scheduled posting</p>
                  <p>• Platform-safe formatting</p>
                  <p>• Approval workflow</p>
                  <p>• Full activity log</p>
                  <p>• Pause or change anytime</p>
                </div>
              </CardContent>
            </Card>

            {/* Intelligent Enrichment Layer */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-3">
                  Intelligent Enrichment Layer
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Automation that understands when not to act.
                </p>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Optional</span>
                    <span className="text-sm text-gray-400">
                      Setup $199 • Monthly +$79/mo
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1 mb-4">
                  <p>• Weather-aware logic</p>
                  <p>• Local context awareness</p>
                  <p>• Industry timing rules</p>
                  <p>• Safety gating</p>
                  <p>• Decision logging ("why this posted")</p>
                </div>

                <p className="text-sm text-[#FF6A00] font-medium">
                  Intelligence is valuable. We price it like it is.
                </p>
              </CardContent>
            </Card>

            {/* Google Business Profile */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-3">
                  Google Business Profile
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Setup and ongoing visibility monitoring.
                </p>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">GBP Management</span>
                    <span className="text-sm text-gray-400">
                      Setup $149 • Monthly $29/mo
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Includes profile setup or cleanup, posting sync (if enabled),
                  and health monitoring.
                </p>
              </CardContent>
            </Card>

            {/* QuickBooks Sync */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-3">QuickBooks Sync</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Accounting visibility and error monitoring.
                </p>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">QB Integration</span>
                    <span className="text-sm text-gray-400">
                      Setup $199 • Monthly $39/mo
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Includes revenue visibility, payment sync, and activity
                  logging.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Link href="/suite">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5"
              >
                Explore the Suite
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Who It's For / Not For You */}
      <section className="py-20 px-4 border-b border-white/5 bg-white/[0.02]">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">
            This is not for you if…
          </h2>

          <div className="bg-white/5 border border-white/10 rounded-xl p-8 mb-8">
            <ul className="space-y-4 text-gray-400 text-left">
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <span>
                  You want to tweak settings, plugins, or layouts yourself
                </span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <span>You enjoy experimenting with tools and integrations</span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <span>You want maximum flexibility over consistency</span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <span>
                  You're looking for a one-time project, not ongoing ownership
                </span>
              </li>
            </ul>
          </div>

          <p className="text-lg text-white font-medium">
            LaunchBase is for owners who want the system handled—not managed.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 border-b border-white/5">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pricing, done honestly.
            </h2>
            <p className="text-gray-400 text-lg">
              You're not buying software. You're handing off responsibility.
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-12">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-2">LaunchBase Website</h3>
                <div className="flex items-baseline gap-4 mb-6">
                  <span className="text-3xl font-bold text-[#FF6A00]">
                    $499
                  </span>
                  <span className="text-gray-400">setup</span>
                  <span className="text-gray-500">+</span>
                  <span className="text-3xl font-bold text-[#FF6A00]">$49</span>
                  <span className="text-gray-400">/month</span>
                </div>

                <div className="space-y-2 text-sm text-gray-400 mb-6">
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
                    Custom website design
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
                    Mobile optimization
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
                    Hosting & SSL
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
                    Contact forms & lead capture
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
                    SEO fundamentals
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
                    Monitoring & safety
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
                    Full visibility into every action
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  Final pricing is confirmed during onboarding before anything
                  is charged.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-2xl mx-auto mb-8">
            <h3 className="text-xl font-bold mb-4">
              Example (no math surprises)
            </h3>
            <p className="text-gray-400 mb-4">
              Website + Social (8 posts) + Intelligence
            </p>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Setup:</span>
                <span className="text-white">
                  $499 + $199 + $199 ={" "}
                  <span className="font-bold text-[#FF6A00]">$897</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Monthly:</span>
                <span className="text-white">
                  $49 + $99 + $79 ={" "}
                  <span className="font-bold text-[#FF6A00]">$227</span>
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-500">
              No calls. No negotiation. No confusion.
            </p>
          </div>

          <div className="text-center space-y-4">
            <Link href="/apply">
              <Button
                size="lg"
                className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6"
              >
                Hand It Off
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <p className="text-sm text-gray-500">
              See your real site before you pay. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 border-b border-white/5 bg-white/[0.02]">
        <div className="container max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Questions? Answers.
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem
              value="item-1"
              className="bg-white/5 border border-white/10 rounded-xl px-6"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                What kind of businesses is LaunchBase for?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                Early service businesses across trades, appointments, and
                professional services—especially owners who want ongoing
                ownership, not another tool.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="item-2"
              className="bg-white/5 border border-white/10 rounded-xl px-6"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                How long does it take to get my website?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                You'll review a real working site early in the process. Final
                launch timing depends on content and approvals, and nothing goes
                live without your sign-off.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="item-3"
              className="bg-white/5 border border-white/10 rounded-xl px-6"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                Is this a website builder?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                No. You're not configuring templates. LaunchBase handles the
                system and keeps it healthy over time.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="item-4"
              className="bg-white/5 border border-white/10 rounded-xl px-6"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                Do I have to approve everything?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                You control what deploys. LaunchBase can monitor and prepare
                changes, but approvals gate anything that affects your public
                presence.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="item-5"
              className="bg-white/5 border border-white/10 rounded-xl px-6"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                Can I cancel anytime?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                Yes. No long contracts. You can pause or cancel when you want.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            You've been carrying this long enough.
          </h2>

          <p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto">
            You're not signing up for software. You're handing off
            responsibility—with full visibility.
          </p>

          <div className="space-y-4">
            <Link href="/apply">
              <Button
                size="lg"
                className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6"
              >
                Hand It Off
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <p className="text-sm text-gray-500">
              See your real site before you pay. Cancel anytime.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
