import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, Mail, Rocket } from "lucide-react";
import { Link } from "wouter";

export default function OnboardingSuccess() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-[#1ED760]/20 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-10 h-10 text-[#1ED760]" />
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Intake Submitted!
        </h1>
        
        <p className="text-gray-400 text-lg mb-8">
          Thanks for completing your launch intake. We're now building your custom website.
        </p>

        {/* Status Cards */}
        <div className="space-y-4 mb-8">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 bg-[#1ED760]/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[#1ED760]" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Intake Received</p>
                <p className="text-sm text-gray-400">Your information has been submitted</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 bg-[#FF6A00]/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#FF6A00]" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Build Plan in Progress</p>
                <p className="text-sm text-gray-400">We're generating your custom site plan</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 opacity-50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Rocket className="w-5 h-5 text-gray-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-400">Ready for Launch</p>
                <p className="text-sm text-gray-500">Coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* What's Next */}
        <Card className="bg-[#FF6A00]/10 border-[#FF6A00]/30 mb-8">
          <CardContent className="py-6">
            <div className="flex items-center gap-3 justify-center mb-3">
              <Mail className="w-5 h-5 text-[#FF6A00]" />
              <p className="font-semibold">What happens next?</p>
            </div>
            <p className="text-sm text-gray-300">
              We'll review your intake and may reach out if we need any clarification. 
              You'll receive an email when your site is ready for review.
            </p>
          </CardContent>
        </Card>

        <Link href="/">
          <Button variant="outline" className="border-white/20 hover:bg-white/10">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
