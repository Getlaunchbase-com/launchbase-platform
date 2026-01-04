/**
 * Connect Facebook Component
 * 3-state UI: Disconnected → Connected → Needs Reconnect
 * 
 * Slice A: Facebook Connection + Publish E2E
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";

// Facebook icon SVG
const FacebookIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

type ConnectionStatus = "disconnected" | "connected" | "expired" | "error" | "active" | "revoked";

export function ConnectFacebook() {
  const [isConnecting, setIsConnecting] = useState(false);

  // Get current connection status
  const { data: status, isLoading, refetch } = trpc.platform.getFacebookStatus.useQuery();

  // Verify connection mutation
  const verifyMutation = trpc.platform.verifyFacebookConnection.useMutation({
    onSuccess: (result) => {
      if (result.valid) {
        toast.success("Connection verified", {
          description: "Your Facebook page connection is active.",
        });
      } else {
        toast.error("Connection issue", {
          description: result.error || "Please reconnect your Facebook page.",
        });
      }
      refetch();
    },
    onError: (error) => {
      toast.error("Verification failed", {
        description: error.message,
      });
    },
  });

  // Start OAuth flow
  const handleConnect = () => {
    setIsConnecting(true);
    // Redirect to Facebook OAuth
    // This will be handled by the OAuth flow in the backend
    window.location.href = "/api/facebook/oauth/start";
  };

  // Disconnect (placeholder - would need backend endpoint)
  const handleDisconnect = () => {
    toast.info("Coming soon", {
      description: "Disconnect functionality will be available soon.",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const connectionStatus: ConnectionStatus = status?.status || "disconnected";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <FacebookIcon />
            </div>
            <div>
              <CardTitle className="text-lg">Facebook Page</CardTitle>
              <CardDescription>
                Connect your business page to publish posts
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={connectionStatus} />
        </div>
      </CardHeader>
      <CardContent>
        {connectionStatus === "disconnected" && (
          <DisconnectedState onConnect={handleConnect} isConnecting={isConnecting} />
        )}
        {connectionStatus === "connected" && status && (
          <ConnectedState
            pageName={status.pageName}
            lastVerified={status.lastVerifiedAt}
            onVerify={() => verifyMutation.mutate()}
            onDisconnect={handleDisconnect}
            isVerifying={verifyMutation.isPending}
          />
        )}
        {(connectionStatus === "expired" || connectionStatus === "error") && (
          <NeedsReconnectState
            error={connectionStatus === "error" ? "Connection error" : "Token expired"}
            onReconnect={handleConnect}
            isConnecting={isConnecting}
          />
        )}
      </CardContent>
    </Card>
  );
}

// Status badge component
function StatusBadge({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case "connected":
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    case "expired":
    case "error":
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <AlertCircle className="w-3 h-3 mr-1" />
          Needs Attention
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
          Not Connected
        </Badge>
      );
  }
}

// Disconnected state
function DisconnectedState({
  onConnect,
  isConnecting,
}: {
  onConnect: () => void;
  isConnecting: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect your Facebook Business Page to automatically publish weather updates and community posts.
      </p>
      <Button onClick={onConnect} disabled={isConnecting} className="w-full bg-blue-600 hover:bg-blue-700">
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <FacebookIcon />
            <span className="ml-2">Connect Facebook Page</span>
          </>
        )}
      </Button>
    </div>
  );
}

// Connected state
function ConnectedState({
  pageName,
  lastVerified,
  onVerify,
  onDisconnect,
  isVerifying,
}: {
  pageName: string | null;
  lastVerified: string | null;
  onVerify: () => void;
  onDisconnect: () => void;
  isVerifying: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted rounded-lg">
        <p className="font-medium">{pageName || "Connected Page"}</p>
        {lastVerified && (
          <p className="text-xs text-muted-foreground mt-1">
            Last verified: {new Date(lastVerified).toLocaleString()}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onVerify}
          disabled={isVerifying}
          className="flex-1"
        >
          {isVerifying ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Verify Connection
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDisconnect}
          className="text-destructive hover:text-destructive"
        >
          <Unplug className="w-4 h-4 mr-2" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}

// Needs reconnect state
function NeedsReconnectState({
  error,
  onReconnect,
  isConnecting,
}: {
  error: string;
  onReconnect: () => void;
  isConnecting: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <p className="text-sm text-yellow-600 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Your Facebook connection needs to be refreshed. Click below to reconnect.
        </p>
      </div>
      <Button onClick={onReconnect} disabled={isConnecting} className="w-full bg-blue-600 hover:bg-blue-700">
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Reconnecting...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reconnect Facebook Page
          </>
        )}
      </Button>
    </div>
  );
}

export default ConnectFacebook;
