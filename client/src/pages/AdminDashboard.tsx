import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Filter, 
  ChevronRight, 
  Building2, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Rocket,
  RefreshCw,
  Eye,
  Download,
  CheckSquare,
  Square
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { TrendingUp, ExternalLink, MousePointerClick } from "lucide-react";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";

// Status configuration with improved labels and helper text
const statusConfig: Record<string, {
  label: string;
  helperText: string;
  color: string;
  icon: React.ReactNode;
}> = {
  new: {
    label: "Awaiting Review",
    helperText: "Intake complete. Ready to review.",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: <Clock className="w-4 h-4" />,
  },
  review: {
    label: "In Review",
    helperText: "Build plan being generated.",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: <Eye className="w-4 h-4" />,
  },
  needs_info: {
    label: "Needs Clarification",
    helperText: "Waiting on client response.",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: <AlertCircle className="w-4 h-4" />,
  },
  ready_for_review: {
    label: "Ready for Review",
    helperText: "Site ready for customer review.",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  approved: {
    label: "Approved",
    helperText: "Customer approved, awaiting payment.",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: <Rocket className="w-4 h-4" />,
  },
  paid: {
    label: "Paid",
    helperText: "Payment received, deploying.",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  deployed: {
    label: "Deployed",
    helperText: "Website is live and accessible.",
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    icon: <Rocket className="w-4 h-4" />,
  },
};

export default function AdminDashboard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: intakes, isLoading, refetch } = trpc.admin.intakes.list.useQuery({
    status: statusFilter as "new" | "review" | "needs_info" | "ready_for_review" | "approved" | "paid" | "deployed" | undefined,
    search: search || undefined,
  });

  const bulkUpdateMutation = trpc.admin.intakes.bulkUpdateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} intake(s)`);
      setSelectedIds([]);
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  const filteredIntakes = intakes || [];

  // Count by status
  const statusCounts = {
    new: filteredIntakes.filter(i => i.status === "new").length,
    review: filteredIntakes.filter(i => i.status === "review").length,
    needs_info: filteredIntakes.filter(i => i.status === "needs_info").length,
    ready_for_review: filteredIntakes.filter(i => i.status === "ready_for_review").length,
    paid: filteredIntakes.filter(i => i.status === "paid").length,
    deployed: filteredIntakes.filter(i => i.status === "deployed").length,
    approved: filteredIntakes.filter(i => i.status === "approved").length,
  };

  const totalIntakes = filteredIntakes.length;
  const pendingAction = statusCounts.new + statusCounts.needs_info;

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredIntakes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredIntakes.map(i => i.id));
    }
  };

  const handleBulkStatusUpdate = (status: string) => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      ids: selectedIds,
      status: status as "new" | "review" | "needs_info" | "ready_for_review" | "approved" | "paid" | "deployed",
    });
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/trpc/admin.intakes.export?input=${encodeURIComponent(JSON.stringify({
        ids: selectedIds.length > 0 ? selectedIds : undefined,
        status: statusFilter,
      }))}`);
      const data = await response.json();
      
      if (data.result?.data?.csv) {
        const blob = new Blob([data.result.data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `launchbase-intakes-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${data.result.data.count} intake(s)`);
      }
    } catch (error) {
      toast.error("Failed to export");
    }
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="p-6 space-y-6">
          {/* Header with improved copy */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Website Review</h1>
              <p className="text-gray-400">
                Review generated sites, request clarification if needed, or approve for deployment.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {pendingAction > 0 && (
                <Badge className="bg-[#FF6A00]/20 text-[#FF6A00] border-[#FF6A00]/30">
                  {pendingAction} pending action
                </Badge>
              )}
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </div>

          {/* Daily Health Summary */}
          <Card className="bg-gradient-to-r from-[#FF6A00]/10 to-transparent border-[#FF6A00]/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-sm text-gray-400">Total Intakes</p>
                    <p className="text-2xl font-bold">{totalIntakes}</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <p className="text-sm text-gray-400">Awaiting Review</p>
                    <p className="text-2xl font-bold text-blue-400">{statusCounts.new}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Ready for Review</p>
                    <p className="text-2xl font-bold text-green-400">{statusCounts.ready_for_review}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Live Sites</p>
                    <p className="text-2xl font-bold text-purple-400">{statusCounts.approved}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Referrers This Week */}
          <TopReferrersCard />

          {/* Worker Status */}
          <WorkerStatusCard />

          {/* System Observability */}
          <div className="lg:col-span-2">
            <ObservabilityPanel />
          </div>

          {/* Status Filter Cards with Tooltips */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(statusConfig).map(([status, config]) => (
              <Tooltip key={status}>
                <TooltipTrigger asChild>
                  <Card 
                    className={`cursor-pointer transition-all hover:border-[#FF6A00]/30 ${
                      statusFilter === status ? "ring-2 ring-[#FF6A00]" : ""
                    }`}
                    onClick={() => setStatusFilter(statusFilter === status ? undefined : status)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold">
                            {statusCounts[status as keyof typeof statusCounts]}
                          </p>
                          <p className="text-sm text-gray-400">{config.label}</p>
                        </div>
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          {config.icon}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{config.helperText}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Search, Filter, and Bulk Actions */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by business name..."
                className="pl-10"
              />
            </div>
            {statusFilter && (
              <Button 
                variant="outline" 
                onClick={() => setStatusFilter(undefined)}
                className="text-gray-400"
              >
                <Filter className="w-4 h-4 mr-2" /> Clear Filter
              </Button>
            )}
            
            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="px-3 py-1">
                  {selectedIds.length} selected
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Bulk Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate("review")}>
                      <Eye className="w-4 h-4 mr-2" /> Mark as In Review
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate("ready_for_review")}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Mark as Ready for Review
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate("approved")}>
                      <Rocket className="w-4 h-4 mr-2" /> Mark as Approved
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExport}>
                      <Download className="w-4 h-4 mr-2" /> Export Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </Button>
              </div>
            )}
            
            {/* Export All Button */}
            {selectedIds.length === 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            )}
          </div>

          {/* Select All */}
          {filteredIntakes.length > 0 && (
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={selectAll}
                className="text-gray-400 hover:text-white"
              >
                {selectedIds.length === filteredIntakes.length ? (
                  <CheckSquare className="w-4 h-4 mr-2" />
                ) : (
                  <Square className="w-4 h-4 mr-2" />
                )}
                {selectedIds.length === filteredIntakes.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          )}

          {/* Intake List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading intakes...</div>
            ) : filteredIntakes.length === 0 ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-12 text-center">
                  <Building2 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No intakes found</p>
                  <p className="text-sm text-gray-500">
                    Intakes will appear here when customers complete the onboarding flow
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredIntakes.map((intake) => {
                const config = statusConfig[intake.status];
                const isSelected = selectedIds.includes(intake.id);
                return (
                  <div key={intake.id} className="flex items-center gap-3">
                    <div 
                      onClick={(e) => toggleSelect(intake.id, e)}
                      className="cursor-pointer p-1"
                    >
                      <Checkbox 
                        checked={isSelected}
                        className="data-[state=checked]:bg-[#FF6A00] data-[state=checked]:border-[#FF6A00]"
                      />
                    </div>
                    <Link href={`/admin/intake/${intake.id}`} className="flex-1">
                      <Card className={`bg-white/5 border-white/10 hover:border-[#FF6A00]/50 transition-all cursor-pointer ${
                        isSelected ? "ring-1 ring-[#FF6A00]/50" : ""
                      }`}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-lg flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-[#FF6A00]" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{intake.businessName}</h3>
                                <p className="text-sm text-gray-400">
                                  {intake.contactName} • {intake.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge className={`${config.color} flex items-center gap-1`}>
                                    {config.icon}
                                    <span>{config.label}</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{config.helperText}</p>
                                </TooltipContent>
                              </Tooltip>
                              <Badge variant="outline" className="capitalize">
                                {intake.vertical}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {new Date(intake.createdAt).toLocaleDateString()}
                              </span>
                              <ChevronRight className="w-5 h-5 text-gray-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}

// Top Referrers Card Component
function TopReferrersCard() {
  const { data: topSites, isLoading } = trpc.referralAnalytics.topSites.useQuery(
    { limit: 3, timeWindowDays: 7, sortBy: "conversions" },
    { enabled: true }
  );

  const { data: clicks7d } = trpc.referralAnalytics.clicks7d.useQuery();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-center h-20">
            <div className="animate-pulse text-muted-foreground">Loading referral data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/20">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <p className="text-sm text-gray-400">Top Referrers (7 days)</p>
              </div>
              <div className="mt-2 space-y-1">
                {topSites && topSites.length > 0 ? (
                  topSites.map((site: any, idx: number) => (
                    <div key={site.siteId} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-4">{idx + 1}.</span>
                      <span className="font-medium">{site.siteSlug}</span>
                      <span className="text-emerald-400">{site.clicks} clicks</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-purple-400">{site.applySubmits} converts</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No referral data yet</p>
                )}
              </div>
            </div>
            <div className="h-16 w-px bg-white/10" />
            <div>
              <p className="text-sm text-gray-400">7-Day Badge Clicks</p>
              <p className="text-2xl font-bold text-emerald-400">{clicks7d || 0}</p>
            </div>
          </div>
          <Link href="/admin/referral-analytics?range=7d">
            <Button variant="outline" size="sm" className="gap-2">
              View Analytics <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}


function WorkerStatusCard() {
  // Use the admin.deploy.workerStatus endpoint for queue status
  const { data: deployStatus, isLoading } = trpc.admin.deploy.workerStatus.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="bg-[#1A1A1A] border-white/10">
        <CardContent className="py-4">
          <div className="animate-pulse">
            <div className="h-4 bg-white/10 rounded w-32 mb-2" />
            <div className="h-6 bg-white/10 rounded w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats from recent deployments
  const recentDeployments = deployStatus?.recentDeployments || [];
  const queuedCount = deployStatus?.queuedCount || 0;
  const runningCount = deployStatus?.runningCount || 0;
  
  // Find the most recent completed deployment
  const lastCompleted = recentDeployments.find(d => d.status === 'success' || d.status === 'failed');
  const minutesAgo = lastCompleted?.completedAt 
    ? Math.round((Date.now() - new Date(lastCompleted.completedAt).getTime()) / 60000)
    : null;
  const lastResult = lastCompleted?.status;

  // Determine status color
  let statusColor = "text-gray-400";
  let statusBg = "bg-gray-500/20";
  let statusText = "No runs yet";
  
  if (minutesAgo !== null && minutesAgo !== undefined) {
    if (minutesAgo <= 5) {
      statusColor = "text-emerald-400";
      statusBg = "bg-emerald-500/20";
      statusText = `${minutesAgo}m ago`;
    } else if (minutesAgo <= 15) {
      statusColor = "text-yellow-400";
      statusBg = "bg-yellow-500/20";
      statusText = `${minutesAgo}m ago`;
    } else {
      statusColor = "text-red-400";
      statusBg = "bg-red-500/20";
      statusText = `${minutesAgo}m ago`;
    }
  }

  return (
    <Card className="bg-[#1A1A1A] border-white/10">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${statusBg}`}>
              <RefreshCw className={`w-5 h-5 ${statusColor}`} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Last Worker Run</p>
              <p className={`text-lg font-semibold ${statusColor}`}>{statusText}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-yellow-400 font-semibold">{queuedCount}</p>
              <p className="text-gray-500 text-xs">Queued</p>
            </div>
            <div className="text-center">
              <p className="text-blue-400 font-semibold">{runningCount}</p>
              <p className="text-gray-500 text-xs">Running</p>
            </div>
            <div className="text-center">
              <p className="text-emerald-400 font-semibold">
                {recentDeployments.filter(d => d.status === 'success').length}
              </p>
              <p className="text-gray-500 text-xs">Completed</p>
            </div>
          </div>
        </div>
        {lastCompleted && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-xs text-gray-500">
              Last deployment: <span className={lastResult === "success" ? "text-emerald-400" : "text-red-400"}>{lastResult}</span>
              {lastCompleted.productionUrl && (
                <span className="ml-2 text-gray-600">— {lastCompleted.productionUrl}</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
