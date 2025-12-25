import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  ArrowLeft, Building2, Facebook, Calculator, 
  Check, ExternalLink, Copy, RefreshCw, Lock, Unlock,
  ChevronRight, ChevronDown, Loader2, AlertCircle, Info,
  Download, CheckCircle2, Circle, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Platform definitions
const platforms = [
  {
    id: "gbp" as const,
    name: "Google Business Profile",
    icon: Building2,
    color: "bg-blue-500",
    description: "Get found on Google Search and Maps",
  },
  {
    id: "meta" as const,
    name: "Facebook & Instagram",
    icon: Facebook,
    color: "bg-indigo-500",
    description: "Build your social presence",
  },
  {
    id: "qbo" as const,
    name: "QuickBooks Online",
    icon: Calculator,
    color: "bg-green-500",
    description: "Get paid faster with professional invoices",
  },
];

type PlatformId = "gbp" | "meta" | "qbo";

// Confidence badge component
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence >= 0.8 ? "high" : confidence >= 0.5 ? "medium" : "low";
  const colors = {
    high: "bg-green-500/20 text-green-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    low: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[level]}`}>
      {level === "high" ? "High" : level === "medium" ? "Med" : "Low"}
    </span>
  );
}

// Evidence tooltip component
function EvidenceTooltip({ 
  source, 
  evidence, 
  version,
  confidence 
}: { 
  source: string; 
  evidence: string; 
  version: string;
  confidence: number;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="text-zinc-500 hover:text-zinc-300">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-zinc-800 border-zinc-700">
          <div className="space-y-1 text-xs">
            <p><span className="text-zinc-400">Source:</span> {source}</p>
            <p><span className="text-zinc-400">Evidence:</span> {evidence}</p>
            <p><span className="text-zinc-400">Confidence:</span> {Math.round(confidence * 100)}%</p>
            <p className="text-zinc-500">v{version}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Field row component with evidence and lock
interface FieldRowProps {
  fieldKey: string;
  label: string;
  value: any;
  confidence: number;
  source: string;
  evidence: string;
  version: string;
  isLocked: boolean;
  onCopy: (text: string, label: string) => void;
  onToggleLock: (fieldKey: string) => void;
}

function FieldRow({ 
  fieldKey, label, value, confidence, source, evidence, version, isLocked, onCopy, onToggleLock 
}: FieldRowProps) {
  const displayValue = Array.isArray(value) 
    ? value.map(v => typeof v === 'object' ? v.name || JSON.stringify(v) : v).join(", ")
    : typeof value === 'object' 
      ? JSON.stringify(value)
      : String(value || "—");

  return (
    <div className="flex items-start gap-3 py-2 px-3 bg-zinc-800/30 rounded-lg group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
          <ConfidenceBadge confidence={confidence} />
          <EvidenceTooltip source={source} evidence={evidence} version={version} confidence={confidence} />
        </div>
        <p className="text-white text-sm truncate">{displayValue}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={() => onCopy(displayValue, label)}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={() => onToggleLock(fieldKey)}
        >
          {isLocked ? <Lock className="h-3.5 w-3.5 text-orange-400" /> : <Unlock className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// Step component with embedded fields
interface StepProps {
  step: {
    stepId: string;
    title: string;
    description?: string;
    instructions?: string;
    deepLink?: string;
    status: string;
    blockers: Array<{ code: string; message: string; fix?: string }>;
  };
  fields: Record<string, any>;
  onComplete: (stepId: string) => void;
  onCopy: (text: string, label: string) => void;
  onToggleLock: (fieldKey: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function StepItem({ step, fields, onComplete, onCopy, onToggleLock, isExpanded, onToggleExpand }: StepProps) {
  const stepFields = Object.entries(fields).filter(([key]) => key.startsWith(step.stepId.split('.')[0]));
  const hasBlockers = step.blockers && step.blockers.length > 0;
  
  const statusIcon = {
    complete: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    ready: <Circle className="h-5 w-5 text-zinc-500" />,
    blocked: <AlertTriangle className="h-5 w-5 text-red-500" />,
    skipped: <Circle className="h-5 w-5 text-zinc-600" />,
  }[step.status] || <Circle className="h-5 w-5 text-zinc-500" />;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className={`border rounded-lg ${hasBlockers ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-zinc-800/30 transition-colors">
            {statusIcon}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">{step.title}</p>
              {step.description && (
                <p className="text-sm text-zinc-400 truncate">{step.description}</p>
              )}
            </div>
            {hasBlockers && (
              <Badge variant="destructive" className="mr-2">
                {step.blockers.length} blocker{step.blockers.length > 1 ? 's' : ''}
              </Badge>
            )}
            <ChevronDown className={`h-5 w-5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Blockers */}
            {hasBlockers && (
              <div className="space-y-2">
                {step.blockers.map((blocker, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-red-300">{blocker.message}</p>
                      {blocker.fix && (
                        <p className="text-xs text-red-400 mt-1">Fix: {blocker.fix}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Instructions */}
            {step.instructions && (
              <p className="text-sm text-zinc-400">{step.instructions}</p>
            )}

            {/* Deep link */}
            {step.deepLink && (
              <a 
                href={step.deepLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300"
              >
                Open setup page <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {/* Fields for this step */}
            {stepFields.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Prepared Values</p>
                {stepFields.map(([key, field]) => (
                  <FieldRow
                    key={key}
                    fieldKey={key}
                    label={field.label}
                    value={field.value}
                    confidence={field.confidence}
                    source={field.source}
                    evidence={field.evidence}
                    version={field.version}
                    isLocked={field.isLocked}
                    onCopy={onCopy}
                    onToggleLock={onToggleLock}
                  />
                ))}
              </div>
            )}

            {/* Complete button */}
            {step.status !== 'complete' && !hasBlockers && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onComplete(step.stepId)}
                className="mt-2"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Platform checklist component
interface PlatformChecklistProps {
  platform: typeof platforms[0];
  intakeId: number;
  autoMode: boolean;
}

function PlatformChecklist({ platform, intakeId, autoMode }: PlatformChecklistProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const utils = trpc.useUtils();
  
  const { data: checklist, isLoading, refetch } = trpc.setupPackets.getChecklist.useQuery({ 
    intakeId 
  });

  const recomputeMutation = trpc.setupPackets.recompute.useMutation({
    onSuccess: (result) => {
      const { diff } = result;
      let message = [];
      if (diff.updatedFields.length) message.push(`Updated ${diff.updatedFields.length} fields`);
      if (diff.lockedFieldsSkipped.length) message.push(`Skipped ${diff.lockedFieldsSkipped.length} locked`);
      if (diff.blockersAdded.length) message.push(`${diff.blockersAdded.length} new blockers`);
      toast.success(message.join(" • ") || "Already up to date");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const completeStepMutation = trpc.setupPackets.completeStep.useMutation({
    onSuccess: () => {
      toast.success("Step marked complete");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const lockFieldMutation = trpc.setupPackets.lockField.useMutation({
    onSuccess: () => refetch(),
    onError: (error) => toast.error(error.message),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const copyAllFields = () => {
    if (!checklist?.fields) return;
    const text = Object.entries(checklist.fields)
      .filter(([key]) => key.startsWith(platform.id))
      .map(([_, field]: [string, any]) => `${field.label}: ${field.value}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("All fields copied to clipboard");
  };

  const toggleStepExpand = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const handleToggleLock = (fieldKey: string) => {
    const field = checklist?.fields[fieldKey];
    if (!field) return;
    lockFieldMutation.mutate({
      intakeId,
      fieldKey,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">No checklist data available</p>
      </div>
    );
  }

  const platformSteps = checklist.steps.filter((s: any) => s.stepId.startsWith(platform.id));
  const completedSteps = platformSteps.filter((s: any) => s.status === 'complete').length;
  const progress = platformSteps.length > 0 ? (completedSteps / platformSteps.length) * 100 : 0;
  const blockedStep = platformSteps.find((s: any) => s.blockers?.length > 0);
  const topBlocker = blockedStep?.blockers?.[0];

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${platform.color} flex items-center justify-center`}>
            <platform.icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{platform.name}</h3>
            <p className="text-sm text-zinc-400">{completedSteps} of {platformSteps.length} steps complete</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => recomputeMutation.mutate({ intakeId })}
            disabled={recomputeMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recomputeMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={copyAllFields}>
            <Copy className="h-4 w-4 mr-2" />
            Copy All
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        {topBlocker && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" />
            {topBlocker.message} — <span className="text-red-300">{topBlocker.fix || "Fix to continue"}</span>
          </div>
        )}
      </div>

      {/* Auto mode banner */}
      {autoMode && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
          <p className="text-sm text-orange-300">
            <span className="font-medium">Auto mode:</span> LaunchBase prepares everything automatically. 
            Lock any field to prevent updates.
          </p>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {platformSteps.map((step: any) => (
          <StepItem
            key={step.stepId}
            step={step}
            fields={checklist.fields}
            onComplete={(stepId) => completeStepMutation.mutate({ intakeId, stepId })}
            onCopy={copyToClipboard}
            onToggleLock={handleToggleLock}
            isExpanded={expandedSteps.has(step.stepId)}
            onToggleExpand={() => toggleStepExpand(step.stepId)}
          />
        ))}
      </div>
    </div>
  );
}

// Main page component
export default function Integrations() {
  const [, setLocation] = useLocation();
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | null>(null);
  const [autoMode, setAutoMode] = useState(true);
  
  // For demo, using a fixed intake ID - in production this would come from auth context
  const intakeId = 120001;
  
  // Get summary data for all platforms
  const { data: summaryData, isLoading: summaryLoading } = trpc.setupPackets.getChecklist.useQuery({ 
    intakeId
  });

  const getPlatformSummary = (platformId: PlatformId) => {
    // In production, you'd fetch this per platform
    return {
      status: "ready" as "ready" | "in_progress" | "connected" | "blocked",
      completedSteps: 0,
      totalSteps: 6,
      topBlocker: null as { message: string; fix?: string } | null,
    };
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/expand")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">Setup & Integrations</h1>
                <p className="text-sm text-zinc-400">Everything prepared for your business tools</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">Auto mode</span>
              <Switch checked={autoMode} onCheckedChange={setAutoMode} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Philosophy Banner */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
          <p className="text-zinc-300 text-center">
            {autoMode ? (
              <>
                <span className="text-orange-400 font-medium">LaunchBase prepares everything automatically.</span>{" "}
                Lock any field to prevent updates. Nothing public or financial happens without your approval.
              </>
            ) : (
              <>
                <span className="text-orange-400 font-medium">Manual mode:</span>{" "}
                Review each field before applying. Switch to Auto for hands-free setup.
              </>
            )}
          </p>
        </div>

        {selectedPlatform ? (
          /* Platform detail view */
          <div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedPlatform(null)}
              className="mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              All Integrations
            </Button>
            <PlatformChecklist 
              platform={platforms.find(p => p.id === selectedPlatform)!}
              intakeId={intakeId}
              autoMode={autoMode}
            />
          </div>
        ) : (
          /* Platform cards grid */
          <div className="grid md:grid-cols-3 gap-6">
            {platforms.map((platform) => {
              const summary = getPlatformSummary(platform.id);
              const Icon = platform.icon;
              const progress = summary.totalSteps > 0 
                ? (summary.completedSteps / summary.totalSteps) * 100 
                : 0;
              
              return (
                <Card 
                  key={platform.id}
                  className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                  onClick={() => setSelectedPlatform(platform.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-xl ${platform.color} flex items-center justify-center`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <Badge 
                        variant={summary.status === "ready" ? "default" : summary.status === "connected" ? "default" : "secondary"}
                        className={summary.status === "connected" ? "bg-green-500/20 text-green-400" : ""}
                      >
                        {summary.status === "ready" && "Ready"}
                        {summary.status === "in_progress" && "In Progress"}
                        {summary.status === "connected" && "Connected"}
                        {summary.status === "blocked" && "Needs Attention"}
                      </Badge>
                    </div>
                    <CardTitle className="text-white mt-4">{platform.name}</CardTitle>
                    <CardDescription className="text-zinc-400">
                      {platform.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Progress */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">{summary.completedSteps} of {summary.totalSteps} steps</span>
                        <span className="text-zinc-400">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>

                    {/* Top blocker */}
                    {summary.topBlocker && (
                      <div className="flex items-center gap-2 text-sm text-red-400 mb-4">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{summary.topBlocker.message}</span>
                      </div>
                    )}

                    {/* CTA */}
                    <Button 
                      className="w-full bg-orange-500 hover:bg-orange-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlatform(platform.id);
                      }}
                    >
                      {summary.topBlocker ? "Fix to continue" : 
                       summary.completedSteps === 0 ? "Start setup" :
                       summary.completedSteps === summary.totalSteps ? "View details" :
                       "Continue"}
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
