import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, ArrowRight, Sparkles, FileText, Gift, Check, Circle } from "lucide-react";

// Deployment steps with simulated progress
const DEPLOYMENT_STEPS = [
  { id: 1, label: "Payment received", duration: 0 },
  { id: 2, label: "Provisioning template", duration: 2000 },
  { id: 3, label: "Applying branding", duration: 3000 },
  { id: 4, label: "Publishing to web", duration: 4000 },
  { id: 5, label: "Connecting domain", duration: 5000 },
];

export default function PaymentSuccess() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (sid) {
      setSessionId(sid);
    }
  }, []);

  // Simulate deployment progress
  useEffect(() => {
    if (!isDeploying) return;

    const timers: NodeJS.Timeout[] = [];
    
    DEPLOYMENT_STEPS.forEach((step) => {
      if (step.duration > 0) {
        const timer = setTimeout(() => {
          setCurrentStep(step.id);
          if (step.id === DEPLOYMENT_STEPS.length) {
            setIsDeploying(false);
          }
        }, step.duration);
        timers.push(timer);
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [isDeploying]);

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
            <h1 className="text-3xl font-bold mb-2">Payment Confirmed</h1>
            <p className="text-muted-foreground text-lg">
              {isDeploying ? "We're deploying your site now..." : "Your site is ready for launch."}
            </p>
          </div>

          {/* Deployment Progress Card */}
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">Deployment Progress</span>
                  {isDeploying ? (
                    <span className="text-orange-500 font-semibold flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      In Progress
                    </span>
                  ) : (
                    <span className="text-green-500 font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Queued
                    </span>
                  )}
                </div>

                {/* Progress Steps */}
                <div className="space-y-3">
                  {DEPLOYMENT_STEPS.map((step) => {
                    const isCompleted = currentStep > step.id || (!isDeploying && currentStep >= step.id);
                    const isCurrent = currentStep === step.id && isDeploying;
                    
                    return (
                      <div 
                        key={step.id} 
                        className={`flex items-center gap-3 transition-opacity ${
                          isCompleted || isCurrent ? "opacity-100" : "opacity-40"
                        }`}
                      >
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                          isCompleted 
                            ? "bg-green-500 text-white" 
                            : isCurrent 
                              ? "bg-orange-500 text-white" 
                              : "bg-muted border border-border"
                        }`}>
                          {isCompleted ? (
                            <Check className="h-4 w-4" />
                          ) : isCurrent ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Circle className="h-3 w-3" />
                          )}
                        </div>
                        <span className={`text-sm ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Payment Details */}
              <div className="border-t mt-6 pt-4 space-y-2 text-sm">
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

          {/* Status Message */}
          <div className="text-muted-foreground space-y-2">
            <p>
              {isDeploying 
                ? "Your site is being deployed. This usually takes a few minutes."
                : "Deployment is queued. We'll email you when your site is live."
              }
            </p>
            <p className="text-sm text-muted-foreground/80">
              You can close this page — we'll send you an email when everything is ready.
            </p>
          </div>

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
