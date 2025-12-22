import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Cloud, Trophy, School, TrendingUp, BookOpen, Megaphone, Check, Info, Calendar, Zap, Shield, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Depth level descriptions
const depthDescriptions = {
  low: {
    title: "Quiet and conservative",
    description: "LaunchBase posts only when information is critical.",
    cadence: "1–2 posts per week",
    price: 7900,
  },
  medium: {
    title: "Balanced visibility",
    description: "LaunchBase posts when it meaningfully improves your customers' day — staying visible without being noisy.",
    cadence: "2–3 posts per week",
    price: 12900,
  },
  high: {
    title: "Proactive and timely",
    description: "LaunchBase responds to weather, events, and local activity with increased frequency.",
    cadence: "4–6 posts per week",
    price: 19900,
  },
};

// Mode descriptions
const modeDescriptions = {
  auto: {
    title: "Auto",
    subtitle: "Recommended",
    description: "We choose what matters locally. You approve before anything posts.",
  },
  guided: {
    title: "Guided",
    subtitle: "",
    description: "We recommend the best setup. You fine-tune with simple toggles.",
  },
  custom: {
    title: "Custom",
    subtitle: "",
    description: "Full control. Built-in guardrails prevent spam and bad timing.",
  },
};

// Context layer definitions
const contextLayers = [
  {
    id: "weather",
    icon: Cloud,
    title: "Weather Awareness",
    status: "always_active",
    statusLabel: "Always Active",
    description: "Keeps posts accurate and avoids outdoor recommendations during bad conditions.",
    fullDescription: "LaunchBase monitors local weather and safety conditions to communicate clearly when it matters.",
    price: 0,
    locked: true,
  },
  {
    id: "sports",
    icon: Trophy,
    title: "Sports & Entertainment",
    status: "recommended",
    statusLabel: "Recommended",
    description: "Game days change traffic, demand, and attention.",
    fullDescription: "Useful for businesses affected by traffic, crowds, or viewing behavior.",
    includedIn: "Included in Medium coverage",
    price: 2900,
    locked: false,
  },
  {
    id: "community",
    icon: School,
    title: "Community & Schools",
    status: "optional",
    statusLabel: "Optional",
    description: "Local life drives local engagement (schools, colleges, community schedules).",
    fullDescription: "Aligns posts with school schedules, local events, and community rhythms.",
    price: 3900,
    locked: false,
  },
  {
    id: "trends",
    icon: TrendingUp,
    title: "Local Trends",
    status: "advanced",
    statusLabel: "Advanced",
    description: "Mentions what's actually trending—only when confirmed and safe.",
    fullDescription: "Detects what people are talking about locally and uses it only when appropriate.",
    warning: "Used sparingly. Never forced.",
    price: 4900,
    locked: false,
  },
];

// Module definitions
const modules = [
  {
    id: "quickbooks",
    icon: BookOpen,
    title: "QuickBooks Sync",
    status: "available",
    description: "Keep invoices, customers, and payments automatically in sync.",
    bullets: ["Auto-sync new customers", "Invoice tracking", "Payment reconciliation"],
    setupPrice: 24900,
    monthlyPrice: 7900,
  },
  {
    id: "google",
    icon: Megaphone,
    title: "Google Business Assistant",
    status: "coming_soon",
    description: "Responds to reviews, updates listings, and posts when visibility matters.",
    bullets: ["Review responses", "Listing updates", "Local SEO"],
    setupPrice: 0,
    monthlyPrice: 0,
  },
];

export default function ExpandLaunchBase() {
  const [depthLevel, setDepthLevel] = useState<"low" | "medium" | "high">("medium");
  const [tuningMode, setTuningMode] = useState<"auto" | "guided" | "custom">("auto");
  const [enabledLayers, setEnabledLayers] = useState<string[]>(["weather", "sports"]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSampleWeek, setShowSampleWeek] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Get current configuration
  const { data: config, isLoading } = trpc.intelligenceLayers.getConfig.useQuery();
  const saveMutation = trpc.intelligenceLayers.saveConfig.useMutation();
  const { data: samplePosts } = trpc.intelligenceLayers.getSampleWeek.useQuery({
    depthLevel,
    sportsEnabled: enabledLayers.includes("sports"),
    communityEnabled: enabledLayers.includes("community"),
    trendsEnabled: enabledLayers.includes("trends"),
  });

  // Initialize state from server
  useEffect(() => {
    if (config) {
      setDepthLevel(config.depthLevel as "low" | "medium" | "high");
      setTuningMode((config.tuningMode as "auto" | "guided" | "custom") || "auto");
      const layers = ["weather"];
      if (config.sportsEnabled) layers.push("sports");
      if (config.communityEnabled) layers.push("community");
      if (config.trendsEnabled) layers.push("trends");
      setEnabledLayers(layers);
    }
  }, [config]);

  // Calculate total monthly price
  const calculateMonthlyPrice = () => {
    let total = depthDescriptions[depthLevel].price;
    if (depthLevel === "low" && enabledLayers.includes("sports")) total += 2900;
    if (enabledLayers.includes("community")) total += 3900;
    if (enabledLayers.includes("trends")) total += 4900;
    return total;
  };

  // Calculate setup fee
  const calculateSetupFee = () => {
    let total = 24900; // Base setup
    if (enabledLayers.includes("community")) total += 9900;
    if (enabledLayers.includes("trends")) total += 19900;
    return total;
  };

  // Handle depth slider change
  const handleDepthChange = (value: number[]) => {
    const levels: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
    setDepthLevel(levels[value[0]]);
    setHasChanges(true);
  };

  // Toggle a layer
  const toggleLayer = (layerId: string) => {
    if (layerId === "weather") return;
    if (enabledLayers.includes(layerId)) {
      setEnabledLayers(enabledLayers.filter(l => l !== layerId));
    } else {
      setEnabledLayers([...enabledLayers, layerId]);
    }
    setHasChanges(true);
  };

  // Save configuration
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync({
        depthLevel,
        tuningMode,
        sportsEnabled: enabledLayers.includes("sports"),
        communityEnabled: enabledLayers.includes("community"),
        trendsEnabled: enabledLayers.includes("trends"),
      });
      toast.success("Configuration saved. Changes take effect immediately.");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  // Format price
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  // Get slider value from depth level
  const getSliderValue = () => {
    const levels = { low: 0, medium: 1, high: 2 };
    return [levels[depthLevel]];
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "always_active": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "recommended": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "optional": return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
      case "advanced": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default: return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0C]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#111113]/95 backdrop-blur-sm">
        <div className="max-w-[1120px] mx-auto px-5 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Link>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !hasChanges}
              className={`transition-all ${hasChanges ? "bg-[#FF6A00] hover:bg-[#FF6A00]/90" : "bg-zinc-700"} text-white`}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <main className="max-w-[1120px] mx-auto px-5 md:px-8 py-8">
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
          {/* Left Column - Configuration */}
          <div className="space-y-8">
            {/* Page Title */}
            <div>
              <h1 className="text-[28px] font-semibold text-white leading-tight">
                Expand LaunchBase
              </h1>
              <p className="text-[15px] text-[#B7B7BD] mt-2 leading-relaxed">
                Add workflows that give you back your life. Turn anything on or off anytime.
              </p>
            </div>

            {/* ZONE 1: Current State (Read-Only) */}
            <Card className="bg-[#151518] border-white/[0.04] rounded-[14px]">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <h2 className="text-[18px] font-semibold text-white">Your LaunchBase is active</h2>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-[10px] ml-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Silence is valid
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      <p className="text-xs">We'd rather post nothing than post something irrelevant.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] font-medium text-[#8B8B92] uppercase tracking-wide mb-1">Visibility</p>
                    <p className="text-[14px] text-white capitalize">{depthLevel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#8B8B92] uppercase tracking-wide mb-1">Cadence</p>
                    <p className="text-[14px] text-white">{depthDescriptions[depthLevel].cadence}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#8B8B92] uppercase tracking-wide mb-1">Approval</p>
                    <p className="text-[14px] text-white">Enabled</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#8B8B92] uppercase tracking-wide mb-1">Monitoring</p>
                    <p className="text-[14px] text-white">Weather, Events, Time</p>
                  </div>
                </div>

                <p className="text-[13px] text-[#8B8B92] mt-5 leading-relaxed border-t border-white/[0.04] pt-4">
                  LaunchBase is monitoring what matters in your area. You don't need to do anything right now.
                </p>
              </CardContent>
            </Card>

            {/* Social Media Intelligence Module */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#FF6A00]/10">
                  <Zap className="w-5 h-5 text-[#FF6A00]" />
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-white">Social Media Intelligence</h2>
                  <p className="text-[13px] text-[#B7B7BD]">Your business stays visible—without you thinking about it.</p>
                </div>
              </div>

              {/* Mode Selector */}
              <Card className="bg-[#151518] border-white/[0.08] rounded-[14px]">
                <CardContent className="p-5">
                  <p className="text-[13px] text-[#8B8B92] mb-4">How much control do you want?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["auto", "guided", "custom"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => { setTuningMode(mode); setHasChanges(true); }}
                        className={`p-3 rounded-lg border transition-all text-left ${
                          tuningMode === mode 
                            ? "bg-[#FF6A00]/10 border-[#FF6A00]/30 text-white" 
                            : "bg-transparent border-white/[0.08] text-[#B7B7BD] hover:border-white/[0.15]"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-medium capitalize">{modeDescriptions[mode].title}</span>
                          {modeDescriptions[mode].subtitle && (
                            <Badge variant="outline" className="text-[9px] bg-[#FF6A00]/10 text-[#FF6A00] border-[#FF6A00]/20">
                              {modeDescriptions[mode].subtitle}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8B8B92] leading-relaxed">
                          {modeDescriptions[mode].description}
                        </p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* ZONE 2: Visibility Control */}
              <Card className="bg-[#151518] border-white/[0.08] rounded-[14px]">
                <CardContent className="p-6">
                  <h3 className="text-[16px] font-semibold text-white mb-2">
                    How visible should your business be?
                  </h3>
                  <p className="text-[14px] text-[#B7B7BD] mb-6 leading-relaxed">
                    Adjust how proactive LaunchBase should be.
                  </p>

                  {/* Slider */}
                  <div className="mb-6">
                    <div className="flex justify-between mb-3">
                      {(["low", "medium", "high"] as const).map((level) => (
                        <span 
                          key={level}
                          className={`text-[12px] font-medium uppercase ${
                            depthLevel === level ? "text-[#FF6A00]" : "text-[#8B8B92]"
                          }`}
                        >
                          {level}
                        </span>
                      ))}
                    </div>
                    <Slider
                      value={getSliderValue()}
                      onValueChange={handleDepthChange}
                      max={2}
                      step={1}
                      className="[&_[role=slider]]:bg-[#FF6A00] [&_[role=slider]]:border-0 [&_[role=slider]]:w-[18px] [&_[role=slider]]:h-[18px] [&_.bg-primary]:bg-[#FF6A00]"
                    />
                  </div>

                  {/* Description Panel */}
                  <div className="bg-[#111113] rounded-lg p-4 border border-white/[0.04]">
                    <h4 className="text-[14px] font-medium text-white mb-1">
                      {depthDescriptions[depthLevel].title}
                    </h4>
                    <p className="text-[13px] text-[#B7B7BD] leading-relaxed">
                      {depthDescriptions[depthLevel].description}
                    </p>
                  </div>

                  <p className="text-[12px] text-[#8B8B92] mt-4 text-center">
                    You can always scale up or down. <span className="text-white/60">Silence is a valid choice.</span>
                  </p>
                </CardContent>
              </Card>

              {/* ZONE 3: Context Layers */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[16px] font-semibold text-white">Context Layers</h3>
                    <p className="text-[13px] text-[#B7B7BD]">Signals LaunchBase pays attention to so you don't have to.</p>
                  </div>
                  <Dialog open={showSampleWeek} onOpenChange={setShowSampleWeek}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="border-white/10 text-[#B7B7BD] hover:bg-white/5">
                        <Play className="w-3 h-3 mr-2" />
                        Preview sample week
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#151518] border-white/[0.08] max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-white">Sample Week Preview</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 mt-4">
                        {samplePosts?.map((post) => (
                          <div key={post.id} className="bg-[#111113] rounded-lg p-4 border border-white/[0.04]">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-[10px] capitalize bg-[#FF6A00]/10 text-[#FF6A00] border-[#FF6A00]/20">
                                {post.type}
                              </Badge>
                              <span className="text-[11px] text-[#8B8B92]">{post.day} · {post.time}</span>
                            </div>
                            <p className="text-[13px] text-white leading-relaxed">{post.content}</p>
                            <p className="text-[11px] text-[#8B8B92] mt-2">Trigger: {post.trigger}</p>
                          </div>
                        ))}
                        {(!samplePosts || samplePosts.length === 0) && (
                          <p className="text-[13px] text-[#8B8B92] text-center py-4">
                            No sample posts for this configuration.
                          </p>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {contextLayers.map((layer) => {
                    const Icon = layer.icon;
                    const isEnabled = enabledLayers.includes(layer.id);
                    const isIncluded = layer.id === "sports" && (depthLevel === "medium" || depthLevel === "high");
                    
                    return (
                      <Card 
                        key={layer.id}
                        className={`bg-[#151518] border-white/[0.08] rounded-[12px] transition-all ${
                          !layer.locked && "hover:border-white/[0.12] cursor-pointer"
                        } ${isEnabled && !layer.locked ? "border-[#FF6A00]/20" : ""}`}
                        onClick={() => !layer.locked && toggleLayer(layer.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isEnabled ? "bg-[#FF6A00]/10" : "bg-white/5"}`}>
                              <Icon className={`w-4 h-4 ${isEnabled ? "text-[#FF6A00]" : "text-[#8B8B92]"}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-[14px] font-medium text-white">{layer.title}</h4>
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] font-medium px-1.5 py-0 ${getStatusColor(layer.status)}`}
                                >
                                  {layer.status === "always_active" && (
                                    <span className="w-1 h-1 rounded-full bg-emerald-400 mr-1"></span>
                                  )}
                                  {layer.statusLabel}
                                </Badge>
                              </div>
                              <p className="text-[12px] text-[#8B8B92] mt-0.5">{layer.description}</p>
                              {layer.warning && (
                                <p className="text-[11px] text-[#8B8B92] italic mt-1">{layer.warning}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              {!layer.locked && !isIncluded && layer.price > 0 && (
                                <span className="text-[12px] text-[#8B8B92]">{formatPrice(layer.price)}/mo</span>
                              )}
                              {isIncluded && (
                                <span className="text-[11px] text-emerald-400">Included</span>
                              )}
                              
                              {layer.locked ? (
                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                  <Check className="w-3 h-3 text-emerald-400" />
                                </div>
                              ) : (
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  isEnabled ? "bg-[#FF6A00] border-[#FF6A00]" : "border-white/20 bg-transparent"
                                }`}>
                                  {isEnabled && <Check className="w-3 h-3 text-white" />}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <p className="text-[12px] text-[#8B8B92] mt-4 text-center">
                  LaunchBase never posts just to stay active. <span className="text-white/60">Silence is a valid outcome.</span>
                </p>
              </div>
            </div>

            {/* ZONE 4: Expand LaunchBase (Modules) */}
            <div>
              <h2 className="text-[18px] font-semibold text-white mb-2">Expand LaunchBase</h2>
              <p className="text-[13px] text-[#B7B7BD] mb-4">Add workflows as your business grows.</p>

              <div className="space-y-3">
                {modules.map((module) => {
                  const Icon = module.icon;
                  const isComingSoon = module.status === "coming_soon";
                  
                  return (
                    <Card key={module.id} className="bg-[#151518] border-white/[0.08] rounded-[12px]">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${isComingSoon ? "bg-white/5" : "bg-[#FF6A00]/10"}`}>
                            <Icon className={`w-4 h-4 ${isComingSoon ? "text-[#8B8B92]" : "text-[#FF6A00]"}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-[14px] font-medium text-white">{module.title}</h4>
                              {isComingSoon && (
                                <Badge variant="outline" className="text-[10px] bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
                                  Coming Soon
                                </Badge>
                              )}
                            </div>
                            <p className="text-[12px] text-[#B7B7BD]">{module.description}</p>
                            {!isComingSoon && (
                              <p className="text-[11px] text-[#8B8B92] mt-1">
                                Setup: {formatPrice(module.setupPrice)} · Monthly: {formatPrice(module.monthlyPrice)}
                              </p>
                            )}
                          </div>

                          <Button
                            variant={isComingSoon ? "outline" : "default"}
                            size="sm"
                            className={isComingSoon 
                              ? "border-white/10 text-[#B7B7BD] hover:bg-white/5 text-[12px]" 
                              : "bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-[12px]"
                            }
                          >
                            {isComingSoon ? "Join waitlist" : "Connect"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* GLOBAL FOOTER (Trust Anchor) */}
            <div className="text-center py-6 border-t border-white/[0.04]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-[#8B8B92]" />
                <span className="text-[12px] font-medium text-[#8B8B92]">Built-in Safety</span>
              </div>
              <p className="text-[12px] text-[#8B8B92] leading-relaxed">
                LaunchBase never posts political content, tragedies, or sensitive events.<br />
                <span className="text-white/50">All communication follows built-in safety rules.</span>
              </p>
            </div>
          </div>

          {/* Right Column - Sticky Summary Rail */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <Card className="bg-[#151518] border-white/[0.08] rounded-[14px]">
                <CardContent className="p-5">
                  <h3 className="text-[14px] font-semibold text-white mb-4">Summary</h3>
                  
                  {/* Monthly Price */}
                  <div className="mb-4">
                    <p className="text-[11px] text-[#8B8B92] uppercase tracking-wide mb-1">Estimated Monthly</p>
                    <p className="text-[32px] font-semibold text-white leading-none">
                      {formatPrice(calculateMonthlyPrice())}
                      <span className="text-[14px] text-[#8B8B92] font-normal">/mo</span>
                    </p>
                  </div>

                  {/* Setup Fee */}
                  <div className="mb-5 pb-5 border-b border-white/[0.04]">
                    <p className="text-[11px] text-[#8B8B92] uppercase tracking-wide mb-1">Setup (one-time)</p>
                    <p className="text-[18px] font-medium text-white">{formatPrice(calculateSetupFee())}</p>
                  </div>

                  {/* What's Included */}
                  <div className="mb-5">
                    <p className="text-[11px] text-[#8B8B92] uppercase tracking-wide mb-2">What's Included</p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-[12px] text-[#B7B7BD]">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Approval workflow</span>
                      </li>
                      <li className="flex items-center gap-2 text-[12px] text-[#B7B7BD]">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Safety rules</span>
                      </li>
                      <li className="flex items-center gap-2 text-[12px] text-[#B7B7BD]">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Weather intelligence</span>
                      </li>
                      {enabledLayers.includes("sports") && (
                        <li className="flex items-center gap-2 text-[12px] text-[#B7B7BD]">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Sports & events</span>
                        </li>
                      )}
                      {enabledLayers.includes("community") && (
                        <li className="flex items-center gap-2 text-[12px] text-[#B7B7BD]">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Community & schools</span>
                        </li>
                      )}
                      {enabledLayers.includes("trends") && (
                        <li className="flex items-center gap-2 text-[12px] text-[#B7B7BD]">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Local trends</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Expected Cadence */}
                  <div className="mb-5 pb-5 border-b border-white/[0.04]">
                    <p className="text-[11px] text-[#8B8B92] uppercase tracking-wide mb-1">Expected Cadence</p>
                    <p className="text-[14px] text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#FF6A00]" />
                      ~{depthDescriptions[depthLevel].cadence}
                    </p>
                  </div>

                  {/* Save Button */}
                  <Button 
                    onClick={handleSave} 
                    disabled={isSaving || !hasChanges}
                    className={`w-full transition-all ${hasChanges ? "bg-[#FF6A00] hover:bg-[#FF6A00]/90" : "bg-zinc-700"} text-white`}
                  >
                    {isSaving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
                  </Button>

                  <p className="text-[11px] text-[#8B8B92] text-center mt-3">
                    Changes take effect immediately.<br />Cancel anytime.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Summary (Fixed Bottom) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#151518] border-t border-white/[0.08] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#8B8B92]">Estimated monthly</p>
            <p className="text-[20px] font-semibold text-white">{formatPrice(calculateMonthlyPrice())}/mo</p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !hasChanges}
            className={`transition-all ${hasChanges ? "bg-[#FF6A00] hover:bg-[#FF6A00]/90" : "bg-zinc-700"} text-white`}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
