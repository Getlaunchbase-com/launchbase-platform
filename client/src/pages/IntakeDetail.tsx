import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Wrench,
  Palette,
  FileText,
  Rocket,
  CheckCircle,
  AlertCircle,
  Send,
  ExternalLink,
  Ban,
  MessageSquare,
  Info,
  Sparkles,
  Play,
  Eye,
  RefreshCw,
  CreditCard,
  Clock,
  Link as LinkIcon,
  Zap
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { generatePreviewHTML } from "@/lib/previewGenerator";
import ActionRequestsCard from "@/components/ActionRequestsCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Status configuration matching the state machine
const statusConfig: Record<string, {
  label: string;
  helperText: string;
  color: string;
  step: number;
}> = {
  new: {
    label: "Awaiting Review",
    helperText: "Intake complete. Ready to start review.",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    step: 1,
  },
  review: {
    label: "In Review",
    helperText: "Reviewing intake. Generate build plan and send preview.",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    step: 2,
  },
  needs_info: {
    label: "Needs Clarification",
    helperText: "Waiting on client response.",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    step: 2,
  },
  ready_for_review: {
    label: "Preview Sent",
    helperText: "Customer has preview link. Waiting for approval.",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    step: 3,
  },
  approved: {
    label: "Customer Approved",
    helperText: "Customer approved. Waiting for payment.",
    color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    step: 4,
  },
  paid: {
    label: "Paid",
    helperText: "Payment received. Ready to deploy.",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    step: 5,
  },
  deployed: {
    label: "Live",
    helperText: "Website is live and accessible.",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    step: 6,
  },
  // Legacy statuses for backwards compatibility
  draft: {
    label: "Draft",
    helperText: "Build plan in draft state.",
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    step: 1,
  },
  ready: {
    label: "Ready",
    helperText: "Ready for next step.",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    step: 3,
  },
};

// State machine step labels for the stepper
const STEPPER_STEPS = [
  { key: "new", label: "New" },
  { key: "review", label: "Review" },
  { key: "ready_for_review", label: "Preview" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "deployed", label: "Live" },
];

export default function IntakeDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const intakeId = parseInt(params.id || "0");

  const [clarifyQuestion, setClarifyQuestion] = useState("");
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const { data: intake, isLoading, refetch: refetchIntake } = trpc.admin.intakes.detail.useQuery({ id: intakeId });
  const { data: buildPlan, refetch: refetchBuildPlan } = trpc.admin.buildPlan.getByIntake.useQuery({ intakeId });

  // Status update mutation with transition enforcement
  const updateStatusMutation = trpc.admin.intakes.updateStatus.useMutation({
    onSuccess: () => {
      refetchIntake();
      refetchBuildPlan();
      toast.success("Status updated successfully");
    },
    onError: (error) => {
      // Show the transition error message from server
      toast.error(error.message || "That step isn't allowed yet.");
    },
  });

  const generateBuildPlanMutation = trpc.admin.buildPlan.generate.useMutation({
    onSuccess: () => {
      refetchBuildPlan();
      toast.success("Build plan generated!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const approveBuildPlanMutation = trpc.admin.buildPlan.approve.useMutation({
    onSuccess: () => {
      refetchBuildPlan();
      toast.success("Website approved. Deployment queued.");
    },
  });

  const startDeployMutation = trpc.admin.deploy.start.useMutation({
    onSuccess: (data) => {
      if (data.deploymentId) {
        setShowDeployModal(false);
        setLocation(`/admin/deploy/${data.deploymentId}`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createClarifyMutation = trpc.admin.clarify.create.useMutation({
    onSuccess: (data) => {
      if (data.link) {
        navigator.clipboard.writeText(window.location.origin + data.link);
        toast.success("Clarification request sent to client.");
        setShowClarifyModal(false);
        setClarifyQuestion("");
      }
    },
  });

  // Resend preview email mutation with cooldown
  const resendPreviewEmailMutation = trpc.admin.intakes.resendPreviewEmail.useMutation({
    onSuccess: (data) => {
      toast.success(`Preview email resent to ${data.sentTo}`);
      setResendCooldown(60);
    },
    onError: (error) => {
      // Handle cooldown error specially
      if (error.data?.code === "TOO_MANY_REQUESTS") {
        const match = error.message.match(/(\d+) seconds/);
        if (match) {
          setResendCooldown(parseInt(match[1]));
        }
      }
      toast.error(error.message);
    },
  });

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-gray-400">Loading intake...</div>
      </DashboardLayout>
    );
  }

  if (!intake) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-400">Intake not found</p>
          <Link href="/admin">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const handleGenerateBuildPlan = () => {
    generateBuildPlanMutation.mutate({ intakeId });
  };

  const handleApproveBuildPlan = () => {
    if (buildPlan) {
      approveBuildPlanMutation.mutate({ id: buildPlan.id });
    }
  };

  const handleDeploy = () => {
    if (buildPlan) {
      startDeployMutation.mutate({ buildPlanId: buildPlan.id });
    }
  };

  const handleCreateClarify = () => {
    if (clarifyQuestion.trim()) {
      createClarifyMutation.mutate({
        intakeId,
        questionKey: "custom",
        questionText: clarifyQuestion,
        inputType: "text",
      });
    }
  };

  const handleHoldBuild = () => {
    toast.info("Build held. Intake marked as invalid.");
    setShowHoldModal(false);
  };

  // Calculate confidence score (mock for now)
  const confidenceScore = 85;
  const needsClarification = confidenceScore < 70;

  const intakeStatus = statusConfig[intake.status] || statusConfig.new;
  const buildPlanStatus = buildPlan ? (statusConfig[buildPlan.status] || statusConfig.draft) : null;

  return (
    <DashboardLayout>
      <TooltipProvider>
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
                <h1 className="text-2xl font-bold">{intake.businessName}</h1>
                <p className="text-gray-400">{intake.contactName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger>
                  <Badge className={`${intakeStatus.color}`}>
                    {intakeStatus.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{intakeStatus.helperText}</p>
                </TooltipContent>
              </Tooltip>
              <Badge variant="outline" className="capitalize">
                {intake.vertical}
              </Badge>
              {/* Payment Status */}
              {(intake as any).paymentStatus && (
                <Badge className={`${
                  (intake as any).paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  (intake as any).paymentStatus === 'refunded' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }`}>
                  {(intake as any).paymentStatus === 'paid' ? 'Paid' :
                   (intake as any).paymentStatus === 'refunded' ? 'Refunded' : 'Unpaid'}
                </Badge>
              )}
              {/* Module Status Tags */}
              {(intake as any).modules?.includes('quickbooks') && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  QB: {(intake as any).modulesActivated?.includes('quickbooks') ? 'Active' : 'Pending'}
                </Badge>
              )}
              {(intake as any).modules?.includes('google_ads') && (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  Ads: {(intake as any).modulesActivated?.includes('google_ads') ? 'Active' : 'Pending'}
                </Badge>
              )}
            </div>
          </div>

          {/* Auto-Advanced Banner */}
          {(intake as any).rawPayload?.autoAdvanced && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <Zap className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-cyan-400 font-medium">This intake was auto-advanced</p>
                <p className="text-cyan-400/70 text-sm">
                  LaunchBase prepared the preview automatically after no admin action to prevent customer delays.
                </p>
              </div>
            </div>
          )}

          {/* Status Stepper */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="py-4">
              {/* Stepper */}
              <div className="flex items-center justify-between mb-4">
                {STEPPER_STEPS.map((step, index) => {
                  const currentStep = statusConfig[intake.status]?.step || 1;
                  const stepNumber = index + 1;
                  const isCompleted = stepNumber < currentStep;
                  const isCurrent = stepNumber === currentStep;
                  const isFuture = stepNumber > currentStep;
                  
                  return (
                    <div key={step.key} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          isCompleted ? 'bg-green-500 text-white' :
                          isCurrent ? 'bg-[#FF6A00] text-white' :
                          'bg-white/10 text-gray-500'
                        }`}>
                          {isCompleted ? <CheckCircle className="w-4 h-4" /> : stepNumber}
                        </div>
                        <span className={`text-xs mt-1 ${
                          isCurrent ? 'text-[#FF6A00] font-medium' :
                          isCompleted ? 'text-green-400' :
                          'text-gray-500'
                        }`}>{step.label}</span>
                      </div>
                      {index < STEPPER_STEPS.length - 1 && (
                        <div className={`w-12 h-0.5 mx-2 ${
                          isCompleted ? 'bg-green-500' : 'bg-white/10'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* System rule line */}
              <p className="text-xs text-gray-500 text-center mb-4">
                Customers always preview before paying. Payment is required before deployment.
              </p>
              
              {/* State-driven action buttons */}
              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <div className="text-sm text-gray-400">
                  {intakeStatus.helperText}
                </div>
                <div className="flex gap-2">
                  {/* Artifact links */}
                  {(intake as any).previewToken && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/preview/${(intake as any).previewToken}`, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Open Preview
                      </Button>
                      
                      {/* Copy Preview Link button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const previewUrl = `${window.location.origin}/preview/${(intake as any).previewToken}`;
                              navigator.clipboard.writeText(previewUrl);
                              toast.success("Preview link copied to clipboard");
                            }}
                          >
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Copy Link
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy preview link to share with customer</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      {/* Resend Preview Email button - only show when ready_for_review */}
                      {intake.status === 'ready_for_review' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendPreviewEmailMutation.mutate({ intakeId })}
                              disabled={resendPreviewEmailMutation.isPending || resendCooldown > 0}
                            >
                              <RefreshCw className={`w-4 h-4 mr-2 ${resendPreviewEmailMutation.isPending ? 'animate-spin' : ''}`} />
                              {resendCooldown > 0 
                                ? `Wait ${resendCooldown}s` 
                                : resendPreviewEmailMutation.isPending 
                                  ? 'Sending...' 
                                  : 'Resend Email'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Resend preview email to {intake.email}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}
                  
                  {(intake as any).previewUrl && intake.status === 'deployed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open((intake as any).previewUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Live Site
                    </Button>
                  )}
                  
                  {/* Primary action button based on current status */}
                  {intake.status === 'new' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ id: intakeId, status: 'review' })}
                      disabled={updateStatusMutation.isPending}
                      className="bg-[#FF6A00] hover:bg-[#FF6A00]/90"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {updateStatusMutation.isPending ? 'Starting...' : 'Start Review'}
                    </Button>
                  )}
                  
                  {intake.status === 'review' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ id: intakeId, status: 'ready_for_review' })}
                      disabled={updateStatusMutation.isPending}
                      className="bg-[#FF6A00] hover:bg-[#FF6A00]/90"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {updateStatusMutation.isPending ? 'Sending...' : 'Send Preview to Customer'}
                    </Button>
                  )}
                  
                  {intake.status === 'needs_info' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ id: intakeId, status: 'ready_for_review' })}
                      disabled={updateStatusMutation.isPending}
                      className="bg-[#FF6A00] hover:bg-[#FF6A00]/90"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {updateStatusMutation.isPending ? 'Sending...' : 'Send Preview to Customer'}
                    </Button>
                  )}
                  
                  {intake.status === 'ready_for_review' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            disabled
                            variant="secondary"
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            Awaiting Customer Approval
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Customer must approve via preview link before proceeding.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {intake.status === 'approved' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            disabled
                            variant="secondary"
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            Awaiting Payment
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Customer must complete payment via Stripe before deployment.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {intake.status === 'paid' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ id: intakeId, status: 'deployed' })}
                      disabled={updateStatusMutation.isPending}
                      className="bg-green-600 hover:bg-green-600/90"
                    >
                      <Rocket className="w-4 h-4 mr-2" />
                      {updateStatusMutation.isPending ? 'Deploying...' : 'Deploy Now'}
                    </Button>
                  )}
                  
                  {intake.status === 'deployed' && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-4 py-2">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Site is Live
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Disabled state helper text */}
              {(intake.status === 'ready_for_review' || intake.status === 'approved') && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-400">
                    {intake.status === 'ready_for_review' && 
                      "Customer must approve the preview before you can proceed. They'll receive an email with the preview link."}
                    {intake.status === 'approved' && 
                      "Payment is required before deployment can start. Customer will complete checkout via Stripe."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Intake Details */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#FF6A00]" />
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{intake.email}</span>
                </div>
                {intake.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{intake.phone}</span>
                  </div>
                )}
                {intake.serviceArea && intake.serviceArea.length > 0 && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                    <div className="flex flex-wrap gap-2">
                      {intake.serviceArea.map((area) => (
                        <Badge key={area} variant="secondary">{area}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {intake.services && intake.services.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Wrench className="w-4 h-4 text-gray-400 mt-1" />
                    <div className="flex flex-wrap gap-2">
                      {intake.services.map((service) => (
                        <Badge key={service} variant="outline">{service}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {intake.tagline && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 mt-1" />
                    <span className="italic">"{intake.tagline}"</span>
                  </div>
                )}
                {intake.brandColors && (
                  <div className="flex items-center gap-3">
                    <Palette className="w-4 h-4 text-gray-400" />
                    <div className="flex gap-2">
                      {intake.brandColors.primary && (
                        <div 
                          className="w-8 h-8 rounded border border-white/20"
                          style={{ backgroundColor: intake.brandColors.primary }}
                          title={intake.brandColors.primary}
                        />
                      )}
                      {intake.brandColors.secondary && (
                        <div 
                          className="w-8 h-8 rounded border border-white/20"
                          style={{ backgroundColor: intake.brandColors.secondary }}
                          title={intake.brandColors.secondary}
                        />
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Build Summary Panel */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#FF6A00]" />
                    Build Summary
                  </span>
                  {buildPlanStatus && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className={buildPlanStatus.color}>
                          {buildPlanStatus.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{buildPlanStatus.helperText}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </CardTitle>
                <CardDescription>Generated from intake + AI inference.</CardDescription>
              </CardHeader>
              <CardContent>
                {!buildPlan ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No build plan generated yet</p>
                    <Button 
                      onClick={handleGenerateBuildPlan}
                      disabled={generateBuildPlanMutation.isPending}
                      className="bg-[#FF6A00] hover:bg-[#FF6A00]/90"
                    >
                      {generateBuildPlanMutation.isPending ? "Generating..." : "Generate Build Plan"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Key metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Vertical</p>
                        <p className="font-semibold capitalize">{intake.vertical}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Primary CTA</p>
                        <p className="font-semibold">{buildPlan.plan?.copy.ctaText || "Call Now"}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Tone</p>
                        <p className="font-semibold">Professional</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <Tooltip>
                          <TooltipTrigger className="w-full text-left">
                            <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                              Confidence Score
                              <Info className="w-3 h-3" />
                            </p>
                            <p className={`font-semibold ${confidenceScore >= 70 ? "text-green-400" : "text-orange-400"}`}>
                              {confidenceScore}%
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Scores under 70% require clarification before approval.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    
                    {buildPlan.plan && (
                      <>
                        <div>
                          <p className="text-sm text-gray-400 mb-2">Pages</p>
                          <div className="flex flex-wrap gap-2">
                            {buildPlan.plan.pages.map((page) => (
                              <Badge key={page.id} variant="secondary">{page.title}</Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-400 mb-2">Hero Copy</p>
                          <p className="font-semibold">{buildPlan.plan.copy.heroHeadline}</p>
                          <p className="text-sm text-gray-400">{buildPlan.plan.copy.heroSubheadline}</p>
                        </div>
                      </>
                    )}

                    {/* Preview button */}
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => {
                        // Generate preview HTML based on intake data
                        const previewHTML = generatePreviewHTML(intake, buildPlan);
                        const newWindow = window.open('', '_blank');
                        if (newWindow) {
                          newWindow.document.write(previewHTML);
                          newWindow.document.close();
                        }
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Preview in New Tab
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Service Selection & Pricing Card */}
          {intake.rawPayload?.pricingSnapshot && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#FF6A00]" />
                  Service Selection & Pricing
                </CardTitle>
                <CardDescription>
                  What the customer selected and what they were charged
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Service Selections */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Services Selected</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Website */}
                    <div className="flex items-center gap-2">
                      {intake.rawPayload.website ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Ban className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={intake.rawPayload.website ? "text-gray-200" : "text-gray-600"}>
                        Website
                      </span>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2">
                      {intake.rawPayload.emailService ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Ban className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={intake.rawPayload.emailService ? "text-gray-200" : "text-gray-600"}>
                        Email Service {intake.rawPayload.website ? " (required)" : ""}
                      </span>
                    </div>

                    {/* Social Media */}
                    <div className="flex items-center gap-2">
                      {intake.rawPayload.socialMediaTier ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Ban className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={intake.rawPayload.socialMediaTier ? "text-gray-200" : "text-gray-600"}>
                        Social Media
                        {intake.rawPayload.socialMediaTier ? (
                          <span className="text-xs text-gray-400 ml-1">
                            ({String(intake.rawPayload.socialMediaTier) === "LOW" ? "4 posts" : 
                              String(intake.rawPayload.socialMediaTier) === "MEDIUM" ? "8 posts" : "12 posts"})
                          </span>
                        ) : null}
                      </span>
                    </div>

                    {/* Enrichment Layer */}
                    <div className="flex items-center gap-2">
                      {intake.rawPayload.enrichmentLayer ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Ban className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={intake.rawPayload.enrichmentLayer ? "text-gray-200" : "text-gray-600"}>
                        Enrichment Layer
                      </span>
                    </div>

                    {/* Google Business */}
                    <div className="flex items-center gap-2">
                      {intake.rawPayload.googleBusiness ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Ban className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={intake.rawPayload.googleBusiness ? "text-gray-200" : "text-gray-600"}>
                        Google Business
                      </span>
                    </div>

                    {/* QuickBooks */}
                    <div className="flex items-center gap-2">
                      {intake.rawPayload.quickBooksSync ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Ban className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={intake.rawPayload.quickBooksSync ? "text-gray-200" : "text-gray-600"}>
                        QuickBooks Sync
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Setup Pricing</h4>
                  <div className="space-y-2">
                    {/* Setup Line Items */}
                    {(intake.rawPayload.pricingSnapshot as any).setupLineItems?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-400">{item.label}</span>
                        <span className="text-gray-200">
                          ${(item.amountCents / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {/* Bundle Discount */}
                    {(intake.rawPayload.pricingSnapshot as any).setupDiscountCents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-400">Bundle Discount (50% off Social)</span>
                        <span className="text-green-400">
                           ${((intake.rawPayload.pricingSnapshot as any).setupDiscountCents / 100).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Founder Override */}
                    {(intake.rawPayload.pricingSnapshot as any).isFounder && (
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-400">🎉 Beta Founder Override</span>
                        <span className="text-purple-400">$300 flat</span>
                      </div>
                    )}

                    {/* Subtotal */}
                    {(intake.rawPayload.pricingSnapshot as any).setupSubtotalCents && (
                      <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                        <span className="text-gray-400">Subtotal</span>
                        <span className="text-gray-200">
                          ${((intake.rawPayload.pricingSnapshot as any).setupSubtotalCents / 100).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between text-base font-semibold pt-2 border-t border-white/10">
                      <span className="text-gray-200">Setup Total Charged</span>
                      <span className="text-[#FF6A00]">
                        ${((intake.rawPayload.pricingSnapshot as any).setupTotalCents / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Monthly Pricing */}
                {(intake.rawPayload.pricingSnapshot as any).monthlyLineItems?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Monthly Recurring (Not Yet Charged)</h4>
                    <div className="space-y-2">
                      {(intake.rawPayload.pricingSnapshot as any).monthlyLineItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-400">{item.label}</span>
                          <span className="text-gray-200">
                            ${(item.amountCents / 100).toFixed(2)}/mo
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-base font-semibold pt-2 border-t border-white/10">
                        <span className="text-gray-200">Monthly Total</span>
                        <span className="text-[#FF6A00]">
                          ${((intake.rawPayload.pricingSnapshot as any).monthlyTotalCents / 100).toFixed(2)}/mo
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-gray-500 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>
                      Priced at {new Date((intake.rawPayload.pricingSnapshot as any).timestamp).toLocaleString()}
                    </span>
                  </div>
                  {(intake.rawPayload.pricingSnapshot as any).promoCode && (
                    <div className="flex items-center gap-2 mt-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Promo: {(intake.rawPayload.pricingSnapshot as any).promoCode}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {buildPlan && (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    {buildPlan.status === "draft" && "Review the build plan and approve when ready."}
                    {buildPlan.status === "approved" && "Build plan approved. Ready to deploy."}
                    {buildPlan.status === "deployed" && "Website is live and accessible."}
                  </div>
                  <div className="flex gap-2">
                    {/* Hold Build Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                          onClick={() => setShowHoldModal(true)}
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          Hold Build
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Use if the intake is invalid or spam.</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Request Clarification Button */}
                    <Button 
                      variant="outline"
                      className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10"
                      onClick={() => setShowClarifyModal(true)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Request Clarification
                    </Button>

                    {/* Approve & Deploy Button */}
                    {buildPlan.status === "draft" && (
                      <Button 
                        onClick={handleApproveBuildPlan}
                        disabled={approveBuildPlanMutation.isPending || needsClarification}
                        className="bg-green-600 hover:bg-green-600/90"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {approveBuildPlanMutation.isPending ? "Approving..." : "Approve"}
                      </Button>
                    )}
                    {buildPlan.status === "approved" && (
                      <Button 
                        onClick={() => setShowDeployModal(true)}
                        disabled={startDeployMutation.isPending}
                        className="bg-green-600 hover:bg-green-600/90"
                      >
                        <Rocket className="w-4 h-4 mr-2" />
                        Approve & Deploy
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Requests Card */}
          <ActionRequestsCard intakeId={intakeId} />

          {/* Internal Notes Section */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#FF6A00]" />
                Internal Notes
              </CardTitle>
              <CardDescription>Notes for your team — not visible to the client.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Document edge cases, template gaps, or improvements..."
                className="min-h-24"
              />
              <Button 
                variant="outline" 
                className="mt-3"
                onClick={() => toast.success("Note saved")}
              >
                Save Note
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Deploy Confirmation Modal */}
        <Dialog open={showDeployModal} onOpenChange={setShowDeployModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deploy this website?</DialogTitle>
              <DialogDescription>
                This will publish the site and generate a live URL.
                The client will be notified automatically.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeployModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleDeploy}
                disabled={startDeployMutation.isPending}
                className="bg-green-600 hover:bg-green-600/90"
              >
                <Rocket className="w-4 h-4 mr-2" />
                {startDeployMutation.isPending ? "Deploying..." : "Deploy Website"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clarification Modal */}
        <Dialog open={showClarifyModal} onOpenChange={setShowClarifyModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ask the client a question</DialogTitle>
              <DialogDescription>
                Keep it short. One question works best.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={clarifyQuestion}
              onChange={(e) => setClarifyQuestion(e.target.value)}
              placeholder='Example: "Do you want customers to call you directly or fill out a form?"'
              className="min-h-24"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowClarifyModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateClarify}
                disabled={!clarifyQuestion.trim() || createClarifyMutation.isPending}
                className="bg-[#FF6A00] hover:bg-[#FF6A00]/90"
              >
                <Send className="w-4 h-4 mr-2" />
                {createClarifyMutation.isPending ? "Sending..." : "Send clarification request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hold Build Modal */}
        <Dialog open={showHoldModal} onOpenChange={setShowHoldModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hold this build?</DialogTitle>
              <DialogDescription>
                Use this if the intake appears to be invalid or spam.
                The client will not be notified.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHoldModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleHoldBuild}
                className="bg-red-600 hover:bg-red-600/90"
              >
                <Ban className="w-4 h-4 mr-2" />
                Hold Build
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </DashboardLayout>
  );
}
