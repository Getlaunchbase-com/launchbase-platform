import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Rocket, CheckCircle, XCircle, Clock, MessageSquare, Shield } from "lucide-react";
import { Link } from "wouter";

export default function WhatsIncluded() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-[#FF6A00] rounded-lg flex items-center justify-center">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">LAUNCHBASE</span>
            </div>
          </Link>
          <Link href="/onboarding">
            <Button className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white">
              Apply for LaunchBase <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            What's Included
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Everything you need to launch a professional website for your service business — 
            without the agency price tag or DIY headaches.
          </p>
        </div>
      </section>

      {/* How LaunchBase Works */}
      <section className="py-16 px-4 border-b border-white/10">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">How LaunchBase Works</h2>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-[#FF6A00]/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#FF6A00] font-bold">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Complete the intake</h3>
                <p className="text-gray-400">Answer a few questions about your business, services, and how customers should reach you. Takes about 5 minutes.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-[#FF6A00]/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#FF6A00] font-bold">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">We build your site</h3>
                <p className="text-gray-400">Our system generates a custom website with professional copy, optimized for your specific business type and industry.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-[#FF6A00]/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#FF6A00] font-bold">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Human review</h3>
                <p className="text-gray-400">A real person reviews everything before it's ready — catching edge cases and ensuring quality.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-[#FF6A00]/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#FF6A00] font-bold">4</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">You preview & approve</h3>
                <p className="text-gray-400">Review your site before it goes live. Request changes if needed — nothing launches until you're happy.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-[#FF6A00]/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#FF6A00] font-bold">5</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Launch & ongoing support</h3>
                <p className="text-gray-400">Your site goes live. We handle hosting, updates, and support going forward.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">What's Included</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-[#FF6A00]" />
                  Website Build
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Custom-built professional website</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Industry-specific structure & layout</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Professional copywriting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Mobile-responsive design</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Human review before launch</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#FF6A00]" />
                  Lead Capture
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Click-to-call buttons</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Contact forms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Quote request forms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Booking link integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Clear calls-to-action</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#FF6A00]" />
                  Hosting & Infrastructure
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Fast, reliable hosting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">SSL certificate (https)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Domain setup assistance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Uptime monitoring</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Security updates</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#FF6A00]" />
                  Ongoing Support
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Content updates on request</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">LaunchBase dashboard access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Email support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Platform improvements over time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#1ED760] mt-1 flex-shrink-0" />
                    <span className="text-gray-300">Cancel anytime</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What's NOT Included */}
      <section className="py-16 px-4 bg-white/[0.02]">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-center">What's Not Included</h2>
          <p className="text-gray-400 text-center mb-8 max-w-2xl mx-auto">
            We focus on what we do best. Here's what's outside our current scope:
          </p>
          
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-400">E-commerce / online stores</span>
            </div>
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-400">Custom booking systems</span>
            </div>
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-400">Payment processing</span>
            </div>
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-400">Marketing / SEO services</span>
            </div>
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-400">Logo design</span>
            </div>
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-400">Social media management</span>
            </div>
          </div>
          
          <p className="text-gray-500 text-sm text-center mt-8">
            Need something not listed? <a href="mailto:hello@getlaunchbase.com" className="text-[#FF6A00] hover:underline">Let us know</a> — we're always expanding.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Timeline Expectations</h2>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-2xl mx-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-300">Intake completion</span>
                <span className="font-semibold">~5 minutes</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-300">Site build & review</span>
                <span className="font-semibold">24–72 hours</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-300">Your review & feedback</span>
                <span className="font-semibold">At your pace</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Launch after approval</span>
                <span className="font-semibold">Same day</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Summary */}
      <section className="py-16 px-4 bg-white/[0.02]">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Pricing Summary</h2>
          
          <Card className="bg-white/5 border-white/10 max-w-lg mx-auto">
            <CardContent className="pt-8 pb-8">
              <div className="text-center mb-6">
                <p className="text-[#FF6A00] font-semibold text-sm mb-4">Founding Client Pricing</p>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-4xl font-bold">$499</span>
                  <span className="text-gray-400">one-time setup</span>
                </div>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-2xl font-bold">$79</span>
                  <span className="text-gray-400">/ month ongoing</span>
                </div>
              </div>
              
              <div className="border-t border-white/10 pt-6 mt-6">
                <p className="text-sm text-gray-400 mb-4">This includes:</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Website build & deployment</li>
                  <li>• Hosting & infrastructure</li>
                  <li>• Ongoing updates and support</li>
                  <li>• Platform improvements over time</li>
                </ul>
              </div>
              
              <div className="border-t border-white/10 pt-6 mt-6">
                <p className="text-sm text-gray-400 mb-4">There are:</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• No contracts</li>
                  <li>• No hidden fees</li>
                  <li>• No long-term commitments</li>
                </ul>
              </div>
              
              <p className="text-xs text-gray-500 text-center mt-6">
                Founding client pricing is locked for as long as the account remains active.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to launch?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Complete the intake and we'll start building your site.
          </p>
          <Link href="/onboarding">
            <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6">
              Start Your Launch <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/10">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-6 h-6 bg-[#FF6A00] rounded flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold">LAUNCHBASE</span>
              </div>
            </Link>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/" className="hover:text-white transition">Home</Link>
              <a href="/#pricing" className="hover:text-white transition">Pricing</a>
              <Link href="/trust" className="hover:text-white transition">Trust & Commitments</Link>
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
