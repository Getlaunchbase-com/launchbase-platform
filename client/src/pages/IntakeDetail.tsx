import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Copy
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  needs_info: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  approved: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  deployed: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function IntakeDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const intakeId = parseInt(params.id || "0");

  const [clarifyQuestion, setClarifyQuestion] = useState("");
  const [showClarifyForm, setShowClarifyForm] = useState(false);

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
      toast.success("Build plan approved!");
    },
  });

  const startDeployMutation = trpc.admin.deploy.start.useMutation({
    onSuccess: (data) => {
      if (data.deploymentId) {
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
        toast.success("Clarification link copied to clipboard!");
        setShowClarifyForm(false);
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
              <h1 className="text-2xl font-bold">{intake.businessName}</h1>
              <p className="text-gray-400">{intake.contactName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${statusColors[intake.status]} capitalize`}>
              {intake.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {intake.vertical}
            </Badge>
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

          {/* Build Plan */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-[#FF6A00]" />
                  Build Plan
                </span>
                {buildPlan && (
                  <Badge className={`${statusColors[buildPlan.status]} capitalize`}>
                    {buildPlan.status}
                  </Badge>
                )}
              </CardTitle>
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
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Template</p>
                    <Badge variant="outline">{buildPlan.templateId}</Badge>
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
                      
                      <div>
                        <p className="text-sm text-gray-400 mb-2">CTA</p>
                        <Badge className="bg-[#FF6A00]/20 text-[#FF6A00]">
                          {buildPlan.plan.copy.ctaText}
                        </Badge>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 pt-4">
                    {buildPlan.status === "draft" && (
                      <Button 
                        onClick={handleApproveBuildPlan}
                        disabled={approveBuildPlanMutation.isPending}
                        className="bg-[#1ED760] hover:bg-[#1ED760]/90"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {approveBuildPlanMutation.isPending ? "Approving..." : "Approve"}
                      </Button>
                    )}
                    {buildPlan.status === "approved" && (
                      <Button 
                        onClick={handleDeploy}
                        disabled={startDeployMutation.isPending}
                        className="bg-[#FF6A00] hover:bg-[#FF6A00]/90"
                      >
                        <Rocket className="w-4 h-4 mr-2" />
                        {startDeployMutation.isPending ? "Starting..." : "Deploy"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Clarification Section */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#FF6A00]" />
              Request Clarification
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showClarifyForm ? (
              <div className="space-y-4">
                <Textarea
                  value={clarifyQuestion}
                  onChange={(e) => setClarifyQuestion(e.target.value)}
                  placeholder="What information do you need from the customer?"
                  className="min-h-24"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCreateClarify}
                    disabled={!clarifyQuestion.trim() || createClarifyMutation.isPending}
                    className="bg-[#FF6A00] hover:bg-[#FF6A00]/90"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {createClarifyMutation.isPending ? "Creating..." : "Create Link"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowClarifyForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => setShowClarifyForm(true)}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Request More Information
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
