import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  RefreshCw
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  needs_info: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  approved: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const statusIcons: Record<string, React.ReactNode> = {
  new: <Clock className="w-4 h-4" />,
  review: <RefreshCw className="w-4 h-4" />,
  needs_info: <AlertCircle className="w-4 h-4" />,
  ready: <CheckCircle className="w-4 h-4" />,
  approved: <Rocket className="w-4 h-4" />,
};

export default function AdminDashboard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { user } = useAuth();

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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Intake Dashboard</h1>
            <p className="text-gray-400">Manage customer intakes and deployments</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <Card 
              key={status}
              className={`cursor-pointer transition-all ${
                statusFilter === status ? "ring-2 ring-[#FF6A00]" : ""
              }`}
              onClick={() => setStatusFilter(statusFilter === status ? undefined : status)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-gray-400 capitalize">{status.replace("_", " ")}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${statusColors[status]}`}>
                    {statusIcons[status]}
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <p className="text-sm text-gray-500">Intakes will appear here when customers complete the onboarding flow</p>
              </CardContent>
            </Card>
          ) : (
            filteredIntakes.map((intake) => (
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
                        <Badge className={`${statusColors[intake.status]} capitalize`}>
                          {intake.status.replace("_", " ")}
                        </Badge>
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
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
