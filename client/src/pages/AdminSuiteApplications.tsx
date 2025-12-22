import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Rocket,
  Eye,
  RefreshCw,
  MapPin,
  Mail,
  Phone,
  User,
  Globe,
  Layers,
  Calendar,
  DollarSign,
  Search,
  X,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Status configuration
const statusConfig: Record<string, {
  label: string;
  color: string;
  icon: React.ReactNode;
}> = {
  submitted: {
    label: "New",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: <Clock className="w-4 h-4" />,
  },
  ready_for_review: {
    label: "Reviewing",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: <Eye className="w-4 h-4" />,
  },
  preview_ready: {
    label: "Preview Ready",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: <Eye className="w-4 h-4" />,
  },
  approved: {
    label: "Approved",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  paid: {
    label: "Paid",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    icon: <DollarSign className="w-4 h-4" />,
  },
  active: {
    label: "Active",
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    icon: <Rocket className="w-4 h-4" />,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

// Vertical labels
const verticalLabels: Record<string, string> = {
  trades: "Trades",
  health: "Health",
  beauty: "Beauty",
  food: "Food",
  cannabis: "Cannabis",
  professional: "Professional",
  fitness: "Fitness",
  automotive: "Automotive",
};

// Cadence labels
const cadenceLabels: Record<string, string> = {
  LOW: "1-2 posts/week",
  MEDIUM: "3-4 posts/week",
  HIGH: "Daily posts",
};

// Mode labels
const modeLabels: Record<string, string> = {
  AUTO: "Fully Automatic",
  GUIDED: "Review & Approve",
  CUSTOM: "Custom Control",
};

// Language labels
const languageLabels: Record<string, string> = {
  en: "EN",
  es: "ES",
  pl: "PL",
};

type Application = {
  id: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  language: "en" | "es" | "pl";
  vertical: string;
  industry: string | null;
  cityZip: string;
  radiusMiles: number;
  cadence: string;
  mode: string;
  layers: { weather: true; sports: boolean; community: boolean; trends: boolean };
  pricing: { monthlyTotal: number; setupFee: number; cadenceMonthly: number; layersMonthly: number };
  startTiming: string;
  status: string;
  previewToken: string | null;
  adminNotes: string | null;
  reviewedBy: string | null;
  intakeId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export default function AdminSuiteApplications() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verticalFilter, setVerticalFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [notes, setNotes] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [businessName, setBusinessName] = useState("");

  const { data: applications, isLoading, refetch } = trpc.suiteApply.list.useQuery({
    status: statusFilter !== "all" ? statusFilter as any : undefined,
  });

  const updateStatus = trpc.suiteApply.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const setNotesMutation = trpc.suiteApply.setNotes.useMutation({
    onSuccess: () => {
      toast.success("Notes saved");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to save notes: ${error.message}`);
    },
  });

  const approveAndCreate = trpc.suiteApply.approveAndCreateIntake.useMutation({
    onSuccess: (data) => {
      toast.success(`Intake created! ID: ${data.intakeId}`);
      setShowApproveModal(false);
      setBusinessName("");
      setSelectedApp(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  // Update notes when selected app changes
  useEffect(() => {
    if (selectedApp) {
      setNotes(selectedApp.adminNotes || "");
    }
  }, [selectedApp?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedApp) return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        if (!selectedApp.intakeId) {
          setBusinessName("");
          setShowApproveModal(true);
        } else {
          toast.info("Already has an intake");
        }
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        updateStatus.mutate({ id: selectedApp.id, status: "ready_for_review" });
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        updateStatus.mutate({ id: selectedApp.id, status: "rejected" });
      } else if (e.key === "Escape") {
        setSelectedApp(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedApp, updateStatus]);

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatRelativeDate = (date: Date | string) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
  };

  const isNew = (date: Date | string) => {
    const now = new Date();
    const d = new Date(date);
    return now.getTime() - d.getTime() < 24 * 60 * 60 * 1000;
  };

  const formatLayers = (layers: { weather: true; sports: boolean; community: boolean; trends: boolean }) => {
    const active = ["Weather"];
    if (layers.sports) active.push("Sports");
    if (layers.community) active.push("Community");
    if (layers.trends) active.push("Trends");
    return active.join(", ");
  };

  // Filter applications
  const filteredApps = applications?.filter(app => {
    if (verticalFilter !== "all" && app.vertical !== verticalFilter) return false;
    if (languageFilter !== "all" && app.language !== languageFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        app.contactName.toLowerCase().includes(searchLower) ||
        app.contactEmail.toLowerCase().includes(searchLower) ||
        app.contactPhone.includes(search) ||
        (app.industry && app.industry.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  const saveNotes = () => {
    if (selectedApp) {
      setNotesMutation.mutate({ id: selectedApp.id, adminNotes: notes });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Suite Applications</h1>
            <p className="text-gray-400 text-sm mt-1">
              {filteredApps?.length || 0} applications
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-white/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-white/5 border-white/10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1d] border-white/10">
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Vertical filter */}
          <Select value={verticalFilter} onValueChange={setVerticalFilter}>
            <SelectTrigger className="w-[140px] bg-white/5 border-white/10">
              <SelectValue placeholder="Vertical" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1d] border-white/10">
              <SelectItem value="all">All Verticals</SelectItem>
              {Object.entries(verticalLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Language filter */}
          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className="w-[120px] bg-white/5 border-white/10">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1d] border-white/10">
              <SelectItem value="all">All Languages</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="pl">Polish</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Applications List */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : !filteredApps?.length ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-gray-500" />
              </div>
              <p className="text-gray-400 font-medium">No applications yet</p>
              <p className="text-gray-500 text-sm mt-1">
                When someone applies at /apply, they'll appear here instantly.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5 text-xs text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Submitted</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Vertical</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Location</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Cadence</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Layers</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredApps.map((app) => {
                  const status = statusConfig[app.status] || statusConfig.submitted;
                  const layers = app.layers as { weather: true; sports: boolean; community: boolean; trends: boolean };
                  const pricing = app.pricing as { monthlyTotal: number; setupFee: number };
                  const appIsNew = isNew(app.createdAt);

                  return (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedApp(app as Application)}
                      className="hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {appIsNew && (
                            <span className="w-2 h-2 rounded-full bg-[#FF6A00] animate-pulse" />
                          )}
                          <span className="text-sm text-gray-300" title={formatDate(app.createdAt)}>
                            {formatRelativeDate(app.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{app.contactName}</div>
                        <div className="text-xs text-gray-500">{app.contactEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-white/20 text-xs">
                            {verticalLabels[app.vertical] || app.vertical}
                          </Badge>
                          <Badge variant="outline" className="border-white/10 text-xs text-gray-500">
                            {languageLabels[app.language]}
                          </Badge>
                        </div>
                        {app.industry && (
                          <div className="text-xs text-gray-500 mt-1">{app.industry.replace(/_/g, " ")}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-400">{app.cityZip}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-gray-400">{cadenceLabels[app.cadence] || app.cadence}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500" title="Weather" />
                          {layers.sports && <span className="w-2 h-2 rounded-full bg-green-500" title="Sports" />}
                          {layers.community && <span className="w-2 h-2 rounded-full bg-purple-500" title="Community" />}
                          {layers.trends && <span className="w-2 h-2 rounded-full bg-orange-500" title="Trends" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${status.color} border text-xs`}>
                          {status.icon}
                          <span className="ml-1">{status.label}</span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-[#FF6A00] font-medium">${pricing.monthlyTotal}/mo</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <span className="sr-only">Actions</span>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#1a1a1d] border-white/10">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApp(app as Application);
                                }}
                              >
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus.mutate({ id: app.id, status: "approved" });
                                }}
                              >
                                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus.mutate({ id: app.id, status: "ready_for_review" });
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2 text-yellow-500" />
                                Mark Reviewing
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus.mutate({ id: app.id, status: "rejected" });
                                }}
                                className="text-red-400"
                              >
                                <AlertCircle className="w-4 h-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Drawer */}
        <Sheet open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
          <SheetContent className="w-full sm:max-w-lg bg-[#0B0B0C] border-white/10 overflow-y-auto">
            {selectedApp && (
              <>
                <SheetHeader className="mb-6">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="text-white">{selectedApp.contactName}</SheetTitle>
                    {isNew(selectedApp.createdAt) && (
                      <Badge className="bg-[#FF6A00]/20 text-[#FF6A00] border-[#FF6A00]/30">New</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{formatDate(selectedApp.createdAt)}</p>
                </SheetHeader>

                <div className="space-y-6">
                  {/* Quick Actions */}
                  {selectedApp.intakeId ? (
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-green-400 font-medium">Approved & Intake Created</p>
                          <p className="text-sm text-gray-400">Intake ID: {selectedApp.intakeId}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-500/30 text-green-400"
                          onClick={() => window.location.href = `/admin/intake/${selectedApp.intakeId}`}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Intake
                        </Button>
                      </div>
                    </div>
                  ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setBusinessName("");
                        setShowApproveModal(true);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={approveAndCreate.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve & Create Intake (A)
                    </Button>
                    <Button
                      onClick={() => updateStatus.mutate({ id: selectedApp.id, status: "ready_for_review" })}
                      variant="outline"
                      className="flex-1 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                      disabled={updateStatus.isPending}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review (N)
                    </Button>
                    <Button
                      onClick={() => updateStatus.mutate({ id: selectedApp.id, status: "rejected" })}
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      disabled={updateStatus.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  )}

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Status:</span>
                    <Badge className={`${statusConfig[selectedApp.status]?.color || statusConfig.submitted.color} border`}>
                      {statusConfig[selectedApp.status]?.icon}
                      <span className="ml-1">{statusConfig[selectedApp.status]?.label || selectedApp.status}</span>
                    </Badge>
                    {selectedApp.reviewedBy && (
                      <span className="text-xs text-gray-500">by {selectedApp.reviewedBy}</span>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3 p-4 rounded-lg bg-white/5 border border-white/10">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-300">
                          <User className="w-4 h-4 text-gray-500" />
                          {selectedApp.contactName}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <a href={`mailto:${selectedApp.contactEmail}`} className="hover:text-[#FF6A00]">
                            {selectedApp.contactEmail}
                          </a>
                        </div>
                        <button
                          onClick={() => copyToClipboard(selectedApp.contactEmail, "email")}
                          className="text-gray-500 hover:text-white"
                        >
                          {copiedField === "email" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <a href={`tel:${selectedApp.contactPhone}`} className="hover:text-[#FF6A00]">
                            {selectedApp.contactPhone}
                          </a>
                        </div>
                        <button
                          onClick={() => copyToClipboard(selectedApp.contactPhone, "phone")}
                          className="text-gray-500 hover:text-white"
                        >
                          {copiedField === "phone" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <Globe className="w-4 h-4 text-gray-500" />
                        {languageLabels[selectedApp.language] === "EN" ? "English" : languageLabels[selectedApp.language] === "ES" ? "Spanish" : "Polish"}
                      </div>
                    </div>
                  </div>

                  {/* Business Info */}
                  <div className="space-y-3 p-4 rounded-lg bg-white/5 border border-white/10">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Business</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Vertical</span>
                        <span className="text-gray-300">{verticalLabels[selectedApp.vertical] || selectedApp.vertical}</span>
                      </div>
                      {selectedApp.industry && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Industry</span>
                          <span className="text-gray-300">{selectedApp.industry.replace(/_/g, " ")}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Location</span>
                        <span className="text-gray-300">{selectedApp.cityZip} ({selectedApp.radiusMiles} mi)</span>
                      </div>
                    </div>
                  </div>

                  {/* What They're Buying */}
                  <div className="space-y-3 p-4 rounded-lg bg-white/5 border border-white/10">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Configuration</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cadence</span>
                        <span className="text-gray-300">{cadenceLabels[selectedApp.cadence] || selectedApp.cadence}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Mode</span>
                        <span className="text-gray-300">{modeLabels[selectedApp.mode] || selectedApp.mode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Layers</span>
                        <span className="text-gray-300">{formatLayers(selectedApp.layers)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Start</span>
                        <span className="text-gray-300">
                          {selectedApp.startTiming === "NOW" ? "Immediately" : selectedApp.startTiming === "TWO_WEEKS" ? "In 2 weeks" : "Exploring"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="space-y-3 p-4 rounded-lg bg-[#FF6A00]/10 border border-[#FF6A00]/20">
                    <h3 className="text-xs font-medium text-[#FF6A00] uppercase tracking-wider">Pricing</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Cadence</span>
                        <span className="text-gray-300">${selectedApp.pricing.cadenceMonthly}/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Layers</span>
                        <span className="text-gray-300">${selectedApp.pricing.layersMonthly}/mo</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-white/10">
                        <span className="text-white font-medium">Monthly Total</span>
                        <span className="text-[#FF6A00] font-bold">${selectedApp.pricing.monthlyTotal}/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Setup Fee</span>
                        <span className="text-gray-300">${selectedApp.pricing.setupFee}</span>
                      </div>
                    </div>
                  </div>

                  {/* Admin Notes */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Notes</h3>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add internal notes about this application..."
                      className="bg-white/5 border-white/10 min-h-[100px]"
                    />
                    <Button
                      onClick={saveNotes}
                      disabled={setNotesMutation.isPending || notes === (selectedApp.adminNotes || "")}
                      variant="outline"
                      size="sm"
                      className="border-white/10"
                    >
                      {setNotesMutation.isPending ? "Saving..." : "Save Notes"}
                    </Button>
                  </div>

                  {/* Preview Token */}
                  {selectedApp.previewToken && (
                    <div className="text-xs text-gray-500 pt-4 border-t border-white/10">
                      Preview Token: <code className="bg-white/5 px-2 py-0.5 rounded">{selectedApp.previewToken}</code>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Approve Modal */}
        <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
          <DialogContent className="bg-[#0B0B0C] border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">Approve & Create Intake</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-400">
                This will create an intake record and start the build process for this customer.
              </p>
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-gray-300">Business Name</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter business name"
                  className="bg-white/5 border-white/10"
                  autoFocus
                />
              </div>
              {selectedApp && (
                <div className="text-sm text-gray-500 space-y-1">
                  <p><strong>Contact:</strong> {selectedApp.contactName}</p>
                  <p><strong>Email:</strong> {selectedApp.contactEmail}</p>
                  <p><strong>Vertical:</strong> {verticalLabels[selectedApp.vertical] || selectedApp.vertical}</p>
                  {selectedApp.industry && <p><strong>Industry:</strong> {selectedApp.industry.replace(/_/g, " ")}</p>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowApproveModal(false)}
                className="border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedApp && businessName.trim()) {
                    approveAndCreate.mutate({
                      id: selectedApp.id,
                      businessName: businessName.trim(),
                    });
                  }
                }}
                disabled={!businessName.trim() || approveAndCreate.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveAndCreate.isPending ? "Creating..." : "Approve & Create Intake"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
