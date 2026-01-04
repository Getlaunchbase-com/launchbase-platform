/**
 * Facebook Connect Page
 * Handles page selection after OAuth callback
 * 
 * URL: /settings/facebook/connect?connectSessionId=...
 */

import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Facebook } from "lucide-react";

interface FacebookPage {
  pageId: string;
  pageName: string;
}

export default function FacebookConnect() {
  const [, setLocation] = useLocation();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  
  // Get connectSessionId from URL
  const params = new URLSearchParams(window.location.search);
  const connectSessionId = params.get("connectSessionId");
  const errorParam = params.get("error");

  // Get session status
  const sessionQuery = trpc.platform.getFacebookOAuthSession.useQuery(
    { connectSessionId: connectSessionId || "" },
    { enabled: !!connectSessionId && !errorParam }
  );

  // Get available pages
  const pagesQuery = trpc.platform.listFacebookPages.useQuery(
    { connectSessionId: connectSessionId || "" },
    { enabled: !!connectSessionId && !errorParam && sessionQuery.data?.status === "pages_ready" }
  );

  // Connect page mutation
  const connectMutation = trpc.platform.connectFacebookPage.useMutation({
    onSuccess: () => {
      // Redirect to settings page after successful connection
      setLocation("/settings/facebook");
    },
  });

  // Handle page selection
  const handleConnect = (pageId: string) => {
    if (!connectSessionId) return;
    setSelectedPageId(pageId);
    connectMutation.mutate({ connectSessionId, pageId });
  };

  // Error state
  if (errorParam) {
    return (
      <div className="container max-w-lg py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Connection Failed</CardTitle>
            </div>
            <CardDescription>
              There was a problem connecting your Facebook account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{decodeURIComponent(errorParam)}</AlertDescription>
            </Alert>
            <Button onClick={() => setLocation("/settings/facebook")} variant="outline" className="w-full">
              Back to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No session ID
  if (!connectSessionId) {
    return (
      <div className="container max-w-lg py-12">
        <Card>
          <CardHeader>
            <CardTitle>Invalid Session</CardTitle>
            <CardDescription>
              No connect session found. Please start the connection process again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/settings/facebook")} variant="outline" className="w-full">
              Back to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading session
  if (sessionQuery.isLoading) {
    return (
      <div className="container max-w-lg py-12">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Session error or invalid
  if (!sessionQuery.data?.valid || sessionQuery.data?.status === "failed") {
    return (
      <div className="container max-w-lg py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Session Invalid</CardTitle>
            </div>
            <CardDescription>
              {sessionQuery.data?.error || "Your session has expired or is invalid."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/settings/facebook")} variant="outline" className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already connected
  if (sessionQuery.data?.status === "connected") {
    return (
      <div className="container max-w-lg py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <CardTitle>Already Connected</CardTitle>
            </div>
            <CardDescription>
              Your Facebook page is already connected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/settings/facebook")} className="w-full">
              View Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading pages
  if (pagesQuery.isLoading) {
    return (
      <div className="container max-w-lg py-12">
        <Card>
          <CardHeader>
            <CardTitle>Loading Pages</CardTitle>
            <CardDescription>
              Fetching your Facebook pages...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // No pages found
  if (!pagesQuery.data?.pages?.length) {
    return (
      <div className="container max-w-lg py-12">
        <Card>
          <CardHeader>
            <CardTitle>No Pages Found</CardTitle>
            <CardDescription>
              We couldn't find any Facebook pages you manage. Make sure you have admin access to at least one page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Requirements</AlertTitle>
              <AlertDescription>
                You need to be an admin or editor of a Facebook Page to connect it.
              </AlertDescription>
            </Alert>
            <Button onClick={() => setLocation("/settings/facebook")} variant="outline" className="w-full">
              Back to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show page selection
  return (
    <div className="container max-w-lg py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Facebook className="h-6 w-6 text-blue-600" />
            <CardTitle>Select a Page</CardTitle>
          </div>
          <CardDescription>
            Choose which Facebook page you want to connect for posting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pagesQuery.data.pages.map((page: FacebookPage) => (
            <Button
              key={page.pageId}
              variant={selectedPageId === page.pageId ? "default" : "outline"}
              className="w-full justify-start h-auto py-3"
              onClick={() => handleConnect(page.pageId)}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending && selectedPageId === page.pageId ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Facebook className="h-4 w-4 mr-2" />
              )}
              <span className="truncate">{page.pageName}</span>
            </Button>
          ))}

          {connectMutation.isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Connection Failed</AlertTitle>
              <AlertDescription>
                {connectMutation.error?.message || "Failed to connect page. Please try again."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
