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
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data: metrics, isLoading, refetch } = trpc.admin.health.useQuery();

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

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

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground">Last 24 hours • Auto-refresh: {autoRefresh ? "On" : "Off"}</p>
        </div>
        <div className="flex gap-2">
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
            {hasStripeErrors ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            Stripe Webhooks
          </CardTitle>
          <CardDescription>
            Last webhook: {formatTimestamp(metrics.stripeWebhooks.lastWebhookAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold">{metrics.stripeWebhooks.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{metrics.stripeWebhooks.success}</div>
              <div className="text-sm text-muted-foreground">Success</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">{metrics.stripeWebhooks.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
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
