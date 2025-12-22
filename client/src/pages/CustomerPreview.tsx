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
  ExternalLink,
  FileText,
  Clock,
  Shield,
  Zap
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Business module definitions with production copy
const BUSINESS_MODULES = [
  {
    id: "quickbooks" as const,
    name: "Accounting Activation (QuickBooks)",
    headline: "Connect LaunchBase to QuickBooks so customers, estimates, and invoices sync automatically.",
    setupFee: 499,
    monthlyFee: 0,
    includes: [
      "Secure connection & verification",
      "Customer + invoice/estimate sync",
      "Test transaction to confirm everything works",
    ],
    note: "You'll sign in to QuickBooks during setup. We never store your password.",
  },
  {
    id: "google_ads" as const,
    name: "Lead Engine Activation (Google Ads)",
    headline: "Connect your site to Google Ads with proper tracking so clicks turn into real leads.",
    setupFee: 499,
    monthlyFee: 0,
    includes: [
      "Conversion tracking (forms + calls)",
      "Local targeting scaffold",
      "Lead verification test",
    ],
    note: "Ad spend is paid to Google separately. This activation ensures tracking and setup are correct.",
  },
];

type FlowStep = "review" | "activate" | "checkout";

export default function CustomerPreview() {
  const { token } = useParams<{ token: string }>();
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedModules, setSelectedModules] = useState<("google_ads" | "quickbooks")[]>([]);
  const [currentStep, setCurrentStep] = useState<FlowStep>("review");
  const [isApproved, setIsApproved] = useState(false);
  const [checkoutApprovalChecked, setCheckoutApprovalChecked] = useState(false);

  // Fetch intake by preview token
  const { data: intake, isLoading, error } = trpc.intake.getByPreviewToken.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  // Log approval event
  const logApprovalMutation = trpc.intake.logApproval.useMutation();

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
      toast.success("Change request submitted! We'll revise and send a new preview.");
      setShowFeedback(false);
      setFeedback("");
    },
    onError: (error) => {
      toast.error("Failed to submit request: " + error.message);
    },
  });

  const toggleModule = (moduleId: "google_ads" | "quickbooks") => {
    setSelectedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const calculateTotal = () => {
    const baseSetup = 499;
    const moduleSetup = selectedModules.reduce((sum, moduleId) => {
      const module = BUSINESS_MODULES.find(m => m.id === moduleId);
      return sum + (module?.setupFee || 0);
    }, 0);
    return baseSetup + moduleSetup;
  };

  const handleApprove = async () => {
    if (!intake) return;
    
    // Log the approval event with legal details
    await logApprovalMutation.mutateAsync({
      intakeId: intake.id,
      userAgent: navigator.userAgent,
    });
    
    setIsApproved(true);
    setCurrentStep("activate");
  };

  const handleProceedToCheckout = () => {
    setCurrentStep("checkout");
  };

  const handlePaySecurely = () => {
    if (!intake) return;
    
    checkoutMutation.mutate({
      intakeId: intake.id,
      email: intake.email,
      name: intake.contactName || intake.businessName,
      modules: selectedModules,
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
        <Header />
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
      <Header />

      <main className="container max-w-4xl py-8 md:py-16">
        {/* Payment Complete Banner */}
        {isPaid && (
          <div className="mb-8 rounded-lg bg-green-500/10 border border-green-500/20 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <span className="text-green-500 font-medium">Payment Confirmed ✅</span>
              <p className="text-sm text-muted-foreground">You're officially queued for launch.</p>
            </div>
          </div>
        )}

        {/* Approval Confirmation Banner */}
        {isApproved && !isPaid && currentStep !== "review" && (
          <div className="mb-8 rounded-lg bg-orange-500/10 border border-orange-500/20 p-4">
            <p className="text-orange-500 font-medium">
              Build plan approved. Next: choose any optional modules you want activated before launch.
            </p>
          </div>
        )}

        {/* Step 1: Review Build Plan */}
        {currentStep === "review" && !isPaid && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Review Your Build Plan</h1>
              <p className="text-muted-foreground">
                Everything below will be included in your LaunchBase launch.
                If anything looks off, request a change before approving.
              </p>
            </div>

            {/* Build Plan Card */}
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
              <CardContent className="space-y-6">
                {/* Live Preview */}
                <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                  {(intake as any).previewHTML ? (
                    <iframe 
                      srcDoc={(intake as any).previewHTML}
                      className="w-full h-full"
                      title="Website Preview"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-center p-8">
                      <div>
                        <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Preview will appear here once your site is ready
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {(intake as any).previewHTML && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      const newWindow = window.open('', '_blank');
                      if (newWindow) {
                        newWindow.document.write((intake as any).previewHTML);
                        newWindow.document.close();
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Full Preview
                  </Button>
                )}

                {/* Business Overview */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Business Overview
                  </h3>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{intake.phone || "No phone provided"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{intake.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{intake.serviceArea?.join(", ") || "Service area not specified"}</span>
                    </div>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4" />
                    Pricing Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">LaunchBase Setup</span>
                      <span className="font-medium">$499</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Platform Access</span>
                      <span>$79/mo (starts after launch)</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4" />
                    Timeline
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    After payment, we'll deploy within 24–48 hours.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Request Changes */}
            {isReadyForReview && !showFeedback && (
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowFeedback(true)}
                  className="w-full"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Request Changes
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Want changes before launch? Request edits — no charge before approval.
                </p>
              </div>
            )}

            {showFeedback && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Request a Change</CardTitle>
                  <CardDescription>
                    Tell us what to adjust. Be specific—this becomes the next build plan revision.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder='Example: Add a "Service Areas" section and change CTA from "Call Now" to "Request Quote."'
                    className="min-h-32"
                  />
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleSubmitFeedback}
                      disabled={!feedback.trim() || feedbackMutation.isPending}
                    >
                      {feedbackMutation.isPending ? "Sending..." : "Send Request"}
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

            {/* Approve Button */}
            {isReadyForReview && !showFeedback && (
              <div className="space-y-3">
                <Button 
                  onClick={handleApprove}
                  disabled={logApprovalMutation.isPending}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  size="lg"
                >
                  {logApprovalMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      Approve & Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  By proceeding, you approve this build plan and agree to{" "}
                  <Link href="/terms" className="underline hover:text-foreground">
                    LaunchBase's terms
                  </Link>.
                  Your site will be deployed immediately after payment.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Activate Modules */}
        {currentStep === "activate" && !isPaid && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Activate Your Business Systems</h1>
              <p className="text-muted-foreground">
                LaunchBase Core gets your site live.
                Add modules below if you want us to connect the tools you already use—correctly.
              </p>
            </div>

            <h2 className="text-lg font-semibold">Recommended for Most Businesses</h2>

            {/* Module Cards */}
            <div className="space-y-4">
              {BUSINESS_MODULES.map((module) => (
                <Card 
                  key={module.id}
                  className={`cursor-pointer transition-all ${
                    selectedModules.includes(module.id)
                      ? "border-orange-500 bg-orange-500/5"
                      : "hover:border-orange-500/50"
                  }`}
                  onClick={() => toggleModule(module.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          selectedModules.includes(module.id)
                            ? "border-orange-500 bg-orange-500"
                            : "border-muted-foreground"
                        }`}>
                          {selectedModules.includes(module.id) && (
                            <CheckCircle className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <h3 className="font-semibold">{module.name}</h3>
                      </div>
                      <span className="font-bold text-lg">${module.setupFee}</span>
                    </div>
                    
                    <p className="text-muted-foreground mb-4">{module.headline}</p>
                    
                    <div className="space-y-2 mb-4">
                      <p className="text-sm font-medium">Includes:</p>
                      <ul className="space-y-1">
                        {module.includes.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <p className="text-xs text-muted-foreground italic">{module.note}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Summary Box */}
            <Card className="border-orange-500/50">
              <CardHeader>
                <CardTitle>Today's Total</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">LaunchBase Setup</span>
                  <span>$499</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Activated Modules</span>
                  <span>${selectedModules.length * 499}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>${calculateTotal()}</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Monthly Platform Access: $79/mo (starts after launch)</p>
                  <p className="text-xs mt-1">You can cancel anytime. Your website stays live through the current billing period.</p>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleProceedToCheckout}
                className="w-full bg-orange-500 hover:bg-orange-600"
                size="lg"
              >
                Continue to Secure Checkout
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button 
                variant="ghost"
                onClick={handleProceedToCheckout}
                className="text-muted-foreground"
              >
                Skip for Now
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You can activate modules later. Most clients enable QuickBooks and/or Google Ads once they're live.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Checkout Pre-Screen */}
        {currentStep === "checkout" && !isPaid && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Review & Pay</h1>
              <p className="text-muted-foreground">
                You're about to pay for your LaunchBase setup and any selected activations.
                After payment, we'll begin deployment.
              </p>
            </div>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-500" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>LaunchBase Setup</span>
                  <span>$499</span>
                </div>
                {selectedModules.map(moduleId => {
                  const module = BUSINESS_MODULES.find(m => m.id === moduleId);
                  return module ? (
                    <div key={moduleId} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{module.name}</span>
                      <span>${module.setupFee}</span>
                    </div>
                  ) : null;
                })}
                <div className="border-t pt-3">
                  <div className="flex justify-between font-bold text-xl">
                    <span>Total Due Today</span>
                    <span>${calculateTotal()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trust Signals */}
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Secure checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Instant access</span>
              </div>
            </div>

            {/* Approval Checkbox - Required before payment */}
            <div className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="checkoutApproval"
                  checked={checkoutApprovalChecked}
                  onCheckedChange={(checked) => setCheckoutApprovalChecked(checked === true)}
                  className="mt-0.5 border-orange-500/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                />
                <Label htmlFor="checkoutApproval" className="text-sm cursor-pointer leading-relaxed">
                  I approve this preview and understand my site will be deployed after payment.
                  I agree to LaunchBase's{" "}
                  <Link href="/terms" className="text-orange-500 hover:underline">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/refunds" className="text-orange-500 hover:underline">Refund Policy</Link>.
                </Label>
              </div>
            </div>

            {/* Payment Button */}
            <div className="text-center space-y-4">
              <Button 
                onClick={handlePaySecurely}
                disabled={!checkoutApprovalChecked || checkoutMutation.isPending}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                size="lg"
              >
                {checkoutMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Approve & Pay
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Payments are processed by Stripe. We never see or store your card details.
              </p>

              <p className="text-sm text-orange-500 font-medium italic">
                You are not paying for a template. You're paying for a system that launches.
              </p>
            </div>

            {/* Back Button */}
            <Button 
              variant="ghost"
              onClick={() => setCurrentStep("activate")}
              className="w-full"
            >
              ← Back to Modules
            </Button>
          </div>
        )}

        {/* Already Paid State */}
        {isPaid && (
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Payment Confirmed ✅</h1>
              <p className="text-muted-foreground">
                You're officially queued for launch.
              </p>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">Status</span>
                  <span className="text-green-500 font-medium">Ready to Deploy</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Estimated time: We'll deploy within 24–48 hours
                </p>
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-center">
              <Button asChild className="bg-orange-500 hover:bg-orange-600">
                <Link href="/">Go to Dashboard</Link>
              </Button>
              <Button variant="outline">
                View Receipt
              </Button>
            </div>
          </div>
        )}

        {/* Footer Help */}
        <p className="text-xs text-muted-foreground text-center mt-8">
          Questions? Email support@launchbase.com
        </p>
      </main>
    </div>
  );
}

// Header Component
function Header() {
  return (
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
  );
}
