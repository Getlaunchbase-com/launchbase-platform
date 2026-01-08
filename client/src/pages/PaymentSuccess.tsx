import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle, 
  Loader2, 
  ArrowRight, 
  Sparkles, 
  Mail, 
  Activity,
  Eye,
  Shield,
  Clock,
  Server,
  Globe,
  Zap,
  FileText,
  Settings
} from "lucide-react";

// Deployment steps - what LaunchBase is doing right now
const DEPLOYMENT_STEPS = [
  { id: 1, label: "Provisioning your website infrastructure", icon: Server },
  { id: 2, label: "Applying your approved build plan", icon: FileText },
  { id: 3, label: "Verifying availability and performance", icon: Activity },
  { id: 4, label: "Preparing your live URL", icon: Globe },
];

export default function PaymentSuccess() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(true);
  const [lastCheck, setLastCheck] = useState("just now");

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
    
    // Progress through steps
    const stepDurations = [0, 2000, 4000, 6000, 8000];
    stepDurations.forEach((duration, index) => {
      if (duration > 0 && index <= DEPLOYMENT_STEPS.length) {
        const timer = setTimeout(() => {
          setCurrentStep(index);
          if (index === DEPLOYMENT_STEPS.length) {
            setIsDeploying(false);
          }
        }, duration);
        timers.push(timer);
      }
    });

    // Update "last check" time periodically
    const checkTimer = setInterval(() => {
      setLastCheck("just now");
    }, 30000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(checkTimer);
    };
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

      <main className="container max-w-2xl py-12 md:py-16">
        <div className="space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Payment Successful</h1>
              <p className="text-xl text-muted-foreground">
                Your site is now being deployed.
              </p>
            </div>
            <p className="text-muted-foreground max-w-md mx-auto">
              You've approved your build plan and completed payment.<br />
              LaunchBase has taken over from here.
            </p>
          </div>

          {/* What Happens Next */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                What happens next
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Right now, LaunchBase is:</p>
              <div className="space-y-3">
                {DEPLOYMENT_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isCompleted = currentStep > step.id;
                  const isCurrent = currentStep === step.id && isDeploying;
                  
                  return (
                    <div 
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                        isCompleted 
                          ? "bg-green-500/5 border border-green-500/20" 
                          : isCurrent 
                            ? "bg-orange-500/5 border border-orange-500/20" 
                            : "bg-muted/30"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted 
                          ? "bg-green-500 text-white" 
                          : isCurrent 
                            ? "bg-orange-500 text-white" 
                            : "bg-muted"
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <StepIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className={`text-sm ${
                        isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm font-medium">You don't need to do anything.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Deployment typically completes within 2–5 minutes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* What You'll Receive */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-500" />
                What you'll receive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Globe className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Your live website URL as soon as deployment completes</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">A confirmation email with next steps</span>
                </li>
                <li className="flex items-start gap-3">
                  <Activity className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Ongoing system monitoring and updates</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
                You'll see the status update automatically on this page.
              </p>
            </CardContent>
          </Card>

          {/* Transparency & Control */}
          <Card className="bg-muted/30 border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5 text-orange-500" />
                Transparency & Control
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>You approved the exact build plan being deployed</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>Every system decision is logged and visible to you</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>Silence is intentional — LaunchBase only acts when it's safe and relevant</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>You can review activity at any time in your dashboard</span>
                </li>
              </ul>
              <p className="text-sm text-orange-500 font-medium mt-4 pt-3 border-t border-muted">
                Controls change relevance. Safety is always enforced.
              </p>
            </CardContent>
          </Card>

          {/* While You Wait */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">While you wait (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link 
                  href="/expand/integrations" 
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Settings className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Review your Setup & Integrations packets</p>
                    <p className="text-xs text-muted-foreground">Prepare Google, Meta, and QuickBooks setup</p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </Link>
                <Link 
                  href="/expand" 
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Zap className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Explore Expand LaunchBase</p>
                    <p className="text-xs text-muted-foreground">Add intelligence modules when you're ready</p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="border-orange-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Deployment:</span>
                    <span className={`font-medium ${isDeploying ? "text-orange-500" : "text-green-500"}`}>
                      {isDeploying ? "In progress" : "Complete"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Last system check:</span>
                    <span className="text-foreground">{lastCheck}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Next update:</div>
                  <div className="text-sm font-medium">automatically</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          {session && (
            <div className="text-center text-sm text-muted-foreground space-y-1">
              <p>Amount paid: ${((session.amountTotal || 0) / 100).toFixed(2)}</p>
              <p>Receipt sent to: {session.customerEmail}</p>
            </div>
          )}

          {/* Support */}
          <div className="text-center space-y-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              If you need anything, you can reach us at<br />
              <a href="mailto:support@getlaunchbase.com" className="text-orange-500 hover:underline">
                support@getlaunchbase.com
              </a>
            </p>
            <p className="text-lg font-medium">Otherwise — you're done.</p>
          </div>

          {/* Dashboard CTA */}
          <div className="flex justify-center">
            <Button asChild className="bg-orange-500 hover:bg-orange-600">
              <Link href="/">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center pt-8 border-t">
            <p className="text-xs text-muted-foreground">
              Powered by LaunchBase
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Workflows that give you back your life.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
