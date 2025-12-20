import { useState } from "react";
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
  Sparkles
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { generatePreviewHTML } from "@/lib/previewGenerator";
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

// Status configuration with improved labels
const statusConfig: Record<string, {
  label: string;
  helperText: string;
  color: string;
}> = {
  new: {
    label: "Awaiting Review",
    helperText: "Intake complete. Ready to review.",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  review: {
    label: "In Review",
    helperText: "Build plan being generated.",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  needs_info: {
    label: "Needs Clarification",
    helperText: "Waiting on client response.",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  ready: {
    label: "Ready for Deployment",
    helperText: "Ready to deploy when you are.",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  approved: {
    label: "Deployed",
    helperText: "Website is live and accessible.",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
  draft: {
    label: "Draft",
    helperText: "Build plan in draft state.",
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  },
  deployed: {
    label: "Live",
    helperText: "Website is live and accessible.",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
  },
};

export default function IntakeDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const intakeId = parseInt(params.id || "0");

  const [clarifyQuestion, setClarifyQuestion] = useState("");
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [internalNote, setInternalNote] = useState("");

  const { data: intake, isLoading } = trpc.admin.intakes.detail.useQuery({ id: intakeId });
  const { data: buildPlan, refetch: refetchBuildPlan } = trpc.admin.buildPlan.getByIntake.useQuery({ intakeId });

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
