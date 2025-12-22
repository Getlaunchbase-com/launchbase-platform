import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Zap, CheckCircle, ChevronRight, Shield, Eye, Globe, Smartphone, Clock, Sparkles, TrendingUp, Users } from "lucide-react";
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

// Live Context Panel Component (for Suite section)
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
      <div className="text-gray-500 mb-3 text-xs uppercase tracking-wider">Context detected</div>
      <div className="space-y-1.5 text-gray-300 mb-4 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Location</span>
          <span>Chicago, IL</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Weather</span>
          <span>Clear · 46°F</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Time</span>
          <span>{dayName} · {displayHours}:{minutes} {ampm}</span>
        </div>
      </div>
      <div className="border-t border-white/10 pt-3">
        <div className="text-gray-500 mb-2 text-xs uppercase tracking-wider">Decision</div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1ED760]" />
          <span>No post required today</span>
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
              Get started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section - Website First */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF6A00]/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="container max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-gray-400 mb-6">
                <Sparkles className="w-4 h-4 text-[#FF6A00]" />
              <span>Websites for local businesses</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
                Your website.
                <br />
                <span className="text-[#FF6A00]">Built and running.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-400 mb-6 leading-relaxed">
                LaunchBase builds professional websites for local businesses — 
                trades, health & wellness, beauty, restaurants, fitness, automotive, and more. 
                Fast setup, no maintenance headaches, and workflows that grow with you.
              </p>
              
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-8">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                  <span>Live in 48 hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                  <span>Mobile-optimized</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                  <span>No tech skills needed</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/apply">
                  <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6 w-full sm:w-auto">
                    Get your website <ArrowRight className="w-5 h-5 ml-2" />
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

      {/* What You Get - Core Website Features */}
      <section className="py-20 px-4 border-y border-white/5 bg-white/[0.02]">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything your business needs online
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              A complete website built for your industry, optimized for customers who need you now.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Professional Website</h3>
                <p className="text-gray-400 text-sm">
                  Custom-designed for your business type. Services, about, contact — all the pages you need.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mb-4">
                  <Smartphone className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Mobile-First Design</h3>
                <p className="text-gray-400 text-sm">
                  Looks great on every device. Your customers find you on their phones — we make sure it works.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Fast Turnaround</h3>
                <p className="text-gray-400 text-sm">
                  From intake to live in 48 hours. We handle the tech so you can focus on your work.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Hosting Included</h3>
                <p className="text-gray-400 text-sm">
                  Secure, fast hosting with SSL certificate. No separate bills, no server management.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">SEO Ready</h3>
                <p className="text-gray-400 text-sm">
                  Built with search engines in mind. Local customers can find you when they need your services.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Lead Capture</h3>
                <p className="text-gray-400 text-sm">
                  Contact forms, click-to-call buttons, and service requests. Turn visitors into customers.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works - Simple Steps */}
      <section className="py-20 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Three steps to your new website
            </h2>
            <p className="text-gray-400 text-lg">
              No meetings, no back-and-forth. Just a simple process that works.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Tell us about your business</h3>
              <p className="text-gray-400">
                5-minute intake form. Your services, service area, and what makes you different.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">We build your site</h3>
              <p className="text-gray-400">
                Our team creates your website. You review it, request changes, and approve.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Go live</h3>
              <p className="text-gray-400">
                Your website launches. We handle hosting, updates, and support. You run your business.
              </p>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Link href="/apply">
              <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white">
                Start your website <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Expand Section - LaunchBase Suite */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#0B0B0C] to-[#151518]">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 bg-[#FF6A00]/10 border border-[#FF6A00]/20 rounded-full px-4 py-1.5 text-sm text-[#FF6A00] mb-6">
              <Zap className="w-4 h-4" />
              <span>LaunchBase Suite</span>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                When you're ready,
                <br />
                <span className="text-[#FF6A00]">expand your reach.</span>
              </h2>
              
              <p className="text-gray-400 text-lg mb-6 leading-relaxed">
                Your website is just the beginning. LaunchBase Suite adds intelligent workflows 
                that keep your business visible — without demanding your attention.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#FF6A00]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Social Media Intelligence</h4>
                    <p className="text-gray-500 text-sm">Weather-aware posts that go out when they matter. You approve, we post.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-400">QuickBooks Sync</h4>
                    <p className="text-gray-600 text-sm">Coming soon — invoices and payments, automated.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-400">Google Business Assistant</h4>
                    <p className="text-gray-600 text-sm">Coming soon — reviews and listings, managed.</p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-6">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#FF6A00]" />
                  <span>Preview before posting</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#FF6A00]" />
                  <span>Safety-gated</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#FF6A00]" />
                  <span>Approval always first</span>
                </div>
              </div>
              
              <Link href="/expand">
                <Button variant="outline" className="border-[#FF6A00]/50 text-[#FF6A00] hover:bg-[#FF6A00]/10">
                  Explore the Suite <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            
            <div className="hidden lg:block">
              <LiveContextPanel />
              <p className="text-gray-600 text-xs mt-4 text-center italic">
                This is how LaunchBase thinks — so you don't have to.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
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
                    Get started
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
                LaunchBase serves a wide range of local businesses: trades (plumbers, HVAC, electricians, 
                contractors), health & wellness (dentists, chiropractors, med spas), beauty (salons, barbers, 
                spas), food & beverage (restaurants, cafés, bars), fitness (gyms, trainers, yoga studios), 
                automotive (repair shops, detailing), professional services (lawyers, accountants), and more. 
                We build websites that convert visitors into customers for your specific industry.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="how-long" className="border border-white/10 rounded-xl px-6 bg-white/[0.02]">
              <AccordionTrigger className="text-left text-white hover:no-underline py-6">
                How long does it take to get my website?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                Most websites go live within 48 hours of completing your intake form. You'll review 
                a preview, request any changes, and approve before we launch. No endless back-and-forth.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="suite" className="border border-white/10 rounded-xl px-6 bg-white/[0.02]">
              <AccordionTrigger className="text-left text-white hover:no-underline py-6">
                What is LaunchBase Suite?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400 pb-6">
                LaunchBase Suite is our collection of add-on modules that automate marketing and 
                operations. Social Media Intelligence posts to your Facebook page based on local 
                weather and events — with your approval. More modules (QuickBooks, Google Business) 
                are coming soon. You can add them anytime after your website is live.
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
            Ready to get your business online?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            5-minute intake. 48-hour turnaround. No tech skills required.
          </p>
          <Link href="/apply">
            <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-10 py-6">
              Get your website <ArrowRight className="w-5 h-5 ml-2" />
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
