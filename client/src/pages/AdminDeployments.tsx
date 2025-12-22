import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Rocket, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  queued: {
    label: "Queued",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: <Clock className="w-4 h-4" />,
  },
  running: {
    label: "Running",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
  },
  success: {
    label: "Success",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  failed: {
    label: "Failed",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: <XCircle className="w-4 h-4" />,
  },
};

export default function AdminDeployments() {
  const [isRunning, setIsRunning] = useState(false);

  const { data: workerStatus, isLoading, refetch } = trpc.admin.deploy.workerStatus.useQuery();
  
  const runNextMutation = trpc.admin.deploy.runNext.useMutation({
    onMutate: () => {
      setIsRunning(true);
    },
    onSuccess: (data) => {
      if (data.processed === 0) {
        toast.info("No queued deployments to process");
      } else {
        toast.success(`Deployment completed! Live URL: ${data.liveUrl}`);
      }
      refetch();
    },
    onError: (error) => {
      toast.error(`Deployment failed: ${error.message}`);
      refetch();
    },
    onSettled: () => {
      setIsRunning(false);
    },
  });

  const handleRunNext = () => {
    runNextMutation.mutate();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Deployment Worker</h1>
            <p className="text-gray-400">
              Monitor and manually trigger deployments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Worker Status Card */}
        <Card className="bg-gradient-to-r from-[#FF6A00]/10 to-transparent border-[#FF6A00]/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-sm text-gray-400">Queued</p>
                  <p className="text-3xl font-bold text-blue-400">
                    {workerStatus?.queuedCount || 0}
                  </p>
                </div>
                <div className="h-12 w-px bg-white/10" />
                <div>
                  <p className="text-sm text-gray-400">Running</p>
                  <p className="text-3xl font-bold text-yellow-400">
                    {workerStatus?.runningCount || 0}
                  </p>
                </div>
              </div>
              
              <Button 
                onClick={handleRunNext}
                disabled={isRunning || (workerStatus?.queuedCount || 0) === 0}
                className="bg-[#FF6A00] hover:bg-[#FF6A00]/90"
                size="lg"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Run Next Deployment
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-500">Manual Deployment Mode</p>
                <p className="text-sm text-gray-400 mt-1">
                  Deployments are currently triggered manually. Click "Run Next Deployment" to process the oldest queued job.
                  For automatic deployments, set up a cron job to ping <code className="bg-white/10 px-1 rounded">/api/worker/run-next-deploy</code> every 2 minutes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Deployments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : !workerStatus?.recentDeployments?.length ? (
              <div className="text-center py-8 text-gray-400">
                <Rocket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No deployments yet</p>
                <p className="text-sm">Deployments will appear here after payment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workerStatus.recentDeployments.map((deployment) => {
                  const config = statusConfig[deployment.status] || statusConfig.queued;
                  return (
                    <div 
                      key={deployment.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          {config.icon}
                        </div>
                        <div>
                          <p className="font-medium">Deployment #{deployment.id}</p>
                          <p className="text-sm text-gray-400">
                            Intake #{deployment.intakeId} • Plan #{deployment.buildPlanId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={config.color}>
                          {config.label}
                        </Badge>
                        {deployment.productionUrl && (
                          <a 
                            href={deployment.productionUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#FF6A00] hover:underline flex items-center gap-1 text-sm"
                          >
                            View Site <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {deployment.errorMessage && (
                          <span className="text-red-400 text-sm max-w-xs truncate">
                            {deployment.errorMessage}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          {new Date(deployment.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
