import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Zap, Clock, Shield, CheckCircle, Rocket, Users, Building2, Star, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo-full-dark.png" alt="LaunchBase" className="h-8" />
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition">How It Works</a>
            <a href="#verticals" className="text-sm text-gray-400 hover:text-white transition">Industries</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition">Pricing</a>
          </div>
          <Link href="/onboarding">
            <Button className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white">
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8">
            <Zap className="w-4 h-4 text-[#FF6A00]" />
            <span className="text-sm text-gray-300">The operating system for launching service businesses</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Build your business once.
            <br />
            <span className="text-[#FF6A00]">Launch everything.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            One intake. One conversation. A complete website built for your business — 
            ready to attract customers and grow your revenue.
          </p>
          
          {/* Secondary hero line - preview as reassurance */}
          <p className="text-sm text-gray-500 mb-8">
            Preview your real website before you launch.
            <span className="text-gray-600"> No mockups. No templates. No surprises.</span>
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/onboarding">
              <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6">
                Complete Your Launch Intake <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <p className="text-sm text-gray-500">Takes about 5 minutes</p>
          </div>
          
          {/* Social Proof */}
          <p className="mt-8 text-sm text-gray-500">
            Used by early service businesses across trades, appointments, and professional services.
          </p>
        </div>
      </section>

      {/* What You Get Section */}
      <section className="py-16 px-4 border-b border-white/10">
        <div className="container max-w-4xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h3 className="text-xl font-semibold mb-6 text-center">What You Get</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#1ED760] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-white">Professional website</p>
                  <p className="text-sm text-gray-400">Custom-built for your business</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#1ED760] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-white">Lead capture</p>
                  <p className="text-sm text-gray-400">Calls, bookings, or forms</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#1ED760] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-white">LaunchBase dashboard</p>
                  <p className="text-sm text-gray-400">Updates & future changes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              You're great at your craft.
              <br />
              <span className="text-gray-400">Getting online shouldn't be this hard.</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <Clock className="w-10 h-10 text-[#FF6A00] mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-white">No Time to Figure It Out</h3>
                <p className="text-gray-400">
                  You're running a business. Learning website builders, writing copy, 
                  choosing designs — it's not what you signed up for.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <Users className="w-10 h-10 text-[#FF6A00] mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-white">Agencies Are Expensive</h3>
                <p className="text-gray-400">
                  $5,000+ for a website? Monthly retainers? You need something that 
                  works without breaking the bank.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <Shield className="w-10 h-10 text-[#FF6A00] mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-white">DIY Looks Amateur</h3>
                <p className="text-gray-400">
                  Template sites look like template sites. Your business deserves 
                  better than cookie-cutter.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How LaunchBase Works
            </h2>
            <p className="text-gray-400 text-lg">Three steps. One hour. Done.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Tell Us About Your Business</h3>
              <p className="text-gray-400">
                Answer a few questions about what you do, who you serve, and how 
                customers reach you. Our AI understands your industry.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">We Build Your Site</h3>
              <p className="text-gray-400">
                Our system generates your actual website with professional copy.
                You preview it exactly as it will launch — before you pay.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-[#FF6A00]">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Review & Launch</h3>
              <p className="text-gray-400">
                A real human reviews everything before launch. You get a 
                professional site without the professional price tag.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section id="verticals" className="py-20 px-4 bg-white/[0.02]">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for Service Businesses
            </h2>
            <p className="text-gray-400 text-lg">Templates designed for how you actually work</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white/5 border-white/10 hover:border-[#FF6A00]/50 transition-colors">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Trades & Contractors</h3>
                <p className="text-gray-400 mb-4">
                  Plumbers, electricians, HVAC, roofers, landscapers
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                    Click-to-call buttons
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                    Service area display
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                    Emergency service badges
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10 hover:border-[#FF6A00]/50 transition-colors">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Appointment Businesses</h3>
                <p className="text-gray-400 mb-4">
                  Salons, spas, therapists, trainers, coaches
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                    Online booking integration
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                    Service menu display
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                    Testimonial sections
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10 hover:border-[#FF6A00]/50 transition-colors">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Professional Services</h3>
                <p className="text-gray-400 mb-4">
                  Consultants, lawyers, accountants, advisors
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                    Consultation request forms
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                    Credential display
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#1ED760]" />
                    Case study sections
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Business Modules Teaser */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-[#FF6A00]/10 to-transparent border border-[#FF6A00]/20 rounded-2xl p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex-1">
                <p className="text-sm text-[#FF6A00] font-medium mb-2">COMING SOON</p>
                <h3 className="text-xl md:text-2xl font-bold mb-2">Works with the tools you already use</h3>
                <p className="text-gray-400">
                  Connect your website to Google Ads, QuickBooks, and more. 
                  Optional add-ons available after your site launches.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center" title="Google Ads">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor"/>
                  </svg>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center" title="QuickBooks">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 16.8H15.84c-.384 0-.672-.288-.672-.672v-4.8c0-1.056-.864-1.92-1.92-1.92H9.84c-.384 0-.672.288-.672.672v6.048c0 .384-.288.672-.672.672H6.768c-.384 0-.672-.288-.672-.672V7.872c0-.384.288-.672.672-.672h3.408c.384 0 .672.288.672.672v4.8c0 1.056.864 1.92 1.92 1.92h3.408c.384 0 .672-.288.672-.672V7.872c0-.384.288-.672.672-.672h1.728c.384 0 .672.288.672.672v8.256c0 .384-.288.672-.672.672z" fill="#2CA01C"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Founding Client Pricing
            </h2>
            <p className="text-gray-400 text-lg">Limited beta access for early service businesses</p>
          </div>
          
          {/* Beta Context */}
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <p className="text-gray-400 text-sm leading-relaxed">
              LaunchBase is currently accepting a limited number of founding clients.
              Early customers receive discounted beta pricing in exchange for feedback and testimonials.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Once beta closes, pricing will increase for new customers.
            </p>
          </div>
          
          <Card className="bg-white/5 border-white/10 max-w-lg mx-auto overflow-hidden">
            <div className="bg-[#FF6A00]/20 px-6 py-3 border-b border-white/10">
              <span className="text-[#FF6A00] font-semibold text-sm">Founding Client (Beta)</span>
            </div>
            <CardContent className="pt-8 pb-8">
              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-4xl font-bold">$499</span>
                  <span className="text-gray-400">one-time setup</span>
                </div>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-2xl font-bold">$79</span>
                  <span className="text-gray-400">/ month ongoing</span>
                </div>
              </div>
              
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#1ED760] flex-shrink-0" />
                  <span>Professional website</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#1ED760] flex-shrink-0" />
                  <span>Industry-specific structure</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#1ED760] flex-shrink-0" />
                  <span>Lead capture & conversion setup</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#1ED760] flex-shrink-0" />
                  <span>Hosting, updates & support included</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#1ED760] flex-shrink-0" />
                  <span>Cancel anytime</span>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 text-center mb-6">
                Beta pricing is limited and subject to change.
              </p>
              
              <Link href="/onboarding">
                <Button className="w-full bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white py-6 text-lg">
                  Apply for LaunchBase <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* Link to What's Included */}
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/whats-included" className="text-[#FF6A00] hover:underline">See what's included →</Link>
          </p>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for real service businesses
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-[#FF6A00] text-[#FF6A00]" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "LaunchBase took everything I was putting off and just handled it. My site looks professional and customers actually contact me now."
                </p>
                <p className="text-sm text-gray-500">— Local Trades Business Owner (Beta)</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-[#FF6A00] text-[#FF6A00]" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "I spent months avoiding my website. LaunchBase got me online in a day. The booking integration alone was worth it."
                </p>
                <p className="text-sm text-gray-500">— Appointment Business Owner (Beta)</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-[#FF6A00] text-[#FF6A00]" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "Finally, a site that looks like I paid an agency — without the agency price or timeline. Highly recommend."
                </p>
                <p className="text-sm text-gray-500">— Professional Services Consultant (Beta)</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="bg-white/5 border border-white/10 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                How long does it take to launch?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                Most sites are ready within 24–72 hours after intake. Complex requests may take slightly longer.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2" className="bg-white/5 border border-white/10 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Can I make changes later?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                Yes. You can request updates anytime through your LaunchBase dashboard.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3" className="bg-white/5 border border-white/10 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Is this just a template?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                No. We generate a custom site based on your business, industry, and goals — then a human reviews it before launch.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" className="bg-white/5 border border-white/10 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Do I own my website?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                Yes. It's your site, your content, your business.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5" className="bg-white/5 border border-white/10 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                What if I don't like it?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                You preview your real site first — not a mockup, not a template.
                If it's not right, request changes before approving. We revise until you're proud to share it.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-6" className="bg-white/5 border border-white/10 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Who is this for?
              </AccordionTrigger>
              <AccordionContent className="text-gray-400">
                Service businesses — trades, appointments, and professional services — that want a professional online presence without hiring an agency.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to launch your business online?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Join our founding client program and get your professional website 
            at beta pricing while we perfect the platform.
          </p>
          <Link href="/onboarding">
            <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6">
              Start Your Launch Intake <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/10">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#FF6A00] rounded flex items-center justify-center">
                <Rocket className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">LAUNCHBASE</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/whats-included" className="hover:text-white transition">What's Included</Link>
              <a href="#pricing" className="hover:text-white transition">Pricing</a>
              <Link href="/terms" className="hover:text-white transition">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
              <a href="mailto:hello@getlaunchbase.com" className="hover:text-white transition">Contact</a>
            </div>
            <p className="text-sm text-gray-500">
              © 2025 LaunchBase
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
