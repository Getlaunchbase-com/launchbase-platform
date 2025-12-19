import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Zap, Clock, Shield, CheckCircle, Rocket, Users, Building2 } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FF6A00] rounded-lg flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LAUNCHBASE</span>
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
          
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            One intake. One conversation. A complete website built for your business — 
            ready to attract customers and grow your revenue.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/onboarding">
              <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6">
                Complete Your Launch Intake <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <p className="text-sm text-gray-500">Takes about 5 minutes</p>
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
                Our system generates a custom website with professional copy, 
                optimized for your specific business type.
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

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to launch your business online?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Join our founding client program and get your professional website 
            at a steep discount while we perfect the platform.
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
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#FF6A00] rounded flex items-center justify-center">
                <Rocket className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">LAUNCHBASE</span>
            </div>
            <p className="text-sm text-gray-500">
              © 2025 LaunchBase. The operating system for launching service businesses.
            </p>
            <a href="mailto:hello@getlaunchbase.com" className="text-sm text-gray-400 hover:text-white">
              hello@getlaunchbase.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
