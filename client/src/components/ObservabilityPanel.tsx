import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  XCircle,
  Zap,
  Eye,
  VolumeX,
  Rocket,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const { data, isLoading } = trpc.admin.observability.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  }) as { data: ObservabilityData | undefined; isLoading: boolean };

  if (isLoading) {
    return <ObservabilityPanelSkeleton />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* System Status Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              System Status
            </CardTitle>
            <StatusBadge status={data.systemStatus.status} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {data.systemStatus.message}
          </p>
        </CardContent>
      </Card>

      {/* Activity Metrics */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Activity This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              icon={<Clock className="h-4 w-4" />}
              label="Last intelligence decision"
              value={data.activityMetrics.lastIntelligenceDecisionFormatted}
            />
            <MetricCard
              icon={<Rocket className="h-4 w-4" />}
              label="Last deployment"
              value={data.activityMetrics.lastDeploymentRunFormatted}
            />
            <MetricCard
              icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
              label="Posts approved"
              value={String(data.activityMetrics.postsApprovedThisWeek)}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      icon={<VolumeX className="h-4 w-4 text-amber-500" />}
                      label="Silence decisions"
                      value={String(data.activityMetrics.silenceDecisionsThisWeek)}
                      hasTooltip
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm">
                    Silence means LaunchBase intentionally chose not to post to protect relevance or safety. This is a feature, not a bug.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Intelligence Info */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {data.intelligenceInfo.industryProfile && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Industry profile</span>
                <span className="font-medium capitalize">
                  {data.intelligenceInfo.industryProfile} {data.intelligenceInfo.profileVersion && `(${data.intelligenceInfo.profileVersion})`}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Intelligence version</span>
              <span className="font-medium">{data.intelligenceInfo.intelligenceVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode</span>
              <Badge variant="outline" className="capitalize">
                {data.intelligenceInfo.mode}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Decisions */}
      {data.recentDecisions.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
              Recent Decisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentDecisions.map((decision) => (
                <DecisionRow key={decision.id} decision={decision} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "operational" | "degraded" | "down" }) {
  if (status === "operational") {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
        <span className="mr-1.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        Operational
      </Badge>
    );
  }
  if (status === "degraded") {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
        <AlertTriangle className="mr-1.5 h-3 w-3" />
        Degraded
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
      <XCircle className="mr-1.5 h-3 w-3" />
      Down
    </Badge>
  );
}

function MetricCard({ 
  icon, 
  label, 
  value,
  hasTooltip 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  hasTooltip?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
        {hasTooltip && <Info className="h-3 w-3 text-muted-foreground/50" />}
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function DecisionRow({ decision }: { 
  decision: ObservabilityData["recentDecisions"][number]
}) {
  const getOutcomeIcon = () => {
    switch (decision.outcome) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "skipped":
        return <VolumeX className="h-4 w-4 text-amber-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-0.5">{getOutcomeIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-foreground">{decision.summary}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTimestamp(decision.timestamp)}
        </p>
      </div>
    </div>
  );
}

function ObservabilityPanelSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ObservabilityPanel;
