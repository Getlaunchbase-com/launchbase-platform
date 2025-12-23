import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  XCircle,
  Eye,
  VolumeX,
  Shield,
  RefreshCw,
  CloudRain,
  Calendar,
  Gauge,
  Timer
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

// Type for observability data
interface ObservabilityData {
  systemStatus: {
    status: "operational" | "degraded" | "down";
    message: string;
    lastChecked: string;
  };
  activityMetrics: {
    lastIntelligenceDecision: string | null;
    lastDeploymentRun: string | null;
    postsApprovedThisWeek: number;
    silenceDecisionsThisWeek: number;
    lastIntelligenceDecisionFormatted: string;
    lastDeploymentRunFormatted: string;
  };
  recentDecisions: Array<{
    id: number;
    type: string;
    summary: string;
    timestamp: string;
    outcome: string;
  }>;
  intelligenceInfo: {
    industryProfile: string | null;
    profileVersion: string | null;
    intelligenceVersion: string;
    mode: string;
  };
}

export function ObservabilityPanel() {
  // @ts-ignore - tRPC type inference issue with nested routers
  const { data, isLoading, refetch } = trpc.admin.observability.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  }) as { data: ObservabilityData | undefined; isLoading: boolean; refetch: () => void };

  // Next check countdown (simulated - updates every minute)
  const [nextCheckMinutes, setNextCheckMinutes] = useState(47);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setNextCheckMinutes(prev => {
        if (prev <= 1) return 60; // Reset to ~1 hour
        return prev - 1;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <ObservabilityPanelSkeleton />;
  }

  // Show default state if no data yet
  const defaultData: ObservabilityData = data || {
    systemStatus: { status: 'operational', message: 'System initializing', lastChecked: new Date().toISOString() },
    activityMetrics: {
      lastIntelligenceDecision: null,
      lastIntelligenceDecisionFormatted: 'Warming up',
      lastDeploymentRun: null,
      lastDeploymentRunFormatted: 'Not yet',
      postsApprovedThisWeek: 0,
      silenceDecisionsThisWeek: 0
    },
    recentDecisions: [],
    intelligenceInfo: {
      industryProfile: null,
      profileVersion: null,
      intelligenceVersion: 'v2.4.0',
      mode: 'auto'
    }
  };
  
  // Get the most recent silence decision for display
  const lastSilenceDecision = defaultData.recentDecisions.find(d => d.outcome === "skipped");
  const lastDecision = defaultData.recentDecisions[0];

  // Format profile name nicely
  const formatProfileName = (profile: string | null, version: string | null) => {
    if (!profile) return "General Business";
    const formatted = profile.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return version ? `${formatted} ${version}` : formatted;
  };

  // Get cadence display
  const getCadenceDisplay = () => {
    // This would come from customer config in real implementation
    return "Medium (2–3 posts/week)";
  };

  return (
    <Card className="border-border/50 bg-gradient-to-br from-background to-muted/20">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#FF6A00]/10 border border-[#FF6A00]/20">
                <Eye className="w-5 h-5 text-[#FF6A00]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">What LaunchBase Is Doing Right Now</h2>
                <p className="text-sm text-muted-foreground">Live system status for your business. Updated automatically.</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* System Status Bar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
            <div className="flex items-center gap-2">
              <StatusIndicator status={defaultData.systemStatus.status} />
              <span className="text-sm font-medium">System Status: {defaultData.systemStatus.status === "operational" ? "Operational" : defaultData.systemStatus.status}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Last checked: {formatTimeAgo(defaultData.systemStatus.lastChecked)}
            </span>
          </div>

          {/* Active Responsibilities */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Right now, LaunchBase is:</p>
            <div className="space-y-2.5 pl-1">
              <ResponsibilityItem 
                icon={<CloudRain className="w-4 h-4" />}
                text="Monitoring weather for your service area"
              />
              <ResponsibilityItem 
                icon={<Shield className="w-4 h-4" />}
                text="Evaluating whether posting is safe"
              />
              <ResponsibilityItem 
                icon={<Activity className="w-4 h-4" />}
                text={`Applying ${formatProfileName(defaultData.intelligenceInfo.industryProfile, defaultData.intelligenceInfo.profileVersion)}`}
              />
              <ResponsibilityItem 
                icon={<Gauge className="w-4 h-4" />}
                text={`Respecting your cadence: ${getCadenceDisplay()}`}
              />
            </div>
          </div>

          {/* Last Decision Block */}
          {lastDecision && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last decision:</span>
                <DecisionBadge outcome={lastDecision.outcome} />
              </div>
              <p className="text-sm text-foreground">{lastDecision.summary}</p>
              <p className="text-xs text-muted-foreground">
                {formatTimeAgo(lastDecision.timestamp)}
              </p>
              {lastDecision.outcome === "skipped" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-muted-foreground/80 italic cursor-help inline-flex items-center gap-1">
                        <VolumeX className="w-3 h-3" />
                        Silence is a valid decision. We log it to protect your brand.
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm">
                        When conditions aren't right for posting, LaunchBase stays silent. This protects your reputation and ensures every post adds value.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}

          {/* Next Check */}
          <div className="flex items-center gap-2 text-sm">
            <Timer className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Next scheduled check:</span>
            <span className="font-medium text-foreground">~{nextCheckMinutes} minutes</span>
          </div>

          {/* Activity Summary (Compact) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs">Posts this week</span>
              </div>
              <p className="text-xl font-semibold">{defaultData.activityMetrics.postsApprovedThisWeek}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <VolumeX className="h-4 w-4 text-amber-500" />
                <span className="text-xs">Silence decisions</span>
              </div>
              <p className="text-xl font-semibold">{defaultData.activityMetrics.silenceDecisionsThisWeek}</p>
            </div>
          </div>

          {/* Guardrail Footer */}
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-[#FF6A00] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">You can change relevance anytime.</p>
                <p className="text-sm text-muted-foreground">Safety rules are always enforced.</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusIndicator({ status }: { status: "operational" | "degraded" | "down" }) {
  if (status === "operational") {
    return <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />;
  }
  if (status === "degraded") {
    return <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />;
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-red-500" />;
}

function ResponsibilityItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-[#FF6A00]">{icon}</div>
      <span className="text-foreground">{text}</span>
    </div>
  );
}

function DecisionBadge({ outcome }: { outcome: string }) {
  switch (outcome) {
    case "success":
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Posted
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <VolumeX className="mr-1 h-3 w-3" />
          Silence
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          <Activity className="mr-1 h-3 w-3" />
          {outcome}
        </Badge>
      );
  }
}

function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return "Never";
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return date.toLocaleDateString();
}

function ObservabilityPanelSkeleton() {
  return (
    <Card className="border-border/50 bg-gradient-to-br from-background to-muted/20">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-64 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
          
          {/* Status bar skeleton */}
          <div className="h-12 bg-muted animate-pulse rounded-lg" />
          
          {/* Responsibilities skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-40 bg-muted animate-pulse rounded" />
            <div className="space-y-2 pl-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-5 w-64 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </div>
          
          {/* Decision block skeleton */}
          <div className="h-24 bg-muted animate-pulse rounded-lg" />
          
          {/* Activity summary skeleton */}
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ObservabilityPanel;
