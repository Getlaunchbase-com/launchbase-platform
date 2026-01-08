import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft, MessageCircle, Sparkles } from "lucide-react";

export default function PaymentCancel() {
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
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <XCircle className="h-10 w-10 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
            <CardDescription className="text-base">
              No worries — your intake is saved and you can complete payment anytime.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Reassurance */}
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                Your website intake has been saved. When you're ready to proceed, 
                you can return to complete your payment and we'll start building 
                your site right away.
              </p>
            </div>

            {/* Common Questions */}
            <div className="space-y-4">
              <h3 className="font-semibold">Have questions?</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <MessageCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Not sure if LaunchBase is right for you?</p>
                    <p className="text-muted-foreground">
                      Check out our <Link href="/whats-included" className="text-orange-500 hover:underline">What's Included</Link> page 
                      to see everything you get.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <MessageCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Want to talk to someone first?</p>
                    <p className="text-muted-foreground">
                      Email us at support@launchbase.com and we'll answer any questions.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="pt-4 border-t border-border space-y-3">
              <Button asChild className="w-full bg-orange-500 hover:bg-orange-600">
                <Link href="/onboarding">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Intake
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">
                  Go to Homepage
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
