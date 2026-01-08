import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2, TrendingUp, Users, MousePointerClick, CheckCircle, ExternalLink } from "lucide-react";

export default function ReferralAnalytics() {
  const [timeWindow, setTimeWindow] = useState<7 | 30 | 90>(7);
  const [sortBy, setSortBy] = useState<"clicks" | "conversions">("conversions");

  // Fetch funnel data
  const { data: funnel, isLoading: funnelLoading } = trpc.referralAnalytics.funnel.useQuery(
    { timeWindowDays: timeWindow },
    { enabled: true }
  );

  // Fetch top sites
  const { data: topSites, isLoading: sitesLoading } = trpc.referralAnalytics.topSites.useQuery(
    { limit: 20, timeWindowDays: timeWindow, sortBy },
    { enabled: true }
  );

  const isLoading = funnelLoading || sitesLoading;

  // KPI cards
  const kpis = funnel
    ? [
        {
          title: "Badge Clicks",
          value: funnel.clicks.toLocaleString(),
          icon: MousePointerClick,
          color: "bg-blue-500/10",
          textColor: "text-blue-500",
        },
        {
          title: "Landing Views",
          value: funnel.lands.toLocaleString(),
          icon: Users,
          color: "bg-green-500/10",
          textColor: "text-green-500",
        },
        {
          title: "Apply Starts",
          value: funnel.applyStarts.toLocaleString(),
          icon: TrendingUp,
          color: "bg-purple-500/10",
          textColor: "text-purple-500",
        },
        {
          title: "Conversions",
          value: funnel.applySubmits.toLocaleString(),
          icon: CheckCircle,
          color: "bg-emerald-500/10",
          textColor: "text-emerald-500",
        },
      ]
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Referral Analytics</h1>
            <p className="text-muted-foreground mt-1">Track badge performance and conversion funnel</p>
          </div>
          <div className="flex gap-2">
            {([7, 30, 90] as const).map((days) => (
              <Button
                key={days}
                variant={timeWindow === days ? "default" : "outline"}
                onClick={() => setTimeWindow(days)}
                size="sm"
              >
                {days}d
              </Button>
            ))}
          </div>
        </div>

        {/* KPI Strip */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.title} className={kpi.color}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                        <p className={`text-2xl font-bold mt-2 ${kpi.textColor}`}>{kpi.value}</p>
                      </div>
                      <Icon className={`h-8 w-8 ${kpi.textColor} opacity-30`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Conversion Rates */}
        {funnel && (
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
              <CardDescription>Click → Landing → Apply Start → Submit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Click → Land</p>
                  <p className="text-xl font-bold text-blue-500 mt-1">{funnel.clickToLandRate}%</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Land → Apply</p>
                  <p className="text-xl font-bold text-green-500 mt-1">{funnel.landToApplyStartRate}%</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Apply → Submit</p>
                  <p className="text-xl font-bold text-purple-500 mt-1">{funnel.applyStartToSubmitRate}%</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Overall</p>
                  <p className="text-xl font-bold text-emerald-500 mt-1">
                    {funnel.clicks > 0 ? ((funnel.applySubmits / funnel.clicks) * 100).toFixed(1) : "0"}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Referring Sites */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Referring Sites</CardTitle>
                <CardDescription>Sites driving the most conversions</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={sortBy === "clicks" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("clicks")}
                >
                  By Clicks
                </Button>
                <Button
                  variant={sortBy === "conversions" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("conversions")}
                >
                  By Conversions
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topSites && topSites.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left">
                      <th className="pb-3 font-semibold">Site</th>
                      <th className="pb-3 font-semibold text-right">Clicks</th>
                      <th className="pb-3 font-semibold text-right">Lands</th>
                      <th className="pb-3 font-semibold text-right">Apply Starts</th>
                      <th className="pb-3 font-semibold text-right">Submits</th>
                      <th className="pb-3 font-semibold text-right">Conv %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topSites.map((site: any, idx: number) => (
                      <tr key={site.siteId} className="hover:bg-muted/50">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground font-medium w-6">{idx + 1}.</span>
                            <span className="font-medium">{site.siteSlug}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-medium">{site.clicks}</td>
                        <td className="py-3 text-right text-muted-foreground">{site.lands}</td>
                        <td className="py-3 text-right text-muted-foreground">{site.applyStarts}</td>
                        <td className="py-3 text-right font-medium text-emerald-500">{site.applySubmits}</td>
                        <td className="py-3 text-right">
                          <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 font-semibold text-xs">
                            {site.clicks > 0 ? ((site.applySubmits / site.clicks) * 100).toFixed(0) : "0"}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <MousePointerClick className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No referral data yet</p>
                <p className="text-sm mt-1">Sites will appear here once they start getting badge clicks.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
