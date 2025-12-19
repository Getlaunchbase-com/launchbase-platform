import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, Mail, Rocket, Sparkles } from "lucide-react";
import { Link } from "wouter";

export default function OnboardingSuccess() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-[#1ED760]/20 rounded-full flex items-center justify-center mx-auto mb-8">
          <Sparkles className="w-10 h-10 text-[#1ED760]" />
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Your site is in progress
        </h1>
        
        <p className="text-gray-400 text-lg mb-8">
          We're building your website now. You'll receive an email when it's ready to review.
        </p>

        {/* Estimated Time */}
        <Card className="bg-[#FF6A00]/10 border-[#FF6A00]/30 mb-8">
          <CardContent className="py-6">
            <div className="flex items-center gap-3 justify-center mb-2">
              <Clock className="w-5 h-5 text-[#FF6A00]" />
              <p className="font-semibold">Estimated turnaround: 24–72 hours</p>
            </div>
            <p className="text-sm text-gray-400">
              Most sites are ready within a day. Complex requests may take slightly longer.
            </p>
          </CardContent>
        </Card>

        {/* Status Cards */}
        <div className="space-y-4 mb-8">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 bg-[#1ED760]/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[#1ED760]" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Intake Complete</p>
                <p className="text-sm text-gray-400">Your information has been received</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 bg-[#FF6A00]/20 rounded-lg flex items-center justify-center animate-pulse">
                <Rocket className="w-5 h-5 text-[#FF6A00]" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Building Your Site</p>
                <p className="text-sm text-gray-400">AI is generating your custom website</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 opacity-50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-gray-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-400">Review & Launch</p>
                <p className="text-sm text-gray-500">We'll email you when ready</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* What's Next */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8 text-left">
          <h3 className="font-semibold mb-3">What happens next?</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#1ED760] mt-0.5 flex-shrink-0" />
              <span>A real human reviews everything before launch</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#1ED760] mt-0.5 flex-shrink-0" />
              <span>We may reach out if we need any clarification</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#1ED760] mt-0.5 flex-shrink-0" />
              <span>You'll get to review and approve before going live</span>
            </li>
          </ul>
        </div>

        <Link href="/">
          <Button variant="outline" className="border-white/20 hover:bg-white/10">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
