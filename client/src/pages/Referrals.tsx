import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, 
  Copy, 
  CheckCircle, 
  Users, 
  DollarSign,
  Share2,
  ArrowLeft,
  Rocket
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function Referrals() {
  const [intakeId, setIntakeId] = useState("");
  const [email, setEmail] = useState("");
  const [showDashboard, setShowDashboard] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Create referral code mutation
  const createReferralMutation = trpc.referral.create.useMutation({
    onSuccess: (data) => {
      setReferralCode(data.code);
      setShowDashboard(true);
      if (data.alreadyExists) {
        toast.info("Found your existing referral code!");
      } else {
        toast.success("Your referral code is ready!");
      }
    },
    onError: (error) => {
      toast.error("Failed to create referral code: " + error.message);
    },
  });

  // Get referral stats
  const { data: stats } = trpc.referral.getStats.useQuery(
    { intakeId: parseInt(intakeId) || 0 },
    { enabled: showDashboard && !!intakeId }
  );

  const handleGetCode = () => {
    if (!intakeId || !email) {
      toast.error("Please enter your intake ID and email");
      return;
    }
    createReferralMutation.mutate({
      intakeId: parseInt(intakeId),
      email,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const shareUrl = referralCode 
    ? `${window.location.origin}/onboarding?ref=${referralCode}`
    : "";

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center cursor-pointer">
              <img src="/logo-full-dark.png" alt="LaunchBase" className="h-8" />
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-20 px-4">
        <div className="container max-w-2xl mx-auto">
          {!showDashboard ? (
            <>
              {/* Hero */}
              <div className="text-center mb-12">
                <div className="w-16 h-16 bg-[#FF6A00]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Gift className="w-8 h-8 text-[#FF6A00]" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-4">
                  Refer a Friend, Get $50
                </h1>
                <p className="text-gray-400 text-lg">
                  Share LaunchBase with other service businesses. When they launch, 
                  you both save $50.
                </p>
              </div>

              {/* How It Works */}
              <Card className="bg-white/5 border-white/10 mb-8">
                <CardHeader>
                  <CardTitle className="text-lg">How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-[#FF6A00]/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#FF6A00]">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Get your referral code</p>
                      <p className="text-sm text-gray-400">Enter your intake ID and email below</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-[#FF6A00]/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#FF6A00]">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Share with friends</p>
                      <p className="text-sm text-gray-400">Send your unique link to other business owners</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-[#FF6A00]/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#FF6A00]">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Both save $50</p>
                      <p className="text-sm text-gray-400">They get $50 off setup, you get $50 credit</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Get Code Form */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle>Get Your Referral Code</CardTitle>
                  <CardDescription>
                    Enter your LaunchBase intake ID and email to generate your referral code.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Intake ID</label>
                    <Input
                      type="number"
                      placeholder="e.g., 12345"
                      value={intakeId}
                      onChange={(e) => setIntakeId(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Check your confirmation email for your intake ID
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Email</label>
                    <Input
                      type="email"
                      placeholder="you@business.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <Button 
                    onClick={handleGetCode}
                    disabled={createReferralMutation.isPending}
                    className="w-full bg-[#FF6A00] hover:bg-[#FF6A00]/90"
                  >
                    {createReferralMutation.isPending ? "Creating..." : "Get My Referral Code"}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* Referral Dashboard */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Your Referral Dashboard</h1>
                <p className="text-gray-400">Share your code and track your rewards</p>
              </div>

              {/* Referral Code Card */}
              <Card className="bg-gradient-to-r from-[#FF6A00]/20 to-[#FF6A00]/5 border-[#FF6A00]/30 mb-6">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-2">Your Referral Code</p>
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <span className="text-4xl font-bold tracking-wider text-[#FF6A00]">
                        {referralCode || stats?.code}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(referralCode || stats?.code || "")}
                      >
                        <Copy className="w-5 h-5" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-400">
                      Friends use this code at checkout to save $50
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Share Link */}
              <Card className="bg-white/5 border-white/10 mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-[#FF6A00]" />
                    Share Your Link
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="bg-white/5 border-white/10 text-sm"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => copyToClipboard(shareUrl)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Anyone who signs up with this link automatically gets $50 off
                  </p>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6 text-center">
                    <Users className="w-8 h-8 text-[#FF6A00] mx-auto mb-2" />
                    <p className="text-3xl font-bold">{stats?.successfulReferrals || 0}</p>
                    <p className="text-sm text-gray-400">Successful Referrals</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6 text-center">
                    <DollarSign className="w-8 h-8 text-[#1ED760] mx-auto mb-2" />
                    <p className="text-3xl font-bold">${stats?.totalEarnings || 0}</p>
                    <p className="text-sm text-gray-400">Total Credits</p>
                  </CardContent>
                </Card>
              </div>

              {/* Reward Status */}
              {stats?.rewardApplied && (
                <Card className="bg-[#1ED760]/10 border-[#1ED760]/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-[#1ED760]" />
                      <div>
                        <p className="font-medium text-[#1ED760]">Reward Applied!</p>
                        <p className="text-sm text-gray-400">
                          Your referral credit has been applied to your account
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tips */}
              <Card className="bg-white/5 border-white/10 mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Tips for Sharing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-gray-400">
                  <p>• Share with other service business owners you know</p>
                  <p>• Post in local business groups or networking events</p>
                  <p>• Mention it when talking to fellow contractors or professionals</p>
                  <p>• There's no limit to how many people you can refer!</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="container max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 bg-[#FF6A00] rounded flex items-center justify-center">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">LAUNCHBASE</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-2">
            <Link href="/trust" className="hover:text-white transition">Trust & Commitments</Link>
          </div>
          <p className="text-sm text-gray-500">© 2025 LaunchBase</p>
        </div>
      </footer>
    </div>
  );
}
