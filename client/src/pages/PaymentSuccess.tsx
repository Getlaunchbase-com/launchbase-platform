import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, ArrowRight, Sparkles, Rocket, FileText, Gift } from "lucide-react";

export default function PaymentSuccess() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (sid) {
      setSessionId(sid);
    }
  }, []);

  const { data: session, isLoading } = trpc.payment.getSession.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  if (isLoading || !sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">LAUNCHBASE</span>
          </Link>
        </div>
      </header>

      <main className="container max-w-xl py-16">
        <div className="text-center space-y-6">
          {/* Success Icon */}
          <div className="mx-auto h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Payment Confirmed ✅</h1>
            <p className="text-muted-foreground text-lg">
              You're officially queued for launch.
            </p>
          </div>

          {/* Status Card */}
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Status</span>
                <span className="text-green-500 font-semibold flex items-center gap-2">
                  <Rocket className="h-4 w-4" />
                  Ready to Deploy
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Estimated time: We'll deploy within 24–48 hours</p>
              </div>
              
              {/* Payment Details */}
              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount paid</span>
                  <span className="font-medium">
                    ${((session?.amountTotal || 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{session?.customerEmail}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Step */}
          <p className="text-muted-foreground">
            Next step: <span className="text-foreground font-medium">deployment</span>.
            We'll email you when your site is live.
          </p>
          <p className="text-sm text-muted-foreground/80">
            Your preview link has been emailed to you for reference.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-orange-500 hover:bg-orange-600">
              <Link href="/">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={`mailto:support@launchbase.com?subject=Receipt Request`}>
                <FileText className="mr-2 h-4 w-4" />
                View Receipt
              </a>
            </Button>
          </div>

          {/* Referral CTA */}
          <Card className="border-orange-500/20 bg-orange-500/5 mt-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">Refer a friend, get $50</p>
                  <p className="text-xs text-muted-foreground">Share LaunchBase and both save $50</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/referrals">Get Code</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Help */}
          <p className="text-xs text-muted-foreground pt-4">
            Questions? Email support@launchbase.com
          </p>
        </div>
      </main>
    </div>
  );
}
