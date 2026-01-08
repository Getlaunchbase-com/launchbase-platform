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
import { getPrefs, subscribePrefs } from "@/lib/prefs";
import { heroCopy } from "@/lib/heroCopy";

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
  const [prefs, setPrefs] = useState(() => getPrefs());
  
  useEffect(() => subscribePrefs(() => setPrefs(getPrefs())), []);
  
  const { audience, language } = prefs;

  // Get copy from heroCopy map (includes EN, ES, PL)
  const rawCopy = heroCopy[language]?.[audience] ?? heroCopy.en.biz;
  
  // Transform text into JSX with proper formatting
  const c = {
    h1: (
      <>
        {rawCopy.h1.split("\n").map((line, i) => (
          i === 0 ? line : (
            <>
              <br />
              <span className="text-[#FF6A00]">{line}</span>
            </>
          )
        ))}
      </>
    ),
    p: (
      <>
        {rawCopy.p.split("\n").map((line, i) => (
          i === 0 ? line : (
            <>
              <br />
              <span className="text-white">{line}</span>
            </>
          )
        ))}
      </>
    ),
    badge: rawCopy.badge,
    ctaPrimary: rawCopy.ctaPrimary,
    ctaSecondary: rawCopy.ctaSecondary,
  };

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Hero Section - Reframed around responsibility */}
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
                {c.h1}
              </h1>
              
              <p className="text-lg md:text-xl text-gray-400 mb-6 leading-relaxed">
                {c.p}
              </p>
              
              {/* Killer insight - elevated */}
              <div className="bg-[#FF6A00]/10 border border-[#FF6A00]/30 rounded-xl px-5 py-4 mb-8">
                <p className="text-[#FF6A00] font-medium flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  {c.badge}
                </p>
              </div>
              
              {/* Audience Fork - Explicit Choice */}
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Link href="/apply?audience=biz">
                    <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6 w-full">
                      <Users className="w-5 h-5 mr-2" />
                      For Your Business
                    </Button>
                  </Link>
                  <Link href="/apply?audience=org">
                    <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6 w-full">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      For Your Organization
                    </Button>
                  </Link>
                </div>
                <Link href="/how-it-works" className="block text-center">
                  <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 text-lg px-8 py-6 w-full sm:w-auto">
                    {c.ctaSecondary}
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

      {/* The Real Problem - Lack of Responsibility */}
      <section className="py-20 px-4 border-b border-white/5">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Most small businesses stall because no one owns the system.
          </h2>
          
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            You have a website. You have tools. You have logins.
            <br />
            But you're still the one checking if everything's okay.
          </p>
          
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-xl mx-auto">
            <p className="text-gray-300 text-lg mb-4">
              That background anxiety — <span className="text-white">"Am I missing something?"</span> — never goes away.
            </p>
            <p className="text-[#FF6A00] font-medium">
              Until someone else takes responsibility.
            </p>
          </div>
        </div>
      </section>

      {/* What Disappears From Your Life */}
      <section className="py-20 px-4 border-b border-white/5 bg-white/[0.02]">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              What stops being your job.
            </h2>
            
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              LaunchBase doesn't add features. It removes mental load.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <p className="text-gray-500 text-sm mb-2 line-through">You used to think about:</p>
              <ul className="space-y-2 text-gray-400">
                <li>"Is my site still up?"</li>
                <li>"Should I post something today?"</li>
                <li>"Did that form actually send?"</li>
                <li>"Is my SSL certificate expiring?"</li>
              </ul>
            </div>
            <div className="bg-[#FF6A00]/5 border border-[#FF6A00]/20 rounded-xl p-6">
              <p className="text-[#FF6A00] text-sm mb-2">Now you don't:</p>
              <ul className="space-y-2 text-gray-300">
                <li>LaunchBase monitors it.</li>
                <li>LaunchBase decides when it's safe.</li>
                <li>LaunchBase logs every action.</li>
                <li>LaunchBase handles it.</li>
              </ul>
            </div>
          </div>
          
          <p className="text-center text-gray-500 text-lg">
            You retain visibility. You lose the burden.
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
                5 minutes. English, Spanish, or Polish.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">2</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Review your real site</h3>
              <p className="text-gray-400 text-sm">
                Not a mockup. Your actual website.
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
          
          {/* Safety assurance */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center">
            <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3">
              <p className="text-gray-400 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#1ED760]" />
                Non-action is always safe. Change is reversible.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3">
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

      {/* Pre-qualification - This is not for you if... */}
      <section className="py-16 px-4 border-b border-white/5">
        <div className="container max-w-3xl mx-auto">
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8">
            <h3 className="text-xl font-semibold mb-6 text-center">
              This is not for you if…
            </h3>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3 text-gray-400">
                <span className="text-gray-600 mt-0.5">•</span>
                <span>You want to tweak settings, plugins, or layouts yourself</span>
              </li>
              <li className="flex items-start gap-3 text-gray-400">
                <span className="text-gray-600 mt-0.5">•</span>
                <span>You enjoy experimenting with tools and integrations</span>
              </li>
              <li className="flex items-start gap-3 text-gray-400">
                <span className="text-gray-600 mt-0.5">•</span>
                <span>You want maximum flexibility over consistency</span>
              </li>
              <li className="flex items-start gap-3 text-gray-400">
                <span className="text-gray-600 mt-0.5">•</span>
                <span>You're looking for a one-time project, not ongoing ownership</span>
              </li>
            </ul>
            
            <p className="text-center text-gray-300">
              LaunchBase is for owners who want the system <span className="text-white font-medium">handled</span> — not managed.
            </p>
          </div>
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
                    Hand It Off
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

      {/* Final CTA - Relief framing */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            You've been carrying this long enough.
          </h2>
          <p className="text-gray-400 text-lg mb-4">
            You're not signing up for software.
          </p>
          <p className="text-white text-xl font-medium mb-8">
            You're handing off responsibility — with full visibility.
          </p>
          <Link href="/apply">
            <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-10 py-6">
              Hand It Off <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <p className="text-gray-600 text-sm mt-6">
            See your real site before you pay. Cancel anytime.
          </p>
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
