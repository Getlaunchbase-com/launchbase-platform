/**
 * Facebook Settings Page
 * Displays connection status and allows reconnection
 * 
 * URL: /settings/facebook
 */

import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Facebook,
  RefreshCw,
  ExternalLink,
  Clock,
  Shield,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Token Expired
        </Badge>
      );
    case "disconnected":
      return (
        <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
          <XCircle className="h-3 w-3 mr-1" />
          Not Connected
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {status}
        </Badge>
      );
  }
}

export default function SettingsFacebook() {
  const [, setLocation] = useLocation();

  // Get Facebook status
  const statusQuery = trpc.platform.getFacebookStatus.useQuery();

  // Verify connection mutation
  const verifyMutation = trpc.platform.verifyFacebookConnection.useMutation({
    onSuccess: () => {
      statusQuery.refetch();
    },
  });

  const handleConnect = () => {
    // Redirect to Facebook OAuth start
    window.location.href = "/api/facebook/oauth/start";
  };

  const handleVerify = () => {
    verifyMutation.mutate();
  };

  const isConnected = statusQuery.data?.connected;
  const needsReconnect = statusQuery.data?.status === "expired" || !statusQuery.data?.tokenValid;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Facebook className="h-6 w-6 text-blue-600" />
            Facebook Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your Facebook Page connection for automated posting
          </p>
        </div>

        {/* Loading State */}
        {statusQuery.isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {statusQuery.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load Facebook status. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Status Card */}
        {!statusQuery.isLoading && statusQuery.data && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Connection Status</CardTitle>
                <StatusBadge status={statusQuery.data.status} />
              </div>
              <CardDescription>
                {isConnected
                  ? "Your Facebook Page is connected and ready for posting"
                  : "Connect your Facebook Page to enable automated posting"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isConnected && statusQuery.data.pageName && (
                <>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Page Name</span>
                      <span className="font-medium">{statusQuery.data.pageName}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Page ID</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {statusQuery.data.pageId}
                      </code>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Token Valid</span>
                      {statusQuery.data.tokenValid ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Valid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500">
                          <XCircle className="h-3 w-3 mr-1" />
                          Invalid
                        </Badge>
                      )}
                    </div>
                    {statusQuery.data.lastVerifiedAt && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Last Verified</span>
                          <span className="text-sm flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(statusQuery.data.lastVerifiedAt).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleVerify}
                      disabled={verifyMutation.isPending}
                      className="flex-1"
                    >
                      {verifyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Verify Connection
                    </Button>
                    {needsReconnect && (
                      <Button onClick={handleConnect} className="flex-1">
                        <Facebook className="h-4 w-4 mr-2" />
                        Reconnect
                      </Button>
                    )}
                  </div>

                  {verifyMutation.isSuccess && (
                    <Alert className="bg-green-500/10 border-green-500/20">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertTitle className="text-green-500">Verified</AlertTitle>
                      <AlertDescription>
                        {verifyMutation.data?.valid
                          ? "Connection is valid and working"
                          : `Connection issue: ${verifyMutation.data?.error}`}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {!isConnected && (
                <div className="space-y-4">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertTitle>Secure Connection</AlertTitle>
                    <AlertDescription>
                      We only request the minimum permissions needed to post to your Page.
                      Your login credentials are never stored.
                    </AlertDescription>
                  </Alert>

                  <Button onClick={handleConnect} className="w-full" size="lg">
                    <Facebook className="h-5 w-5 mr-2" />
                    Connect Facebook Page
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 text-xs font-bold">
                1
              </div>
              <p>Connect your Facebook Page using secure OAuth</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 text-xs font-bold">
                2
              </div>
              <p>LaunchBase creates drafts based on weather and local events</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 text-xs font-bold">
                3
              </div>
              <p>You review and approve drafts before they're published</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 text-xs font-bold">
                4
              </div>
              <p>Posts are published with safety checks (business hours, daily limits)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
