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
  RefreshCw
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  queued: { 
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30", 
    icon: <Clock className="w-5 h-5" />,
    label: "Queued"
  },
  running: { 
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", 
    icon: <Loader2 className="w-5 h-5 animate-spin" />,
    label: "Running"
  },
  success: { 
    color: "bg-green-500/20 text-green-400 border-green-500/30", 
    icon: <CheckCircle className="w-5 h-5" />,
    label: "Success"
  },
  failed: { 
    color: "bg-red-500/20 text-red-400 border-red-500/30", 
    icon: <XCircle className="w-5 h-5" />,
    label: "Failed"
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
              <h1 className="text-2xl font-bold">Deployment #{deployment.id}</h1>
              <p className="text-gray-400">Build Plan #{deployment.buildPlanId}</p>
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
                {["queued", "running", "success"].map((step, index) => {
                  const isActive = deployment.status === step;
                  const isPast = 
                    (step === "queued" && ["running", "success"].includes(deployment.status)) ||
                    (step === "running" && deployment.status === "success");
                  const isFailed = deployment.status === "failed" && step !== "success";
                  
                  return (
                    <div key={step} className="flex items-center">
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center
                        ${isActive ? "bg-[#FF6A00] text-white" : ""}
                        ${isPast ? "bg-[#1ED760] text-white" : ""}
                        ${!isActive && !isPast ? "bg-white/10 text-gray-500" : ""}
                        ${deployment.status === "failed" && step === "success" ? "bg-red-500/20 text-red-400" : ""}
                      `}>
                        {isPast ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : isActive && deployment.status === "running" ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : deployment.status === "failed" && step === "success" ? (
                          <XCircle className="w-6 h-6" />
                        ) : (
                          <span className="text-lg font-bold">{index + 1}</span>
                        )}
                      </div>
                      {index < 2 && (
                        <div className={`w-16 h-1 ${isPast ? "bg-[#1ED760]" : "bg-white/10"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-400">Created</p>
                <p className="font-mono">{new Date(deployment.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Started</p>
                <p className="font-mono">
                  {deployment.startedAt ? new Date(deployment.startedAt).toLocaleString() : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Completed</p>
                <p className="font-mono">
                  {deployment.completedAt ? new Date(deployment.completedAt).toLocaleString() : "-"}
                </p>
              </div>
            </div>

            {/* Success State */}
            {deployment.status === "success" && deployment.previewUrl && (
              <div className="bg-[#1ED760]/10 border border-[#1ED760]/30 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-[#1ED760] mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Site Deployed Successfully!</h3>
                <p className="text-gray-400 mb-4">Your site is now live and ready to view.</p>
                <div className="flex items-center justify-center gap-4">
                  <a 
                    href={deployment.previewUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button className="bg-[#1ED760] hover:bg-[#1ED760]/90">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Site
                    </Button>
                  </a>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-mono">{deployment.previewUrl}</p>
              </div>
            )}

            {/* Failed State */}
            {deployment.status === "failed" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Deployment Failed</h3>
                <p className="text-gray-400 mb-4">
                  {deployment.errorMessage || "An error occurred during deployment."}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => runDeployMutation.mutate({ id: deploymentId })}
                  disabled={runDeployMutation.isPending}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Deployment
                </Button>
              </div>
            )}

            {/* Logs */}
            {deployment.logs && deployment.logs.length > 0 && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Deployment Logs</p>
                <div className="bg-black/50 rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto">
                  {deployment.logs.map((log, index) => (
                    <div key={index} className="text-gray-300">{log}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
