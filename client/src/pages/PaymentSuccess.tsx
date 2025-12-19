import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, ArrowRight, Mail, Clock, Sparkles } from "lucide-react";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
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

      <main className="container max-w-2xl py-16">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Payment Successful!</CardTitle>
            <CardDescription className="text-base">
              Thank you for choosing LaunchBase. Your website build is now in progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Details */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-medium">
                  ${((session?.amountTotal || 0) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{session?.customerEmail}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-green-500 capitalize">
                  {session?.status || "Paid"}
                </span>
              </div>
            </div>

            {/* What's Next */}
            <div className="space-y-4">
              <h3 className="font-semibold">What happens next?</h3>
              
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Confirmation email sent</p>
                    <p className="text-sm text-muted-foreground">
                      Check your inbox for payment confirmation and next steps.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Site build begins</p>
                    <p className="text-sm text-muted-foreground">
                      Our team will start building your website within 24 hours.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Preview & launch</p>
                    <p className="text-sm text-muted-foreground">
                      You'll receive a preview link within 24-72 hours to review before launch.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-4 border-t border-border">
              <Button asChild className="w-full bg-orange-500 hover:bg-orange-600">
                <Link href="/">
                  Return to Home
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <p className="text-center text-sm text-muted-foreground mt-3">
                Questions? Email us at support@launchbase.com
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
