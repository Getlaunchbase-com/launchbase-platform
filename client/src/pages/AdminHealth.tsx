/**
 * Admin Health Dashboard
 * 
 * Minimal dashboard showing last 24h system health metrics
 * - Deployments (queued/running/success/failed)
 * - Emails (sent/failed, current sender)
 * - Stripe webhooks (success/failed)
 * - System uptime
 * 
 * Auto-refreshes every 30 seconds
 */

import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTimestamp(date: Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminHealth() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const tenantParam = (urlParams.get("tenant") || "all") as "all" | "launchbase" | "vinces";
  
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data: metrics, isLoading, refetch } = trpc.admin.health.useQuery(
    { tenant: tenantParam },
    { refetchInterval: autoRefresh ? 30000 : false }
  );
  
  const handleTenantChange = (newTenant: string) => {
    if (newTenant === "all") {
      setLocation("/admin/health");
    } else {
      setLocation(`/admin/health?tenant=${newTenant}`);
    }
  };



  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Health Metrics Unavailable</CardTitle>
            <CardDescription>Unable to load system health metrics</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const hasDeploymentErrors = metrics.deployments.failed > 0;
  const hasEmailErrors = metrics.emails.failed > 0;
  const hasStripeErrors = metrics.stripeWebhooks.failed > 0;

  // Critical alerts (RED)
  const criticalAlerts: string[] = [];
  if (hasEmailErrors) criticalAlerts.push(`${metrics.emails.failed} email failures in last 24h`);
  if (hasDeploymentErrors) criticalAlerts.push(`${metrics.deployments.failed} deployment failures in last 24h`);
  if (metrics.stripeWebhooks.isStale && metrics.stripeWebhooks.total > 0) {
    criticalAlerts.push("Stripe webhooks stale (no events in 6+ hours)");
  }

  // Warning alerts (YELLOW)
  const warningAlerts: string[] = [];
  if (metrics.stripeWebhooks.retryEvents > 0) {
    warningAlerts.push(`${metrics.stripeWebhooks.retryEvents} webhook retry events (${metrics.stripeWebhooks.totalRetries} total retries)`);
  }
  if (metrics.deployments.lastDeploymentAt) {
    const hoursSinceLastDeploy = (Date.now() - new Date(metrics.deployments.lastDeploymentAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastDeploy > 24) {
      warningAlerts.push(`No deployments in ${Math.floor(hoursSinceLastDeploy)}+ hours`);
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Critical Alerts Banner (RED) */}
      {criticalAlerts.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Attention Needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {criticalAlerts.map((alert, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-destructive font-bold">•</span>
                  <span className="text-sm font-medium">{alert}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Warning Alerts Banner (YELLOW) */}
      {warningAlerts.length > 0 && criticalAlerts.length === 0 && (
        <Card className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
              <AlertCircle className="h-5 w-5" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {warningAlerts.map((alert, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-yellow-700 dark:text-yellow-500 font-bold">•</span>
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">{alert}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground">
            Last 24 hours • Tenant: <span className="font-medium">{metrics.tenant === "all" ? "All" : metrics.tenant === "launchbase" ? "LaunchBase" : "Vince's Snowplow"}</span> • Auto-refresh: {autoRefresh ? "On" : "Off"}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={tenantParam} onValueChange={handleTenantChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              <SelectItem value="launchbase">LaunchBase</SelectItem>
              <SelectItem value="vinces">Vince's Snowplow</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Clock className="h-4 w-4 mr-2" />
            {autoRefresh ? "Disable" : "Enable"} Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Deployments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {hasDeploymentErrors ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            Deployments
          </CardTitle>
          <CardDescription>
            Last deployment: {formatTimestamp(metrics.deployments.lastDeploymentAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-2xl font-bold">{metrics.deployments.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{metrics.deployments.queued}</div>
              <div className="text-sm text-muted-foreground">Queued</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{metrics.deployments.running}</div>
              <div className="text-sm text-muted-foreground">Running</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{metrics.deployments.success}</div>
              <div className="text-sm text-muted-foreground">Success</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">{metrics.deployments.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>
          {metrics.deployments.lastError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="text-sm font-medium text-destructive mb-1">Last Error:</div>
              <div className="text-sm text-muted-foreground font-mono">{metrics.deployments.lastError}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {hasEmailErrors ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            Emails
          </CardTitle>
          <CardDescription>
            Sending from: <span className="font-mono text-foreground">{metrics.emails.currentSender}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold">{metrics.emails.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{metrics.emails.sent}</div>
              <div className="text-sm text-muted-foreground">Sent</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">{metrics.emails.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>
          {metrics.emails.lastError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="text-sm font-medium text-destructive mb-1">Last Error:</div>
              <div className="text-sm text-muted-foreground font-mono">{metrics.emails.lastError}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stripe Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {hasStripeErrors || metrics.stripeWebhooks.isStale ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            Stripe Webhooks
          </CardTitle>
          <CardDescription>
            Last webhook: {formatTimestamp(metrics.stripeWebhooks.lastEventAt)}
            {metrics.stripeWebhooks.isStale && (
              <span className="ml-2 text-destructive font-medium">⚠ Stale (no events in 6+ hours)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <div className="text-2xl font-bold">{metrics.stripeWebhooks.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{metrics.stripeWebhooks.ok}</div>
              <div className="text-sm text-muted-foreground">OK</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">{metrics.stripeWebhooks.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{metrics.stripeWebhooks.pending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{metrics.stripeWebhooks.retryEvents}</div>
              <div className="text-sm text-muted-foreground">Retries</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.stripeWebhooks.totalRetries}</div>
              <div className="text-sm text-muted-foreground">Total Retries</div>
            </div>
          </div>
          {metrics.stripeWebhooks.lastError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="text-sm font-medium text-destructive mb-1">Last Error:</div>
              <div className="text-sm text-muted-foreground font-mono">{metrics.stripeWebhooks.lastError}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Uptime */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            System
          </CardTitle>
          <CardDescription>
            Environment: {metrics.system.environment}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold">{formatUptime(metrics.system.uptime)}</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
            <div>
              <div className="text-sm font-mono">{new Date(metrics.system.startTime).toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Started At</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
