import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Zap, CheckCircle, ChevronRight, Shield, Eye, Volume2, CloudSun } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "wouter";
import { useState, useEffect } from "react";

// Live Context Panel Component
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
    <div className="bg-[#151518] border border-white/10 rounded-2xl p-6 font-mono text-sm max-w-md mx-auto">
      <div className="text-gray-500 mb-4 text-xs uppercase tracking-wider">Context detected</div>
      <div className="space-y-2 text-gray-300 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-500">Location</span>
          <span>Chicago, IL</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Time</span>
          <span>{dayName} · {displayHours}:{minutes} {ampm}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Weather</span>
          <span>Clear · 46°F</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Season</span>
          <span>Winter</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Business type</span>
          <span>Service business</span>
        </div>
      </div>
      <div className="border-t border-white/10 pt-4">
        <div className="text-gray-500 mb-3 text-xs uppercase tracking-wider">System decision</div>
        <div className="space-y-1.5 text-gray-400 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1ED760]" />
            <span>No post required today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00]" />
            <span>Next optimal window: Tomorrow, 8:30 AM</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Safety gating: Active</span>
          </div>
        </div>
      </div>
      <p className="text-gray-600 text-xs mt-6 text-center italic">
        This is how LaunchBase thinks.
      </p>
    </div>
  );
}

// Mode Toggle Component
function ModeToggle() {
  const [mode, setMode] = useState<'auto' | 'guided' | 'custom'>('guided');

  const modeDescriptions = {
    auto: "LaunchBase decides when to speak — and when silence is better. You approve major changes only.",
    guided: "We suggest. You approve. Perfect balance of control and time savings.",
    custom: "You decide exactly what gets referenced. Advanced tuning with guardrails.",
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex bg-white/5 rounded-xl p-1 mb-6">
        {(['auto', 'guided', 'custom'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === m
                ? 'bg-[#FF6A00] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <p className="text-gray-400 text-center text-sm leading-relaxed min-h-[3rem]">
        {modeDescriptions[mode]}
      </p>
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
              See how it works <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section - Quiet Authority */}
      <section className="pt-32 pb-16 px-4 relative overflow-hidden">
        {/* Subtle ambient gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF6A00]/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="container max-w-5xl mx-auto text-center relative">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Workflows that give you
            <br />
            <span className="text-[#FF6A00]">back your life.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
            LaunchBase builds and runs the systems behind modern service businesses — 
            so your business stays visible, informed, and responsive without demanding your attention.
          </p>
          
          <p className="text-sm text-gray-500 mb-10">
            No schedules. No spam. No obligation.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/how-it-works">
              <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6">
                See how it works <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/example">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 text-lg px-8 py-6">
                View a real example <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Anchors Band */}
      <section className="py-6 px-4 border-y border-white/5 bg-white/[0.02]">
        <div className="container max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#FF6A00]" />
              <span>Preview before anything goes live</span>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#FF6A00]" />
              <span>Silence is a valid output</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
              <span>Approval always comes first</span>
            </div>
            <div className="flex items-center gap-2">
              <CloudSun className="w-4 h-4 text-[#FF6A00]" />
              <span>Weather-aware and safety-gated</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Intelligence Panel - The Flex */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Intelligence you can see.
              </h2>
              <p className="text-gray-400 text-lg mb-6 leading-relaxed">
                LaunchBase continuously monitors relevant signals based on your business type and location. 
                It observes, decides, proposes — and lets you stay in control.
              </p>
              <p className="text-gray-500 text-sm">
                This single panel eliminates website builders, agencies, scheduling tools, and "AI assistants."
              </p>
            </div>
            <LiveContextPanel />
          </div>
        </div>
      </section>

      {/* Automation Without Abdication */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="container max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Automation without abdication.
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
            LaunchBase doesn't blindly automate. It observes signals, understands context, 
            makes recommendations — and only acts when it makes sense.
          </p>
          
          {/* Flow Visualization */}
          <div className="flex flex-wrap justify-center items-center gap-4 mb-12 text-sm">
            {['Signal', 'Context', 'Decision', 'Approval', 'Action'].map((step, i) => (
              <div key={step} className="flex items-center gap-4">
                <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-gray-300">
                  {step}
                </div>
                {i < 4 && <ArrowRight className="w-4 h-4 text-gray-600" />}
              </div>
            ))}
          </div>
          
          {/* Mode Toggle */}
          <ModeToggle />
          
          <p className="text-gray-600 text-sm mt-8">
            You can change modes anytime.
          </p>
        </div>
      </section>

      {/* Show Real Outputs - Artifacts */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              This is what control looks like.
            </h2>
            <p className="text-gray-500">Real outputs. Real decisions. Real restraint.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Generated Post Preview */}
            <Card className="bg-[#151518] border-white/10">
              <CardContent className="p-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Generated Post</div>
                <div className="bg-white/5 rounded-lg p-4 mb-3">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    "Cold snap hitting Chicago this week ❄️ If your pipes are exposed, now's the time to wrap them. 
                    We're here if you need us."
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CloudSun className="w-3 h-3" />
                  <span>Weather-triggered</span>
                </div>
              </CardContent>
            </Card>

            {/* Approval Queue */}
            <Card className="bg-[#151518] border-white/10">
              <CardContent className="p-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Approval Queue</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                    <span className="text-sm text-gray-300">Weather post</span>
                    <span className="text-xs text-[#FF6A00]">Pending</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                    <span className="text-sm text-gray-300">Game day post</span>
                    <span className="text-xs text-[#1ED760]">Approved</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="flex-1 bg-[#1ED760] hover:bg-[#1ED760]/90 text-black text-xs">Approve</Button>
                  <Button size="sm" variant="outline" className="flex-1 border-white/20 text-xs">Edit</Button>
                </div>
              </CardContent>
            </Card>

            {/* Cadence Selector */}
            <Card className="bg-[#151518] border-white/10">
              <CardContent className="p-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Cadence</div>
                <div className="space-y-2">
                  {[
                    { level: 'LOW', price: '$79', active: false },
                    { level: 'MEDIUM', price: '$129', active: true },
                    { level: 'HIGH', price: '$199', active: false },
                  ].map((tier) => (
                    <div
                      key={tier.level}
                      className={`flex items-center justify-between rounded-lg p-3 ${
                        tier.active ? 'bg-[#FF6A00]/20 border border-[#FF6A00]' : 'bg-white/5'
                      }`}
                    >
                      <span className={`text-sm ${tier.active ? 'text-white' : 'text-gray-400'}`}>{tier.level}</span>
                      <span className={`text-sm ${tier.active ? 'text-[#FF6A00]' : 'text-gray-500'}`}>{tier.price}/mo</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Stripe Summary */}
            <Card className="bg-[#151518] border-white/10">
              <CardContent className="p-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Billing</div>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between text-gray-400">
                    <span>Cadence (Medium)</span>
                    <span>$129</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Sports & Events</span>
                    <span>+$29</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-white">
                    <span>Monthly</span>
                    <span>$158/mo</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>Setup</span>
                    <span>$348</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <p className="text-center text-gray-600 text-sm mt-8 italic">
            Generated automatically. Approved intentionally. Executed quietly.
          </p>
        </div>
      </section>

      {/* The Suite - Expand LaunchBase */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Expand LaunchBase.
            </h2>
            <p className="text-gray-500">Add workflows as your business grows.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Social Media Intelligence */}
            <Card className="bg-[#151518] border-white/10 hover:border-[#FF6A00]/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Social Media Intelligence</h3>
                  <span className="text-xs bg-[#1ED760]/20 text-[#1ED760] px-2 py-1 rounded-full">Active</span>
                </div>
                <p className="text-gray-400 text-sm mb-6">
                  Context-aware communication that knows when to speak — and when not to.
                </p>
                <Link href="/expand">
                  <Button variant="outline" className="w-full border-white/20 hover:bg-white/5">
                    Configure <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* QuickBooks Sync */}
            <Card className="bg-[#151518] border-white/10 hover:border-white/20 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">QuickBooks Sync</h3>
                  <span className="text-xs bg-white/10 text-gray-400 px-2 py-1 rounded-full">Available</span>
                </div>
                <p className="text-gray-400 text-sm mb-6">
                  Your back office, handled automatically. Invoices, customers, payments.
                </p>
                <Button variant="outline" className="w-full border-white/20 hover:bg-white/5">
                  Connect <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Google Business */}
            <Card className="bg-[#151518] border-white/10 opacity-75">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Google Business Assistant</h3>
                  <span className="text-xs bg-white/5 text-gray-500 px-2 py-1 rounded-full">Coming Soon</span>
                </div>
                <p className="text-gray-400 text-sm mb-6">
                  Local visibility without constant attention. Reviews, listings, local SEO.
                </p>
                <Button variant="outline" className="w-full border-white/10 text-gray-500" disabled>
                  Notify me <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing - Adult Transparency */}
      <section id="pricing" className="py-20 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pricing that reflects responsibility.
            </h2>
            <p className="text-gray-500">No usage tricks. No hidden fees. No surprises.</p>
          </div>
          
          <div className="bg-[#151518] border border-white/10 rounded-2xl p-8 max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-6">Social Media Intelligence</h3>
            
            <div className="space-y-4 mb-8">
              <div className="text-sm text-gray-500 uppercase tracking-wider">Cadence (choose one)</div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { level: 'Low', price: '$79', posts: '1-2/week' },
                  { level: 'Medium', price: '$129', posts: '2-3/week', recommended: true },
                  { level: 'High', price: '$199', posts: '4-6/week' },
                ].map((tier) => (
                  <div
                    key={tier.level}
                    className={`text-center p-4 rounded-xl ${
                      tier.recommended ? 'bg-[#FF6A00]/20 border border-[#FF6A00]' : 'bg-white/5'
                    }`}
                  >
                    <div className="font-semibold mb-1">{tier.level}</div>
                    <div className={`text-lg ${tier.recommended ? 'text-[#FF6A00]' : 'text-gray-300'}`}>{tier.price}/mo</div>
                    <div className="text-xs text-gray-500">{tier.posts}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="text-sm text-gray-500 uppercase tracking-wider">Local Context (optional)</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">Sports & Events</span>
                  <span className="text-gray-400">+$29/mo</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">Community & Schools</span>
                  <span className="text-gray-400">+$39/mo</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">Local Trends</span>
                  <span className="text-gray-400">+$49/mo</span>
                </div>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-6 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Setup fee</span>
                <span className="text-gray-300">$249 + $99/layer</span>
              </div>
            </div>
            
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                <span>Includes approval workflow</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                <span>You control what posts and when</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                <span>Auto mode optional — never forced</span>
              </div>
            </div>
            
            <p className="text-center text-gray-600 text-sm mt-8">
              Scale modules up, down, or off at any time. No contracts.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="container max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Questions answered.
            </h2>
          </div>
          
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="approval" className="bg-[#151518] border border-white/10 rounded-xl px-6">
              <AccordionTrigger className="text-left hover:no-underline py-6">
                <span className="text-white">What if I don't like a post?</span>
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                You can edit it, reject it, or let it expire. Nothing posts without approval unless you explicitly enable Auto Mode. 
                You're always in control.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="setitforget" className="bg-[#151518] border border-white/10 rounded-xl px-6">
              <AccordionTrigger className="text-left hover:no-underline py-6">
                <span className="text-white">Is this "set it and forget it"?</span>
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                It can be — but it doesn't have to be. LaunchBase adapts to how involved you want to be. 
                Auto mode handles everything. Guided mode lets you approve each post. Custom mode gives you full control.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="silence" className="bg-[#151518] border border-white/10 rounded-xl px-6">
              <AccordionTrigger className="text-left hover:no-underline py-6">
                <span className="text-white">What if there's nothing to post about?</span>
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                Then we don't post. Silence is a valid output. LaunchBase is explicitly designed not to post if posting adds no value. 
                This is why your feed stays professional — not noisy.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="safety" className="bg-[#151518] border border-white/10 rounded-xl px-6">
              <AccordionTrigger className="text-left hover:no-underline py-6">
                <span className="text-white">What about sensitive topics?</span>
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                LaunchBase will never reference sensitive topics, emergencies, or tragedies. 
                No political content. No opinionated takes. No tragedy exploitation. 
                We're designed to protect your reputation — even from automation itself.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="cancel" className="bg-[#151518] border border-white/10 rounded-xl px-6">
              <AccordionTrigger className="text-left hover:no-underline py-6">
                <span className="text-white">Can I cancel anytime?</span>
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                Yes. No contracts. Scale modules up, down, or off at any time. 
                We earn your business every month.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA - Filter, Not Push */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            LaunchBase isn't for everyone.
          </h2>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            It's for owners who want their business to stay visible — without staying involved.
          </p>
          <Link href="/apply">
            <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6">
              See if LaunchBase fits your business <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/10">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <img src="/logo-cropped.png" alt="LaunchBase" className="h-8 w-auto" />
            <div className="flex items-center gap-8 text-sm text-gray-500">
              <Link href="/how-it-works" className="hover:text-white transition">How It Works</Link>
              <Link href="/expand" className="hover:text-white transition">Expand</Link>
              <a href="#pricing" className="hover:text-white transition">Pricing</a>
              <Link href="/apply" className="hover:text-white transition">Apply</Link>
            </div>
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} LaunchBase
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
