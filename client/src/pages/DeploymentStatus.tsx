import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Rocket, 
  CheckCircle, 
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  RefreshCw,
  Copy
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string; message: string }> = {
  queued: { 
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30", 
    icon: <Clock className="w-5 h-5" />,
    label: "Queued",
    message: "Your deployment is in the queue and will start shortly."
  },
  running: { 
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", 
    icon: <Loader2 className="w-5 h-5 animate-spin" />,
    label: "Provisioning Link",
    message: "Deployment is running now. We're provisioning your live link and verifying it's reachable. This can take a few minutes. You can leave this page—we'll keep working."
  },
  success: { 
    color: "bg-green-500/20 text-green-400 border-green-500/30", 
    icon: <CheckCircle className="w-5 h-5" />,
    label: "Live ✅",
    message: "Your website is live and ready to go."
  },
  failed: { 
    color: "bg-red-500/20 text-red-400 border-red-500/30", 
    icon: <XCircle className="w-5 h-5" />,
    label: "Needs Attention",
    message: "Something went wrong. Our team has been notified."
  },
};

export default function DeploymentStatus() {
  const params = useParams<{ id: string }>();
  const deploymentId = parseInt(params.id || "0");

  const { data: deployment, isLoading, refetch } = trpc.admin.deploy.status.useQuery(
    { id: deploymentId },
    {
      refetchInterval: (query) => {
        // Poll every 2 seconds while queued or running
        const status = query.state.data?.status;
        if (status === "queued" || status === "running") {
          return 2000;
        }
        return false;
      },
    }
  );

  const runDeployMutation = trpc.admin.deploy.run.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Deployment completed!");
        refetch();
      } else {
        toast.error(result.error || "Deployment failed");
        refetch();
      }
    },
    onError: (error) => {
      toast.error(error.message);
      refetch();
    },
  });

  // Auto-run deployment when it's queued
  useEffect(() => {
    if (deployment?.status === "queued" && !runDeployMutation.isPending) {
      runDeployMutation.mutate({ id: deploymentId });
    }
  }, [deployment?.status, deploymentId]);

  const copyUrl = () => {
    if (deployment?.previewUrl) {
      navigator.clipboard.writeText(deployment.previewUrl);
      toast.success("URL copied to clipboard");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-gray-400">Loading deployment...</div>
      </DashboardLayout>
    );
  }

  if (!deployment) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-400">Deployment not found</p>
          <Link href="/admin">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const config = statusConfig[deployment.status] || statusConfig.queued;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Launching Your Website</h1>
              <p className="text-gray-400">Deployment #{deployment.id}</p>
            </div>
          </div>
          <Badge className={`${config.color} flex items-center gap-2 px-4 py-2`}>
            {config.icon}
            {config.label}
          </Badge>
        </div>

        {/* Status Card */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[#FF6A00]" />
              Deployment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Indicator */}
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-4">
                {[
                  { key: "queued", label: "Queued" },
                  { key: "running", label: "Provisioning" },
                  { key: "success", label: "Live ✅" }
                ].map((step, index) => {
                  const isActive = deployment.status === step.key;
                  const isPast = 
                    (step.key === "queued" && ["running", "success"].includes(deployment.status)) ||
                    (step.key === "running" && deployment.status === "success");
                  
                  return (
                    <div key={step.key} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`
                          w-12 h-12 rounded-full flex items-center justify-center
                          ${isActive ? "bg-[#FF6A00] text-white" : ""}
                          ${isPast ? "bg-[#1ED760] text-white" : ""}
                          ${!isActive && !isPast ? "bg-white/10 text-gray-500" : ""}
                          ${deployment.status === "failed" && step.key === "success" ? "bg-red-500/20 text-red-400" : ""}
                        `}>
                          {isPast ? (
                            <CheckCircle className="w-6 h-6" />
                          ) : isActive && deployment.status === "running" ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : deployment.status === "failed" && step.key === "success" ? (
                            <XCircle className="w-6 h-6" />
                          ) : (
                            <span className="text-lg font-bold">{index + 1}</span>
                          )}
                        </div>
                        <span className="text-xs mt-2 text-gray-400">{step.label}</span>
                      </div>
                      {index < 2 && (
                        <div className={`w-16 h-1 mb-6 ${isPast ? "bg-[#1ED760]" : "bg-white/10"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Message */}
            <p className="text-center text-muted-foreground">{config.message}</p>

            {/* Success State */}
            {deployment.status === "success" && deployment.previewUrl && (
              <div className="bg-[#1ED760]/10 border border-[#1ED760]/30 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-[#1ED760] mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Your website is live.</h3>
                <p className="text-gray-400 mb-4">Here's your link:</p>
                <div className="flex items-center justify-center gap-3">
                  <a 
                    href={deployment.previewUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button className="bg-[#1ED760] hover:bg-[#1ED760]/90">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Live Site
                    </Button>
                  </a>
                  <Button variant="outline" onClick={copyUrl}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy URL
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-mono">{deployment.previewUrl}</p>
              </div>
            )}

            {/* Failed State */}
            {deployment.status === "failed" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Deployment Not Completed</h3>
                <p className="text-gray-400 mb-4">
                  No worries—our team has been notified and will resolve this shortly.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => runDeployMutation.mutate({ id: deploymentId })}
                    disabled={runDeployMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                  <Button variant="ghost" asChild>
                    <a href="mailto:support@launchbase.com">Contact Support</a>
                  </Button>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="grid grid-cols-3 gap-4 text-center border-t pt-6">
              <div>
                <p className="text-sm text-gray-400">Created</p>
                <p className="font-mono text-sm">{new Date(deployment.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Started</p>
                <p className="font-mono text-sm">
                  {deployment.startedAt ? new Date(deployment.startedAt).toLocaleString() : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Completed</p>
                <p className="font-mono text-sm">
                  {deployment.completedAt ? new Date(deployment.completedAt).toLocaleString() : "-"}
                </p>
              </div>
            </div>

            {/* Logs (collapsed by default for cleaner UI) */}
            {deployment.logs && deployment.logs.length > 0 && (
              <details className="group">
                <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                  View Deployment Logs
                </summary>
                <div className="bg-black/50 rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto mt-2">
                  {deployment.logs.map((log, index) => (
                    <div key={index} className="text-gray-300">{log}</div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
