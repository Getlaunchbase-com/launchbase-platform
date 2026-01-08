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
  Undo2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

const triggerConfig: Record<string, { label: string; color: string }> = {
  auto: {
    label: "Auto",
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  },
  manual: {
    label: "Manual",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  rollback: {
    label: "ROLLBACK",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
};

export default function AdminDeployments() {
  const [isRunning, setIsRunning] = useState(false);
  const [rollbackIntakeId, setRollbackIntakeId] = useState<number | null>(null);

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

  const rollbackMutation = trpc.admin.deploy.rollbackToLastSuccess.useMutation({
    onSuccess: (data) => {
      toast.success(`Rollback queued! Deployment #${data.newDeploymentId} created from #${data.sourceDeploymentId}`);
      setRollbackIntakeId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Rollback failed: ${error.message}`);
      setRollbackIntakeId(null);
    },
  });

  const handleRollback = (intakeId: number) => {
    setRollbackIntakeId(intakeId);
  };

  // Check if rollback is allowed for an intake
  const canRollback = (intakeId: number) => {
    if (!workerStatus?.recentDeployments) return { allowed: false, reason: "Loading..." };
    
    const intakeDeployments = workerStatus.recentDeployments.filter(d => d.intakeId === intakeId);
    
    // Check if any deployment is in flight
    const hasInFlight = intakeDeployments.some(d => d.status === "queued" || d.status === "running");
    if (hasInFlight) {
      return { allowed: false, reason: "Deployment in progress" };
    }
    
    // Check if there's a successful deployment
    const hasSuccess = intakeDeployments.some(d => d.status === "success");
    if (!hasSuccess) {
      return { allowed: false, reason: "No successful deployment found" };
    }
    
    return { allowed: true, reason: "" };
  };

  // Get last successful deployment for an intake
  const getLastSuccess = (intakeId: number) => {
    if (!workerStatus?.recentDeployments) return null;
    return workerStatus.recentDeployments
      .filter(d => d.intakeId === intakeId && d.status === "success")
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())[0];
  };

  const confirmRollback = () => {
    if (rollbackIntakeId) {
      rollbackMutation.mutate({ intakeId: rollbackIntakeId });
    }
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium">Deployment #{deployment.id}</p>
                            {deployment.trigger && (
                              <Badge className={triggerConfig[deployment.trigger]?.color || triggerConfig.auto.color} variant="outline">
                                {triggerConfig[deployment.trigger]?.label || deployment.trigger}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            Intake #{deployment.intakeId} • Plan #{deployment.buildPlanId}
                            {deployment.trigger === "rollback" && deployment.rolledBackFromDeploymentId && (
                              <> • Rolled back from <span className="text-purple-400">#{deployment.rolledBackFromDeploymentId}</span></>
                            )}
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
                        {(() => {
                          const rollbackStatus = canRollback(deployment.intakeId);
                          return (
                            <Button
                              onClick={() => handleRollback(deployment.intakeId)}
                              variant="outline"
                              size="sm"
                              disabled={!rollbackStatus.allowed}
                              className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={rollbackStatus.allowed ? "Rollback to last success" : rollbackStatus.reason}
                            >
                              <Undo2 className="w-3 h-3 mr-1" />
                              Rollback
                            </Button>
                          );
                        })()}
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

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={rollbackIntakeId !== null} onOpenChange={(open) => !open && setRollbackIntakeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback site?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                if (!rollbackIntakeId) return null;
                const lastSuccess = getLastSuccess(rollbackIntakeId);
                return (
                  <>
                    This will redeploy the last successful version using its saved build plan snapshot. It won't change your intake.
                    <br /><br />
                    {lastSuccess && (
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3 mt-2">
                        <p className="text-sm font-medium text-white">Rolling back to:</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Deployment #{lastSuccess.id} • {new Date(lastSuccess.completedAt || lastSuccess.createdAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Template: {lastSuccess.templateVersion}
                        </p>
                      </div>
                    )}
                    <br />
                    The rollback will be queued and processed like a normal deployment.
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRollback} className="bg-[#FF6A00] hover:bg-[#FF6A00]/90">
              Rollback to last successful deploy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
