import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown,
  Users,
  Rocket,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Target
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminAnalytics() {
  const { data: funnel, isLoading: funnelLoading } = trpc.analytics.funnel.useQuery();
  const { data: buildQuality, isLoading: qualityLoading } = trpc.analytics.buildQuality.useQuery();
  const { data: verticals, isLoading: verticalsLoading } = trpc.analytics.verticals.useQuery();
  const { data: dailyHealth } = trpc.analytics.dailyHealth.useQuery();

  const isLoading = funnelLoading || qualityLoading || verticalsLoading;

  // Calculate step completion rates
  const stepCompletionRates = funnel?.stepMetrics 
    ? Object.entries(funnel.stepMetrics).map(([step, data]) => ({
        step: parseInt(step),
        rate: data.viewed > 0 ? Math.round((data.completed / data.viewed) * 100) : 0,
        viewed: data.viewed,
        completed: data.completed,
      }))
    : [];

  // Find problematic steps (< 80% completion)
  const problemSteps = stepCompletionRates.filter(s => s.rate < 80 && s.viewed > 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-400">
            Track funnel performance, drop-off rates, and build quality metrics.
          </p>
        </div>

        {/* Daily Health Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Intakes Today</p>
                  <p className="text-3xl font-bold">{dailyHealth?.intakesToday || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Sites Deployed</p>
                  <p className="text-3xl font-bold">{dailyHealth?.sitesDeployedToday || 0}</p>
                </div>
                <Rocket className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Avg Confidence</p>
                  <p className="text-3xl font-bold">{dailyHealth?.avgConfidenceScore || 0}%</p>
                </div>
                <Target className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Completion Rate</p>
                  <p className="text-3xl font-bold">{funnel?.funnel.completionRate || 0}%</p>
                </div>
                <BarChart3 className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Funnel View */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FF6A00]" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>
              Track visitors through each stage of the funnel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">Loading metrics...</div>
            ) : (
              <div className="space-y-4">
                {/* Funnel stages */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Home Visits</span>
                      <span className="font-semibold">{funnel?.funnel.homeViews || 0}</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: "100%" }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">CTA Clicks</span>
                      <span className="font-semibold">
                        {funnel?.funnel.ctaClicks || 0}
                        <span className="text-gray-400 text-xs ml-2">
                          ({funnel?.funnel.ctaClickRate || 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500" 
                        style={{ width: `${funnel?.funnel.ctaClickRate || 0}%` }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Onboarding Started</span>
                      <span className="font-semibold">{funnel?.funnel.onboardingStarted || 0}</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500" 
                        style={{ 
                          width: `${funnel?.funnel.homeViews 
                            ? Math.round((funnel.funnel.onboardingStarted / funnel.funnel.homeViews) * 100) 
                            : 0}%` 
                        }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Onboarding Completed</span>
                      <span className="font-semibold">
                        {funnel?.funnel.onboardingCompleted || 0}
                        <span className="text-gray-400 text-xs ml-2">
                          ({funnel?.funnel.completionRate || 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${funnel?.funnel.completionRate || 0}%` }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Sites Deployed</span>
                      <span className="font-semibold">{funnel?.funnel.sitesDeployed || 0}</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500" 
                        style={{ 
                          width: `${funnel?.funnel.onboardingCompleted 
                            ? Math.round((funnel.funnel.sitesDeployed / funnel.funnel.onboardingCompleted) * 100) 
                            : 0}%` 
                        }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Drop-Off Heatmap */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                Step Completion Rates
              </CardTitle>
              <CardDescription>
                Steps below 80% completion need attention.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stepCompletionRates.map(({ step, rate, viewed }) => (
                  <div key={step} className="flex items-center gap-3">
                    <span className="text-sm w-16">Step {step}</span>
                    <div className="flex-1 h-6 bg-white/10 rounded overflow-hidden">
                      <div 
                        className={`h-full ${rate >= 80 ? "bg-green-500" : "bg-orange-500"}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold w-12 text-right ${
                      rate >= 80 ? "text-green-400" : "text-orange-400"
                    }`}>
                      {viewed > 0 ? `${rate}%` : "—"}
                    </span>
                    {rate < 80 && viewed > 0 && (
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                    )}
                  </div>
                ))}
              </div>

              {problemSteps.length > 0 && (
                <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <p className="text-sm text-orange-400">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    {problemSteps.length} step(s) below 80% completion. Consider reviewing copy or reducing friction.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Build Quality */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Build Quality Signals
              </CardTitle>
              <CardDescription>
                Track first-pass approvals and clarification rates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-sm text-gray-400">Build Plans Generated</span>
                  <span className="font-semibold">{buildQuality?.buildPlansGenerated || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-sm text-gray-400">First-Pass Approval Rate</span>
                  <Badge className={`${
                    (buildQuality?.firstPassApprovalRate || 0) >= 60 
                      ? "bg-green-500/20 text-green-400" 
                      : "bg-orange-500/20 text-orange-400"
                  }`}>
                    {buildQuality?.firstPassApprovalRate || 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-sm text-gray-400">Clarification Rate</span>
                  <Badge className={`${
                    (buildQuality?.clarificationRate || 0) <= 20 
                      ? "bg-green-500/20 text-green-400" 
                      : "bg-orange-500/20 text-orange-400"
                  }`}>
                    {buildQuality?.clarificationRate || 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-sm text-gray-400">Revisions Requested</span>
                  <span className="font-semibold">{buildQuality?.revisionsRequested || 0}</span>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Target: First-pass approval &gt; 60%, Clarifications &lt; 20%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vertical Performance */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#FF6A00]" />
              Performance by Vertical
            </CardTitle>
            <CardDescription>
              Which template should we sell harder?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {verticals?.metrics && Object.entries(verticals.metrics).map(([vertical, data]) => (
                <Card key={vertical} className="bg-white/5 border-white/10">
                  <CardContent className="py-4">
                    <h3 className="font-semibold capitalize mb-3">{vertical}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Intakes</span>
                        <span>{data.intakesCompleted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Deployed</span>
                        <span>{data.sitesDeployed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Conversion</span>
                        <Badge className={`${
                          data.conversionRate >= 50 
                            ? "bg-green-500/20 text-green-400" 
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {data.conversionRate}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
