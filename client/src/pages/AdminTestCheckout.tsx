import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CreditCard, Loader2, Rocket, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Scenario = "canonical" | "website_only" | "founder";

export default function AdminTestCheckout() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const createTestCheckoutMutation = trpc.admin.createTestCheckout.useMutation({
    onSuccess: (data) => {
      setDebugInfo(data);
      // Redirect to Stripe checkout after showing debug info for 2 seconds
      setTimeout(() => {
        window.location.href = data.checkoutUrl;
      }, 2000);
    },
  });

  const handleScenarioClick = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setDebugInfo(null);
    createTestCheckoutMutation.mutate({ scenario });
  };

  const scenarios = [
    {
      id: "canonical" as Scenario,
      title: "Canonical Scenario",
      description: "Website + Social (8 posts) + Email (required) + Google Business",
      features: [
        "Required Email auto-included",
        "Tier pricing (MEDIUM = 8 posts)",
        "Bundle discount (50% off Social)",
      ],
      expectedSetup: "$747.50",
      expectedMonthly: "$216/mo",
      icon: Rocket,
      color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    {
      id: "website_only" as Scenario,
      title: "Website Only",
      description: "Baseline sanity check - Website + Email (required)",
      features: [
        "Minimum viable selection",
        "No bundle discount",
        "No optional services",
      ],
      expectedSetup: "$598.00",
      expectedMonthly: "$68/mo",
      icon: CreditCard,
      color: "bg-green-500/20 text-green-400 border-green-500/30",
    },
    {
      id: "founder" as Scenario,
      title: "Founder Override",
      description: "Multiple services with BETA-FOUNDERS promo code",
      features: [
        "All services selected",
        "Founder promo applied",
        "$300 flat setup override",
      ],
      expectedSetup: "$300.00",
      expectedMonthly: "(normal calculation)",
      icon: Sparkles,
      color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Test Checkout</h1>
          <p className="text-gray-400">
            Verify Stripe integration and pricing snapshot flow with pre-baked scenarios
          </p>
        </div>

        {/* Warning Alert */}
        <Alert className="bg-yellow-500/10 border-yellow-500/30">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <AlertTitle className="text-yellow-400">Admin Test Tool</AlertTitle>
          <AlertDescription className="text-yellow-300">
            This page creates real intakes and Stripe checkout sessions. Use Stripe test mode only.
            Test card: <code className="bg-black/30 px-2 py-1 rounded">4242 4242 4242 4242</code>
          </AlertDescription>
        </Alert>

        {/* Scenario Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            const isLoading = createTestCheckoutMutation.isPending && selectedScenario === scenario.id;
            const isSuccess = debugInfo && selectedScenario === scenario.id;

            return (
              <Card key={scenario.id} className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-[#FF6A00]" />
                    {scenario.title}
                  </CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Features */}
                  <div className="space-y-2">
                    {scenario.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Expected Totals */}
                  <div className="pt-4 border-t border-white/10 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Expected Setup:</span>
                      <span className="text-white font-semibold">{scenario.expectedSetup}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Expected Monthly:</span>
                      <span className="text-white font-semibold">{scenario.expectedMonthly}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => handleScenarioClick(scenario.id)}
                    disabled={createTestCheckoutMutation.isPending}
                    className="w-full bg-[#FF6A00] hover:bg-[#FF6A00]/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : isSuccess ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Redirecting...
                      </>
                    ) : (
                      "Run Test"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Debug Panel */}
        {debugInfo && (
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#FF6A00]" />
                Debug Info
              </CardTitle>
              <CardDescription>
                Pricing breakdown before redirect (redirecting in 2 seconds...)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-400">Intake ID:</span>
                  <p className="text-white font-mono">{debugInfo.intakeId}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Tenant:</span>
                  <p className="text-white font-mono">{debugInfo.snapshot.tenant}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Pricing Version:</span>
                  <p className="text-white font-mono">{debugInfo.snapshot.pricingVersion}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Timestamp:</span>
                  <p className="text-white font-mono text-xs">
                    {new Date(debugInfo.snapshot.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Setup Line Items */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Setup Line Items</h4>
                <div className="space-y-1">
                  {debugInfo.snapshot.setupLineItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="text-white">${(item.amountCents / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discounts */}
              {debugInfo.snapshot.setupDiscountCents > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Discounts</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">Bundle Discount</span>
                    <span className="text-green-400">
                      -${(debugInfo.snapshot.setupDiscountCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Founder Override */}
              {debugInfo.snapshot.isFounder && (
                <div>
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    🎉 Beta Founder Override: $300 flat
                  </Badge>
                </div>
              )}

              {/* Totals */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-gray-200">Setup Total:</span>
                  <span className="text-[#FF6A00]">
                    ${(debugInfo.snapshot.setupTotalCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-gray-200">Monthly Total:</span>
                  <span className="text-[#FF6A00]">
                    ${(debugInfo.snapshot.monthlyTotalCents / 100).toFixed(2)}/mo
                  </span>
                </div>
              </div>

              {/* Checkout URL */}
              <div>
                <span className="text-sm text-gray-400">Checkout URL:</span>
                <p className="text-white font-mono text-xs break-all">{debugInfo.checkoutUrl}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {createTestCheckoutMutation.isError && (
          <Alert className="bg-red-500/10 border-red-500/30">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertTitle className="text-red-400">Error</AlertTitle>
            <AlertDescription className="text-red-300">
              {createTestCheckoutMutation.error.message}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  );
}
