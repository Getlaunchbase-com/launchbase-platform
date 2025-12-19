import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  HelpCircle
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
  ready: {
    label: "Ready for Deployment",
    helperText: "Ready to deploy when you are.",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  approved: {
    label: "Deployed",
    helperText: "Website is live and accessible.",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: <Rocket className="w-4 h-4" />,
  },
};

export default function AdminDashboard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data: intakes, isLoading, refetch } = trpc.admin.intakes.list.useQuery({
    status: statusFilter as "new" | "review" | "needs_info" | "ready" | "approved" | undefined,
    search: search || undefined,
  });

  const filteredIntakes = intakes || [];

  // Count by status
  const statusCounts = {
    new: filteredIntakes.filter(i => i.status === "new").length,
    review: filteredIntakes.filter(i => i.status === "review").length,
    needs_info: filteredIntakes.filter(i => i.status === "needs_info").length,
    ready: filteredIntakes.filter(i => i.status === "ready").length,
    approved: filteredIntakes.filter(i => i.status === "approved").length,
  };

  const totalIntakes = filteredIntakes.length;
  const pendingAction = statusCounts.new + statusCounts.needs_info;

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
                    <p className="text-sm text-gray-400">Ready to Deploy</p>
                    <p className="text-2xl font-bold text-green-400">{statusCounts.ready}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Live Sites</p>
                    <p className="text-2xl font-bold text-purple-400">{statusCounts.approved}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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

          {/* Search and Filter */}
          <div className="flex gap-4">
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
          </div>

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
                return (
                  <Link key={intake.id} href={`/admin/intake/${intake.id}`}>
                    <Card className="bg-white/5 border-white/10 hover:border-[#FF6A00]/50 transition-all cursor-pointer">
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
                );
              })
            )}
          </div>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
