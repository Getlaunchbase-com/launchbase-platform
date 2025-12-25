import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Zap, CheckCircle, ChevronRight, Shield, Eye, Globe, Smartphone, Clock, Sparkles, TrendingUp, Users, AlertCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "wouter";
import { useState, useEffect } from "react";

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

// Live Context Panel Component (Observability)
function LiveContextPanel() {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[time.getDay()];
  const hours = time.getHours();
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return (
    <div className="bg-[#151518] border border-white/10 rounded-2xl p-5 font-mono text-sm">
      <div className="text-gray-500 mb-3 text-xs uppercase tracking-wider">What LaunchBase is doing right now</div>
      <div className="space-y-2 text-gray-300 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1ED760]" />
          <span>Monitoring your service area</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1ED760]" />
          <span>Deciding whether posting is safe</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1ED760]" />
          <span>Applying your industry profile</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          <span>Waiting — intentionally</span>
        </div>
      </div>
      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Eye className="w-3.5 h-3.5 text-[#FF6A00]" />
          <span>You can see all of it — in plain language.</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center flex-1 mr-4 md:flex-none md:mr-0">
            <img src="/logo-cropped.png" alt="LaunchBase" className="h-10 w-auto md:h-8" />
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/how-it-works" className="text-sm text-gray-400 hover:text-white transition">How It Works</Link>
            <Link href="/expand" className="text-sm text-gray-400 hover:text-white transition">Expand</Link>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition">Pricing</a>
          </div>
          <Link href="/apply">
            <Button className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white">
              Apply <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF6A00]/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="container max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-gray-400 mb-6">
                <Sparkles className="w-4 h-4 text-[#FF6A00]" />
                <span>Operating system for small businesses</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
                Workflows that give you
                <br />
                <span className="text-[#FF6A00]">back your life.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-400 mb-6 leading-relaxed">
                LaunchBase is an operating system for small businesses.
                We build your website, manage your visibility, and take ongoing responsibility — safely and transparently.
              </p>
              
              <p className="text-sm text-gray-500 mb-8 flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#FF6A00]" />
                See your real site before you pay. You can always see what LaunchBase is doing.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/apply">
                  <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6 w-full sm:w-auto">
                    Apply to LaunchBase <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 text-lg px-8 py-6 w-full sm:w-auto">
                    See how it works
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="hidden lg:block">
              <WebsitePreview />
            </div>
          </div>
        </div>
      </section>

      {/* The Problem - Builder Fatigue */}
      <section className="py-20 px-4 border-b border-white/5">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Website builders make you decide too much, too early.
          </h2>
          
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            Pick a template. Pick integrations. Pick a plan.
            <br />
            Then your business grows — and you rebuild everything.
          </p>
          
          <div className="bg-[#FF6A00]/10 border border-[#FF6A00]/20 rounded-xl px-6 py-4 inline-block">
            <p className="text-[#FF6A00] text-xl font-medium">
              Growth shouldn't force a restart.
            </p>
          </div>
        </div>
      </section>

      {/* The Difference - Your Category */}
      <section className="py-20 px-4 border-b border-white/5 bg-white/[0.02]">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              LaunchBase grows with you — without rebuilding.
            </h2>
            
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              LaunchBase starts with a solid foundation: your website, hosting, and core intelligence.
              As your business grows, you expand LaunchBase.
            </p>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
            <p className="text-white text-xl font-medium text-center mb-6">
              Same system. Same logic. No migrations.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <p className="text-gray-300">Start simple</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <p className="text-gray-300">Add capabilities anytime</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <p className="text-gray-300">Nothing breaks when you grow</p>
              </div>
            </div>
          </div>
          
          <p className="text-center text-gray-500 text-lg">
            LaunchBase gives you a stable foundation today — and the flexibility to grow without friction tomorrow.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 border-b border-white/5">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Here's exactly what happens.
            </h2>
            <p className="text-gray-400 text-lg">
              No mystery. No surprises.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">1</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Tell us about your business</h3>
              <p className="text-gray-400 text-sm">
                Apply in English, Spanish, or Polish.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">2</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Review your real site</h3>
              <p className="text-gray-400 text-sm">
                Not a mockup. A live preview.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">3</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Approve & launch</h3>
              <p className="text-gray-400 text-sm">
                Only after you approve do we deploy.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">4</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">LaunchBase stays on</h3>
              <p className="text-gray-400 text-sm">
                Monitoring, deciding, protecting — continuously.
              </p>
            </div>
          </div>
          
          <div className="text-center">
            <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-4 inline-block">
              <p className="text-gray-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#FF6A00]" />
                Silence is a valid decision. We log it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Observability - Your Secret Weapon */}
      <section className="py-20 px-4 border-b border-white/5 bg-white/[0.02]">
        <div className="container max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                You never wonder what LaunchBase is doing.
              </h2>
              
              <p className="text-gray-400 text-lg mb-6 leading-relaxed">
                Most platforms hide their automation.
                <br />
                LaunchBase shows you — in plain language.
              </p>
              
              <p className="text-gray-500 mb-8">
                Right now, LaunchBase may be monitoring your service area, deciding whether posting is safe,
                applying your industry profile, or waiting — intentionally.
              </p>
              
              <Link href="/how-it-works">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/5">
                  See how observability works <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            
            <div className="hidden lg:block">
              <LiveContextPanel />
            </div>
          </div>
        </div>
      </section>

      {/* Expand LaunchBase */}
      <section className="py-20 px-4 border-b border-white/5">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 bg-[#FF6A00]/10 border border-[#FF6A00]/20 rounded-full px-4 py-1.5 text-sm text-[#FF6A00] mb-6">
              <Zap className="w-4 h-4" />
              <span>LaunchBase Suite</span>
            </div>
          </div>
          
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Expand when you're ready. Not before.
            </h2>
            
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              LaunchBase isn't a bundle you're locked into.
              It's a system you build on.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Social Media Intelligence</h3>
                <p className="text-gray-400 text-sm">
                  Weather-aware posts that go out when they matter.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-400">Google Business Setup</h3>
                <p className="text-gray-500 text-sm">
                  Coming soon
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-400">QuickBooks Sync</h3>
                <p className="text-gray-500 text-sm">
                  Coming soon
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-6">
              You can change this anytime. Safety never changes.
            </p>
            <Link href="/expand">
              <Button variant="outline" className="border-[#FF6A00]/50 text-[#FF6A00] hover:bg-[#FF6A00]/10">
                Explore the Suite <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 px-4 border-b border-white/5 bg-white/[0.02]">
        <div className="container max-w-4xl mx-auto text-center">
          <p className="text-gray-500 text-lg">
            Used by early service businesses across trades, appointments, and professional services.
          </p>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 border-b border-white/5">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-400 text-lg">
              One price for your website. Add Suite modules when you're ready.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Core Website */}
            <Card className="bg-white/5 border-white/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF6A00]" />
              <CardContent className="p-8">
                <div className="text-sm text-[#FF6A00] font-medium mb-2">Core</div>
                <h3 className="text-2xl font-bold mb-2 text-white">LaunchBase Website</h3>
                <p className="text-gray-400 text-sm mb-6">Everything you need to get online</p>
                
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">$499</span>
                    <span className="text-gray-500">setup</span>
                  </div>
                  <div className="text-gray-400 text-sm mt-1">+ $49/mo hosting & support</div>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {[
                    "Custom website design",
                    "Mobile-optimized",
                    "Hosting & SSL included",
                    "Contact forms & lead capture",
                    "SEO fundamentals",
                    "48-hour turnaround",
                    "Unlimited revisions (first 30 days)",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-[#1ED760] flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Link href="/apply">
                  <Button className="w-full bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white">
                    Apply to LaunchBase
                  </Button>
                </Link>
              </CardContent>
            </Card>
            
            {/* Suite Add-ons */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-8">
                <div className="text-sm text-gray-500 font-medium mb-2">Expansion</div>
                <h3 className="text-2xl font-bold mb-2 text-white">LaunchBase Suite</h3>
                <p className="text-gray-400 text-sm mb-6">Add intelligent workflows as you grow</p>
                
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">$79</span>
                    <span className="text-gray-500">/mo</span>
                  </div>
                  <div className="text-gray-400 text-sm mt-1">Starting price for Social Media Intelligence</div>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {[
                    "Social Media Intelligence",
                    "Weather-aware posting",
                    "Local context layers",
                    "Approval workflow",
                    "Safety gating",
                    "QuickBooks Sync (coming soon)",
                    "Google Business (coming soon)",
                  ].map((feature, i) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-gray-300">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${i < 5 ? 'text-[#1ED760]' : 'text-gray-600'}`} />
                      <span className={i >= 5 ? 'text-gray-500' : ''}>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link href="/expand">
                  <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/5">
                    Explore modules
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="container max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Questions? Answers.
          </h2>
          
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="what-is" className="border border-white/10 rounded-xl px-6 bg-white/[0.02]">
              <AccordionTrigger className="text-left text-white hover:no-underline py-6">
                What kind of businesses is LaunchBase for?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                LaunchBase serves local service businesses: trades (plumbers, HVAC, electricians, 
                contractors), health & wellness (dentists, chiropractors), beauty (salons, barbers), 
                food & beverage (restaurants, cafés), fitness (gyms, trainers), automotive (repair shops), 
                and professional services (lawyers, accountants). We build websites that convert visitors 
                into customers for your specific industry.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="how-long" className="border border-white/10 rounded-xl px-6 bg-white/[0.02]">
              <AccordionTrigger className="text-left text-white hover:no-underline py-6">
                How long does it take to get my website?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                Most websites go live within 48 hours of completing your application. You'll review 
                a preview, request any changes, and approve before we launch. No endless back-and-forth.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="not-builder" className="border border-white/10 rounded-xl px-6 bg-white/[0.02]">
              <AccordionTrigger className="text-left text-white hover:no-underline py-6">
                Is this a website builder?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                No. Builders help you create a site. LaunchBase operates it. If you want to design pages 
                and tweak layouts yourself, use a builder. If you want your business to stay visible 
                without thinking about it, use LaunchBase.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="approval" className="border border-white/10 rounded-xl px-6 bg-white/[0.02]">
              <AccordionTrigger className="text-left text-white hover:no-underline py-6">
                Do I have to approve everything?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                You're always in control. For your website, you approve the design before it goes live. 
                For Suite modules like Social Media Intelligence, you can choose Auto mode (we handle it), 
                Guided mode (you approve posts), or Custom mode (full control). Most customers start 
                with Guided and move to Auto once they trust the system.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="cancel" className="border border-white/10 rounded-xl px-6 bg-white/[0.02]">
              <AccordionTrigger className="text-left text-white hover:no-underline py-6">
                Can I cancel anytime?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                Yes. No contracts, no cancellation fees. If you decide LaunchBase isn't for you, 
                cancel anytime and we'll help you export your content. We want customers who stay 
                because they love the service, not because they're locked in.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Stop managing tools. Start delegating responsibility.
          </h2>
          <p className="text-gray-400 text-lg mb-4">
            You're not signing up for software.
          </p>
          <p className="text-white text-xl font-medium mb-8">
            You're handing off responsibility — with visibility.
          </p>
          <Link href="/apply">
            <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-10 py-6">
              Apply to LaunchBase <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/10">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo-cropped.png" alt="LaunchBase" className="h-6 w-auto" />
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/how-it-works" className="hover:text-white transition">How It Works</Link>
              <Link href="/expand" className="hover:text-white transition">Suite</Link>
              <a href="#pricing" className="hover:text-white transition">Pricing</a>
              <Link href="/trust" className="hover:text-white transition">Trust & Commitments</Link>
            </div>
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} LaunchBase. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
