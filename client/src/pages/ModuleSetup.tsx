import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  Circle,
  ChevronRight,
  Zap,
  FileText,
  Globe,
  Clock,
  ArrowRight,
  Sparkles,
  Lock
} from "lucide-react";

// Module configurations
const modules = [
  {
    key: "social_media_intelligence",
    name: "Social Media Intelligence",
    tagline: "Automated posts that feel human, timed to what matters locally.",
    icon: Zap,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    setupFee: 249,
    monthlyFee: "$79-199/mo",
    steps: [
      {
        key: "connect_facebook",
        title: "Connect Your Facebook Page",
        description: "Link your business Facebook Page so we can post on your behalf.",
        customerAction: "Click 'Connect Facebook' and authorize LaunchBase.",
        estimatedMinutes: 2,
        completed: true,
      },
      {
        key: "set_preferences",
        title: "Set Posting Preferences",
        description: "Tell us when you want posts to go out and how often.",
        customerAction: "Choose your preferred posting times and quiet hours.",
        estimatedMinutes: 3,
        completed: true,
      },
      {
        key: "review_first_post",
        title: "Review Your First Scheduled Post",
        description: "See how we write posts for your business before anything goes live.",
        customerAction: "Review the sample post and approve, edit, or request changes.",
        estimatedMinutes: 5,
        completed: false,
      },
    ],
  },
  {
    key: "quickbooks_sync",
    name: "QuickBooks Sync",
    tagline: "Quotes → Invoices → Payments → Tax records. Almost no admin.",
    icon: FileText,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    setupFee: 499,
    monthlyFee: "$79/mo",
    steps: [
      {
        key: "connect_quickbooks",
        title: "Connect QuickBooks Online",
        description: "Link your QuickBooks account so we can sync customers and invoices.",
        customerAction: "Click 'Connect QuickBooks' and sign in to authorize.",
        estimatedMinutes: 3,
        completed: false,
      },
      {
        key: "map_accounts",
        title: "Map Your Chart of Accounts",
        description: "Tell us which accounts to use for income, expenses, and services.",
        customerAction: "Review our suggested mappings and adjust if needed.",
        estimatedMinutes: 5,
        completed: false,
      },
      {
        key: "import_customers",
        title: "Import Existing Customers",
        description: "Bring in your current customer list so everything is in sync.",
        customerAction: "Confirm which customers to import (or import all).",
        estimatedMinutes: 2,
        completed: false,
        optional: true,
      },
      {
        key: "setup_invoice_template",
        title: "Set Up Invoice Template",
        description: "Customize how your invoices look when sent to customers.",
        customerAction: "Choose your payment terms and review the invoice preview.",
        estimatedMinutes: 5,
        completed: false,
      },
    ],
  },
  {
    key: "google_business",
    name: "Google Business Assistant",
    tagline: "Reviews answered. Listings optimized. Local SEO handled.",
    icon: Globe,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    setupFee: 249,
    monthlyFee: "$49/mo",
    steps: [
      {
        key: "connect_google",
        title: "Connect Google Business Profile",
        description: "Link your Google Business Profile so we can manage reviews and listings.",
        customerAction: "Click 'Connect Google' and authorize LaunchBase.",
        estimatedMinutes: 3,
        completed: false,
      },
      {
        key: "set_review_preferences",
        title: "Set Review Response Preferences",
        description: "Tell us how you want to handle customer reviews.",
        customerAction: "Choose your response style and approval mode.",
        estimatedMinutes: 3,
        completed: false,
      },
      {
        key: "verify_listing",
        title: "Verify & Optimize Listing",
        description: "Make sure your Google listing is complete and optimized for local search.",
        customerAction: "Review our optimization suggestions and approve changes.",
        estimatedMinutes: 5,
        completed: false,
      },
    ],
  },
];

export default function ModuleSetup() {
  const [expandedModule, setExpandedModule] = useState<string | null>("social_media_intelligence");

  const getCompletedSteps = (steps: typeof modules[0]["steps"]) => {
    return steps.filter(s => s.completed).length;
  };

  const getProgress = (steps: typeof modules[0]["steps"]) => {
    const completed = getCompletedSteps(steps);
    return Math.round((completed / steps.length) * 100);
  };

  const getTotalEstimatedTime = (steps: typeof modules[0]["steps"]) => {
    return steps.filter(s => !s.completed).reduce((acc, s) => acc + s.estimatedMinutes, 0);
  };

  const getNextStep = (steps: typeof modules[0]["steps"]) => {
    return steps.find(s => !s.completed);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0C]">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-[#0B0B0C]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-semibold text-white">Module Setup</h1>
          <p className="text-zinc-400 text-sm mt-1">Complete the setup steps to activate your modules</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {modules.map((module) => {
          const Icon = module.icon;
          const progress = getProgress(module.steps);
          const completedSteps = getCompletedSteps(module.steps);
          const totalSteps = module.steps.length;
          const remainingTime = getTotalEstimatedTime(module.steps);
          const nextStep = getNextStep(module.steps);
          const isExpanded = expandedModule === module.key;
          const isComplete = progress === 100;

          return (
            <Card 
              key={module.key}
              className={`bg-zinc-900/50 border transition-all ${
                isComplete ? "border-green-500/30" : module.borderColor
              }`}
            >
              <CardHeader 
                className="cursor-pointer"
                onClick={() => setExpandedModule(isExpanded ? null : module.key)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${module.bgColor}`}>
                      <Icon className={`w-6 h-6 ${module.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        {module.name}
                        {isComplete && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-zinc-400 mt-1">
                        {module.tagline}
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </div>

                {/* Progress Bar */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">
                      {completedSteps} of {totalSteps} steps completed
                    </span>
                    <span className={`font-medium ${isComplete ? "text-green-400" : module.color}`}>
                      {progress}%
                    </span>
                  </div>
                  <Progress 
                    value={progress} 
                    className="h-2 bg-zinc-800"
                  />
                  {!isComplete && remainingTime > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      ~{remainingTime} min remaining
                    </div>
                  )}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <Separator className="bg-zinc-800 mb-4" />
                  
                  {/* Steps List */}
                  <div className="space-y-3">
                    {module.steps.map((step, index) => (
                      <div 
                        key={step.key}
                        className={`p-4 rounded-lg border transition-all ${
                          step.completed 
                            ? "bg-green-500/5 border-green-500/20" 
                            : nextStep?.key === step.key
                              ? `${module.bgColor} ${module.borderColor}`
                              : "bg-zinc-800/30 border-zinc-700/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {step.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            ) : nextStep?.key === step.key ? (
                              <Circle className={`w-5 h-5 ${module.color}`} />
                            ) : (
                              <Circle className="w-5 h-5 text-zinc-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className={`font-medium ${step.completed ? "text-green-400" : "text-white"}`}>
                                {step.title}
                              </h4>
                              {step.optional && (
                                <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                                  Optional
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-zinc-400 mt-1">{step.description}</p>
                            
                            {!step.completed && (
                              <div className="mt-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">What you need to do</p>
                                <p className="text-sm text-zinc-300">{step.customerAction}</p>
                                <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                                  <Clock className="w-3 h-3" />
                                  ~{step.estimatedMinutes} min
                                </div>
                              </div>
                            )}

                            {!step.completed && nextStep?.key === step.key && (
                              <Button 
                                className={`mt-3 ${
                                  module.key === "social_media_intelligence" 
                                    ? "bg-[#FF6A00] hover:bg-[#FF6A00]/90" 
                                    : module.key === "quickbooks_sync"
                                      ? "bg-green-600 hover:bg-green-600/90"
                                      : "bg-blue-600 hover:bg-blue-600/90"
                                }`}
                                size="sm"
                              >
                                Start This Step
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Module Info Footer */}
                  <div className="mt-4 p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-zinc-400">Pricing</p>
                        <p className="text-white font-medium">
                          {module.monthlyFee}
                          <span className="text-zinc-500 font-normal"> + ${module.setupFee} setup</span>
                        </p>
                      </div>
                      {isComplete ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-zinc-600 text-zinc-400">
                          <Lock className="w-3 h-3 mr-1" />
                          Complete setup to activate
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* What We Already Know */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-400">What We Already Know (From Your Intake)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Business Name", value: "Vince's Snow Plow" },
                { label: "Services", value: "Snow Removal" },
                { label: "Location", value: "Chicago, IL" },
                { label: "Brand Voice", value: "Friendly, Professional" },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-lg bg-zinc-800/30">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm text-white mt-1">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              We use this information across all modules. You only need to provide additional details specific to each module.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
