import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle, 
  Loader2, 
  Sparkles, 
  Globe, 
  Phone, 
  Mail, 
  MapPin,
  CreditCard,
  ArrowRight,
  MessageSquare,
  ExternalLink
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function CustomerPreview() {
  const { token } = useParams<{ token: string }>();
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  // Fetch intake by preview token
  const { data: intake, isLoading, error } = trpc.intake.getByPreviewToken.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  // Create checkout session
  const checkoutMutation = trpc.payment.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error) => {
      toast.error("Failed to start checkout: " + error.message);
    },
  });

  // Submit feedback/revision request
  const feedbackMutation = trpc.intake.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success("Feedback submitted! We'll review and update your site.");
      setShowFeedback(false);
      setFeedback("");
    },
    onError: (error) => {
      toast.error("Failed to submit feedback: " + error.message);
    },
  });

  const handleApproveAndPay = () => {
    if (!intake) return;
    
    checkoutMutation.mutate({
      intakeId: intake.id,
      email: intake.email,
      name: intake.contactName || intake.businessName,
    });
  };

  const handleSubmitFeedback = () => {
    if (!intake || !feedback.trim()) return;
    
    feedbackMutation.mutate({
      intakeId: intake.id,
      feedback: feedback.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !intake) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40 bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl">LAUNCHBASE</span>
            </Link>
          </div>
        </header>
        <main className="container max-w-2xl py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Preview Not Found</h1>
          <p className="text-muted-foreground">
            This preview link may have expired or is invalid.
          </p>
        </main>
      </div>
    );
  }

  const isReadyForReview = intake.status === "ready_for_review";
  const isPaid = intake.status === "paid" || intake.status === "deployed";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">LAUNCHBASE</span>
          </Link>
        </div>
      </header>

      <main className="container max-w-4xl py-8 md:py-16">
        {/* Status Banner */}
        {isPaid && (
          <div className="mb-8 rounded-lg bg-green-500/10 border border-green-500/20 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-green-500 font-medium">
              Payment complete! Your site is being deployed.
            </span>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Website Preview</h1>
              <p className="text-muted-foreground">
                Review your site below. When you're happy, approve and pay to launch.
              </p>
            </div>

            {/* Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-orange-500" />
                  {intake.businessName}
                </CardTitle>
                <CardDescription>
                  {intake.vertical === "trades" && "Trades & Contractors"}
                  {intake.vertical === "appointments" && "Appointment-Based Business"}
                  {intake.vertical === "professional" && "Professional Services"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview iframe or placeholder */}
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border">
                  {intake.previewUrl ? (
                    <iframe 
                      src={intake.previewUrl} 
                      className="w-full h-full rounded-lg"
                      title="Website Preview"
                    />
                  ) : (
                    <div className="text-center p-8">
                      <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Preview will appear here once your site is ready
                      </p>
                    </div>
                  )}
                </div>

                {intake.previewUrl && (
                  <Button variant="outline" asChild className="w-full">
                    <a href={intake.previewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Full Preview
                    </a>
                  </Button>
                )}

                {/* Business Info Summary */}
                <div className="grid gap-3 pt-4 border-t">
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{intake.phone || "No phone provided"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{intake.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{intake.serviceArea?.join(", ") || "Service area not specified"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feedback Section */}
            {isReadyForReview && !showFeedback && (
              <Button 
                variant="outline" 
                onClick={() => setShowFeedback(true)}
                className="w-full"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Request Changes
              </Button>
            )}

            {showFeedback && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Request Changes</CardTitle>
                  <CardDescription>
                    Tell us what you'd like updated. We'll revise and send a new preview.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Example: Can you change the headline to emphasize 24/7 availability? Also, please use a darker blue color."
                    className="min-h-32"
                  />
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleSubmitFeedback}
                      disabled={!feedback.trim() || feedbackMutation.isPending}
                    >
                      {feedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setShowFeedback(false);
                        setFeedback("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Payment Card */}
          <div className="space-y-6">
            <Card className={isReadyForReview ? "border-orange-500/50" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-500" />
                  Founding Client Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Setup fee</span>
                    <span className="font-bold text-2xl">$499</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monthly (after launch)</span>
                    <span>$79/mo</span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Professional website</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Hosting included</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Ongoing support</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Cancel anytime</span>
                  </div>
                </div>

                {isReadyForReview && !isPaid && (
                  <Button 
                    onClick={handleApproveAndPay}
                    disabled={checkoutMutation.isPending}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                    size="lg"
                  >
                    {checkoutMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Approve & Pay $499
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}

                {isPaid && (
                  <div className="text-center py-2">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-500">Payment Complete</p>
                  </div>
                )}

                {!isReadyForReview && !isPaid && (
                  <p className="text-sm text-muted-foreground text-center">
                    Payment available once your preview is ready
                  </p>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              Questions? Email support@launchbase.com
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
