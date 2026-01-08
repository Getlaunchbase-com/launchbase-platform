import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Shield, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function Why() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img src="/logo-cropped.png" alt="LaunchBase" className="h-10 w-auto md:h-8 cursor-pointer" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/how-it-works" className="text-sm text-gray-400 hover:text-white transition">How It Works</Link>
            <Link href="/expand" className="text-sm text-gray-400 hover:text-white transition">Expand</Link>
            <Link href="/#pricing" className="text-sm text-gray-400 hover:text-white transition">Pricing</Link>
          </div>
          <Link href="/apply">
            <Button className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white">
              Apply <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Why LaunchBase Exists
          </h1>
          <p className="text-xl text-gray-400">
            Because running a business shouldn't require constant attention to things that don't generate value.
          </p>
        </div>
      </section>

      {/* The Origin */}
      <section className="py-16 px-4">
        <div className="container max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-[#FF6A00]">The Origin</h2>
          
          <p className="text-lg text-gray-300 mb-8">
            LaunchBase started with a simple frustration:
          </p>
          
          <blockquote className="border-l-4 border-[#FF6A00] pl-6 py-4 mb-8 bg-white/5 rounded-r-lg">
            <p className="text-xl text-white italic">
              "Why am I doing this manually when the system could just handle it?"
            </p>
          </blockquote>
          
          <p className="text-lg text-gray-300 mb-6">
            Websites. Deployments. Posting. Updates. Monitoring.
          </p>
          
          <p className="text-lg text-gray-300 mb-8">
            None of these should require daily thought — yet most tools force you to babysit them.
          </p>
          
          <p className="text-lg text-white font-medium">
            So instead of building another feature-packed platform, I built a foundation.
          </p>
        </div>
      </section>

      {/* Our Philosophy */}
      <section className="py-16 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="container max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-[#FF6A00]">Our Philosophy</h2>
          
          <p className="text-lg text-gray-300 mb-12">
            LaunchBase follows three rules:
          </p>
          
          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-[#FF6A00]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">1. Time is the most valuable resource</h3>
                <p className="text-gray-400">If a feature doesn't save time, it doesn't ship.</p>
              </div>
            </div>
            
            <div className="flex gap-6">
              <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-[#FF6A00]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">2. Silence is valid</h3>
                <p className="text-gray-400">Not every moment needs a post. Not every signal needs action.</p>
              </div>
            </div>
            
            <div className="flex gap-6">
              <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-[#FF6A00]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">3. Systems should scale, not demand attention</h3>
                <p className="text-gray-400">You shouldn't grow into more work. You should grow out of it.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What This Means for Customers */}
      <section className="py-16 px-4">
        <div className="container max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-[#FF6A00]">What This Means for Customers</h2>
          
          <p className="text-lg text-gray-300 mb-6">LaunchBase:</p>
          
          <ul className="space-y-4 mb-12">
            <li className="flex items-start gap-3 text-gray-300">
              <span className="text-[#FF6A00] mt-1">•</span>
              <span>Makes decisions with guardrails</span>
            </li>
            <li className="flex items-start gap-3 text-gray-300">
              <span className="text-[#FF6A00] mt-1">•</span>
              <span>Logs why it acted — or didn't</span>
            </li>
            <li className="flex items-start gap-3 text-gray-300">
              <span className="text-[#FF6A00] mt-1">•</span>
              <span>Improves without breaking what already works</span>
            </li>
            <li className="flex items-start gap-3 text-gray-300">
              <span className="text-[#FF6A00] mt-1">•</span>
              <span>Grows with your business instead of forcing migrations</span>
            </li>
          </ul>
          
          <p className="text-xl text-white font-medium">
            You don't need to learn LaunchBase.<br />
            You just need to trust it.
          </p>
        </div>
      </section>

      {/* Closing */}
      <section className="py-16 px-4 bg-white/[0.02] border-t border-white/5">
        <div className="container max-w-3xl mx-auto text-center">
          <p className="text-lg text-gray-400 mb-4">
            LaunchBase isn't built for everyone.
          </p>
          <p className="text-xl text-white font-medium mb-8">
            It's built for people who want their business to run without constant supervision.
          </p>
          <p className="text-2xl text-[#FF6A00] font-bold mb-12">
            If that sounds like you — welcome.
          </p>
          
          <Link href="/apply">
            <Button size="lg" className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-8 py-6">
              Apply to LaunchBase <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <Link href="/">
              <img src="/logo-cropped.png" alt="LaunchBase" className="h-6 w-auto opacity-60 hover:opacity-100 transition cursor-pointer" />
            </Link>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link href="/terms" className="hover:text-white transition">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
              <Link href="/trust" className="hover:text-white transition">Trust & Commitments</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
