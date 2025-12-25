import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  ArrowLeft, Cloud, Trophy, School, TrendingUp, BookOpen, Megaphone, 
  Check, Info, Calendar, Zap, Shield, Play, X, Clock, MapPin, 
  Sparkles, ChevronDown, ChevronUp, Lock, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";

// =============================================================================
// PRICING MODEL A: Cadence + Layers (Clean, Transparent, Scalable)
// =============================================================================

// Cadence tiers (how often we post)
const cadenceTiers = {
  low: {
    title: "Low",
    tagline: "Stay visible without noise",
    description: "LaunchBase posts only when information is critical — perfect for businesses that prefer a quieter presence.",
    frequency: "1–2 posts/week",
    price: 7900, // $79/mo
    postsIncluded: 8,
    intelligenceChecks: 30,
  },
  medium: {
    title: "Medium",
    tagline: "Balanced, timely presence",
    description: "LaunchBase posts when it meaningfully improves your customers' day — staying visible without being noisy.",
    frequency: "2–3 posts/week",
    price: 12900, // $129/mo
    postsIncluded: 12,
    intelligenceChecks: 60,
  },
  high: {
    title: "High",
    tagline: "High visibility during important moments",
    description: "LaunchBase responds to weather, events, and local activity with increased frequency for maximum presence.",
    frequency: "4–6 posts/week",
    price: 19900, // $199/mo
    postsIncluded: 24,
    intelligenceChecks: 120,
  },
};

// Mode descriptions - Trust-focused language
const modeDescriptions = {
  auto: {
    title: "Auto",
    subtitle: "Recommended",
    description: "LaunchBase decides for you. You can review everything.",
    explanation: null, // Will be set dynamically based on vertical
  },
  guided: {
    title: "Guided",
    subtitle: "",
    description: "LaunchBase recommends. You approve.",
    explanation: null,
  },
  custom: {
    title: "Custom",
    subtitle: "",
    description: "You fine-tune relevance. Safety is still enforced.",
    explanation: null,
  },
};

// Local Context layers (what we reference) - ALL are add-ons in Model A
const localContextLayers = [
  {
    id: "weather",
    icon: Cloud,
    title: "Weather Awareness",
    status: "included",
    statusLabel: "Always Included",
    tagline: "Safety-gated intelligence",
    description: "Keeps posts accurate and avoids outdoor recommendations during bad conditions.",
    whatItUnlocks: "Storm alerts, temperature awareness, safety messaging",
    bestFor: "All businesses — especially outdoor services",
    whyItMatters: "Prevents embarrassing posts during bad weather",
    price: 0,
    setupPrice: 0,
    locked: true,
    impact: "essential",
  },
  {
    id: "sports",
    icon: Trophy,
    title: "Sports & Events",
    status: "add_on",
    statusLabel: "Add-on",
    tagline: "Game days, major local events, traffic spikes",
    description: "Knows when the big game is on and how it affects your customers.",
    whatItUnlocks: "Game-day timing, event awareness, traffic predictions",
    bestFor: "Bars, restaurants, parking, delivery, home services",
    whyItMatters: "Game days change traffic, demand, and attention",
    price: 2900, // $29/mo
    setupPrice: 9900, // $99 setup
    locked: false,
    impact: "high",
  },
  {
    id: "community",
    icon: School,
    title: "Community & Schools",
    status: "add_on",
    statusLabel: "Add-on",
    tagline: "School schedules, local events, community rhythms",
    description: "Aligns your presence with the pulse of local life.",
    whatItUnlocks: "School calendar, community events, local holidays",
    bestFor: "Family services, tutoring, childcare, local retail",
    whyItMatters: "Local life drives local engagement",
    price: 3900, // $39/mo
    setupPrice: 9900, // $99 setup
    locked: false,
    impact: "medium",
  },
  {
    id: "trends",
    icon: TrendingUp,
    title: "Local Trends",
    status: "add_on",
    statusLabel: "Add-on",
    tagline: "What people are actually talking about locally",
    description: "Detects trending topics and uses them only when confirmed and safe.",
    whatItUnlocks: "Google Trends, local news mentions, viral moments",
    bestFor: "Brands wanting cultural relevance",
    whyItMatters: "Stay part of the conversation — without forcing it",
    price: 4900, // $49/mo
    setupPrice: 9900, // $99 setup
    locked: false,
    impact: "low",
    warning: "Used sparingly. Never forced.",
  },
];

// Module definitions (other Suite modules)
const suiteModules = [
  {
    id: "quickbooks",
    icon: BookOpen,
    title: "QuickBooks Sync",
    status: "available",
    tagline: "Get paid faster",
    description: "Keep invoices, customers, and payments automatically in sync.",
    setupPrice: 24900,
    monthlyPrice: 7900,
  },
  {
    id: "google",
    icon: Megaphone,
    title: "Google Business Assistant",
    status: "coming_soon",
    tagline: "Show up in Maps",
    description: "Responds to reviews, updates listings, and posts when visibility matters.",
    setupPrice: 0,
    monthlyPrice: 0,
  },
];

// Safety rules
const safetyRules = [
  { icon: X, text: "Never posts tragedies or politics" },
  { icon: Cloud, text: "Weather-gated recommendations" },
  { icon: Clock, text: "Respects quiet hours" },
  { icon: Shield, text: "Silence is a valid outcome" },
  { icon: Check, text: "You approve before posting" },
];

// Today's context snapshot (simulated - would come from backend)
const getTodayContext = () => ({
  weather: { summary: "Partly cloudy, 42°F", icon: "⛅" },
  nextEvent: { name: "Bears vs Packers", date: "Sunday 12pm", type: "sports" },
  cadenceThisWeek: 3,
  lastPost: "2 days ago",
});

// Auto mode explanations based on vertical
const getAutoExplanation = (vertical: string, enabledLayers: string[]) => {
  const explanations: Record<string, { included: string; excluded: string }> = {
    trades: {
      included: "We picked Sports because your customers respond to game-day timing and weather changes.",
      excluded: "We excluded Trends because it increases noise without boosting conversions for service businesses.",
    },
    appointments: {
      included: "We picked Community & Schools because appointment patterns follow local schedules.",
      excluded: "We excluded Sports because it rarely affects appointment-based businesses.",
    },
    professional: {
      included: "We kept it minimal because professional services benefit from conservative posting.",
      excluded: "We excluded most layers because your audience values quality over frequency.",
    },
  };
  return explanations[vertical] || explanations.trades;
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function ExpandLaunchBase() {
  // State
  const [cadence, setCadence] = useState<"low" | "medium" | "high">("medium");
  const [tuningMode, setTuningMode] = useState<"auto" | "guided" | "custom">("auto");
  const [enabledLayers, setEnabledLayers] = useState<string[]>(["weather"]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSampleWeek, setShowSampleWeek] = useState(false);
  const [showSafetyRules, setShowSafetyRules] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showBillingDetails, setShowBillingDetails] = useState(false);
  const [vertical] = useState("trades"); // Would come from user's intake

  // tRPC queries
  const { data: config } = trpc.intelligenceLayers.getConfig.useQuery();
  const saveMutation = trpc.intelligenceLayers.saveConfig.useMutation();
  const { data: samplePosts } = trpc.intelligenceLayers.getSampleWeek.useQuery({
    cadence: cadence,
    sportsEnabled: enabledLayers.includes("sports"),
    communityEnabled: enabledLayers.includes("community"),
    trendsEnabled: enabledLayers.includes("trends"),
  });

  // Initialize from server
  useEffect(() => {
    if (config) {
      setCadence(config.cadence as "low" | "medium" | "high");
      setTuningMode((config.tuningMode as "auto" | "guided" | "custom") || "auto");
      const layers = ["weather"];
      if (config.sportsEnabled) layers.push("sports");
      if (config.communityEnabled) layers.push("community");
      if (config.trendsEnabled) layers.push("trends");
      setEnabledLayers(layers);
    }
  }, [config]);

  // =============================================================================
  // PRICING CALCULATIONS (Model A: Clean Add-on Model)
  // =============================================================================

  const calculateMonthlyPrice = () => {
    let total = cadenceTiers[cadence].price;
    // All layers are add-ons (except weather which is free)
    if (enabledLayers.includes("sports")) total += 2900;
    if (enabledLayers.includes("community")) total += 3900;
    if (enabledLayers.includes("trends")) total += 4900;
    return total;
  };

  const calculateSetupFee = () => {
    let total = 24900; // Base setup $249
    // Each layer adds $99 setup
    const paidLayers = enabledLayers.filter(l => l !== "weather");
    total += paidLayers.length * 9900;
    return total;
  };

  const getLayerBreakdown = () => {
    const breakdown: { name: string; price: number }[] = [];
    if (enabledLayers.includes("sports")) breakdown.push({ name: "Sports & Events", price: 2900 });
    if (enabledLayers.includes("community")) breakdown.push({ name: "Community & Schools", price: 3900 });
    if (enabledLayers.includes("trends")) breakdown.push({ name: "Local Trends", price: 4900 });
    return breakdown;
  };

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleCadenceChange = (value: number[]) => {
    const levels: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
    setCadence(levels[value[0]]);
    setHasChanges(true);
  };

  const toggleLayer = (layerId: string) => {
    if (layerId === "weather") return; // Weather is always on
    if (enabledLayers.includes(layerId)) {
      setEnabledLayers(enabledLayers.filter(l => l !== layerId));
    } else {
      setEnabledLayers([...enabledLayers, layerId]);
    }
    setHasChanges(true);
  };

  const applyRecommendation = () => {
    // Recommended setup for trades: Medium + Sports
    setCadence("medium");
    setEnabledLayers(["weather", "sports"]);
    setTuningMode("auto");
    setHasChanges(true);
    toast.success("Recommended setup applied");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync({
        cadence: cadence,
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

  // =============================================================================
  // HELPERS
  // =============================================================================

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const getSliderValue = () => ({ low: 0, medium: 1, high: 2 }[cadence]);
  const todayContext = getTodayContext();
  const autoExplanation = getAutoExplanation(vertical, enabledLayers);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "essential": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "high": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "low": return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
      default: return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-[#0B0B0C] pb-24 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#111113]/95 backdrop-blur-sm">
        <div className="max-w-[1120px] mx-auto px-5 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Link>
            <div className="flex items-center gap-3">
              {/* Founder Pricing Badge */}
              <Badge variant="outline" className="hidden sm:flex text-[10px] bg-[#FF6A00]/10 text-[#FF6A00] border-[#FF6A00]/20">
                <Lock className="w-3 h-3 mr-1" />
                Founder pricing locked 12 months
              </Badge>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !hasChanges}
                className={`transition-all ${hasChanges ? "bg-[#FF6A00] hover:bg-[#FF6A00]/90" : "bg-zinc-700"} text-white`}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1120px] mx-auto px-5 md:px-8 py-8">
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            {/* Page Title */}
            <div>
              <h1 className="text-[28px] font-semibold text-white leading-tight">
                Social Media Intelligence
              </h1>
              <p className="text-[15px] text-[#B7B7BD] mt-2 leading-relaxed">
                Your business stays visible — without you thinking about it.
              </p>
            </div>

            {/* TRUST REASSURANCE BLOCK */}
            <div className="bg-[#111113] border border-white/[0.06] rounded-[12px] p-4">
              <p className="text-[13px] text-[#B7B7BD] leading-relaxed">
                <span className="text-white font-medium">Nothing here is permanent.</span> You can change cadence, context, or pause posting at any time. Every decision is visible in your dashboard.
              </p>
              <p className="text-[12px] text-[#8B8B92] mt-2">
                You can always see what LaunchBase is doing — and change it anytime.
              </p>
            </div>

            {/* OBSERVABILITY PANEL - Customer-facing activity view */}
            <ObservabilityPanel />

            {/* RECOMMENDED SETUP STRIP */}
            <Card className="bg-gradient-to-r from-[#FF6A00]/10 to-[#FF6A00]/5 border-[#FF6A00]/20 rounded-[14px]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-[#FF6A00]/20 mt-0.5">
                      <Sparkles className="w-4 h-4 text-[#FF6A00]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[14px] font-semibold text-white">Recommended for: Service businesses in Chicago</h3>
                      </div>
                      <ul className="text-[12px] text-[#B7B7BD] space-y-0.5">
                        <li>• Medium cadence keeps you visible during weather changes</li>
                        <li>• Sports layer captures game-day demand spikes</li>
                      </ul>
                    </div>
                  </div>
                  <Button 
                    onClick={applyRecommendation}
                    size="sm" 
                    className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-[12px] whitespace-nowrap"
                  >
                    Apply recommendation
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* CURRENT STATE */}
            <Card className="bg-[#151518] border-white/[0.04] rounded-[14px]">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <h2 className="text-[16px] font-semibold text-white">Your Social Intelligence is active</h2>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] font-medium text-[#8B8B92] uppercase tracking-wide mb-1">Cadence</p>
                    <p className="text-[14px] text-white capitalize">{cadence}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#8B8B92] uppercase tracking-wide mb-1">Frequency</p>
                    <p className="text-[14px] text-white">{cadenceTiers[cadence].frequency}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#8B8B92] uppercase tracking-wide mb-1">Approval</p>
                    <p className="text-[14px] text-white">Required</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#8B8B92] uppercase tracking-wide mb-1">Context</p>
                    <p className="text-[14px] text-white">{enabledLayers.length} layer{enabledLayers.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                <p className="text-[12px] text-[#8B8B92] mt-4 pt-4 border-t border-white/[0.04]">
                  LaunchBase is monitoring what matters in your area. You don't need to do anything right now.
                </p>
              </CardContent>
            </Card>

            {/* MODE SELECTOR */}
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
                          ? "bg-[#FF6A00]/10 border-[#FF6A00]/30" 
                          : "bg-transparent border-white/[0.08] hover:border-white/[0.15]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[13px] font-medium ${tuningMode === mode ? "text-white" : "text-[#B7B7BD]"}`}>
                          {modeDescriptions[mode].title}
                        </span>
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

                {/* Auto Mode Explanation */}
                {tuningMode === "auto" && (
                  <div className="mt-4 p-3 rounded-lg bg-[#111113] border border-white/[0.04]">
                    <p className="text-[11px] text-[#B7B7BD] leading-relaxed">
                      <span className="text-emerald-400">✓</span> {autoExplanation.included}
                    </p>
                    <p className="text-[11px] text-[#8B8B92] leading-relaxed mt-1">
                      <span className="text-zinc-500">—</span> {autoExplanation.excluded}
                    </p>
                  </div>
                )}

                {/* Trust guardrail line */}
                <div className="mt-4 pt-4 border-t border-white/[0.04]">
                  <p className="text-[12px] text-[#8B8B92] text-center">
                    <span className="text-white/70">Controls change relevance — not safety.</span>
                    <br />
                    Weather, safety, and brand protection are always enforced.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CADENCE SELECTOR */}
            <div>
              <h2 className="text-[16px] font-semibold text-white mb-2">Cadence</h2>
              <p className="text-[13px] text-[#B7B7BD] mb-4">How often should LaunchBase post?</p>

              <Card className="bg-[#151518] border-white/[0.08] rounded-[14px]">
                <CardContent className="p-6">
                  {/* Slider */}
                  <div className="mb-6">
                    <div className="flex justify-between mb-3">
                      {(["low", "medium", "high"] as const).map((level) => (
                        <div key={level} className="text-center">
                          <span className={`text-[12px] font-medium uppercase ${
                            cadence === level ? "text-[#FF6A00]" : "text-[#8B8B92]"
                          }`}>
                            {level}
                          </span>
                          <p className={`text-[10px] mt-0.5 ${
                            cadence === level ? "text-[#B7B7BD]" : "text-[#8B8B92]/60"
                          }`}>
                            {cadenceTiers[level].frequency}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Slider
                      value={[getSliderValue()]}
                      onValueChange={handleCadenceChange}
                      max={2}
                      step={1}
                      className="[&_[role=slider]]:bg-[#FF6A00] [&_[role=slider]]:border-0 [&_[role=slider]]:w-[18px] [&_[role=slider]]:h-[18px] [&_.bg-primary]:bg-[#FF6A00]"
                    />
                  </div>

                  {/* Description */}
                  <div className="bg-[#111113] rounded-lg p-4 border border-white/[0.04]">
                    <h4 className="text-[14px] font-medium text-white mb-1">
                      {cadenceTiers[cadence].tagline}
                    </h4>
                    <p className="text-[13px] text-[#B7B7BD] leading-relaxed">
                      {cadenceTiers[cadence].description}
                    </p>
                  </div>

                  <p className="text-[12px] text-[#8B8B92] mt-4 text-center">
                    Change anytime. <span className="text-white/60">Silence is always an option.</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* LOCAL CONTEXT LAYERS */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Local Context</h2>
                  <p className="text-[13px] text-[#B7B7BD]">What should LaunchBase pay attention to?</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Safety Rules Sheet */}
                  <Sheet open={showSafetyRules} onOpenChange={setShowSafetyRules}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-[#8B8B92] hover:text-white text-[12px]">
                        <Shield className="w-3 h-3 mr-1" />
                        Safety rules
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="bg-[#151518] border-white/[0.08]">
                      <SheetHeader>
                        <SheetTitle className="text-white">Safety Rules</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6 space-y-4">
                        <p className="text-[13px] text-[#B7B7BD]">
                          LaunchBase follows strict safety rules to protect your brand.
                        </p>
                        <div className="space-y-3">
                          {safetyRules.map((rule, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#111113] border border-white/[0.04]">
                              <rule.icon className="w-4 h-4 text-emerald-400" />
                              <span className="text-[13px] text-white">{rule.text}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-[#8B8B92] pt-4 border-t border-white/[0.04]">
                          These rules are always active and cannot be disabled.
                        </p>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* Sample Week Preview */}
                  <Dialog open={showSampleWeek} onOpenChange={setShowSampleWeek}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="border-white/10 text-[#B7B7BD] hover:bg-white/5 text-[12px]">
                        <Play className="w-3 h-3 mr-1" />
                        Preview week
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#151518] border-white/[0.08] max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-white">Sample Week Preview</DialogTitle>
                      </DialogHeader>
                      
                      {/* Today's Context Snapshot */}
                      <div className="bg-[#111113] rounded-lg p-4 border border-white/[0.04] mt-4">
                        <p className="text-[11px] font-medium text-[#8B8B92] uppercase tracking-wide mb-3">Today's Context</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{todayContext.weather.icon}</span>
                            <span className="text-[12px] text-[#B7B7BD]">{todayContext.weather.summary}</span>
                          </div>
                          {enabledLayers.includes("sports") && todayContext.nextEvent && (
                            <div className="flex items-center gap-2">
                              <Trophy className="w-4 h-4 text-[#FF6A00]" />
                              <span className="text-[12px] text-[#B7B7BD]">{todayContext.nextEvent.name}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8B8B92] mt-3 pt-3 border-t border-white/[0.04]">
                          Posting cadence this week: ~{todayContext.cadenceThisWeek} posts
                        </p>
                      </div>

                      {/* Sample Posts */}
                      <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto">
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
              </div>

              {/* Layer Cards */}
              <div className="space-y-2">
                {localContextLayers.map((layer) => {
                  const Icon = layer.icon;
                  const isEnabled = enabledLayers.includes(layer.id);
                  
                  return (
                    <Card 
                      key={layer.id}
                      className={`bg-[#151518] border-white/[0.08] rounded-[12px] transition-all ${
                        !layer.locked && "hover:border-white/[0.12] cursor-pointer"
                      } ${isEnabled && !layer.locked ? "border-[#FF6A00]/20" : ""}`}
                      onClick={() => !layer.locked && toggleLayer(layer.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${isEnabled ? "bg-[#FF6A00]/10" : "bg-white/5"}`}>
                            <Icon className={`w-4 h-4 ${isEnabled ? "text-[#FF6A00]" : "text-[#8B8B92]"}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-[14px] font-medium text-white">{layer.title}</h4>
                              <Badge variant="outline" className={`text-[10px] ${getImpactColor(layer.impact)}`}>
                                {layer.impact === "essential" ? "Essential" : `${layer.impact} impact`}
                              </Badge>
                              {layer.status === "included" && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                  Always Included
                                </Badge>
                              )}
                            </div>
                            <p className="text-[12px] text-[#FF6A00]/80 mt-0.5">{layer.tagline}</p>
                            <p className="text-[12px] text-[#8B8B92] mt-1">{layer.description}</p>
                            
                            {/* Expanded info for enabled layers */}
                            {isEnabled && !layer.locked && (
                              <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-[10px] text-[#8B8B92] uppercase">Best for</p>
                                  <p className="text-[11px] text-[#B7B7BD]">{layer.bestFor}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-[#8B8B92] uppercase">Unlocks</p>
                                  <p className="text-[11px] text-[#B7B7BD]">{layer.whatItUnlocks}</p>
                                </div>
                              </div>
                            )}

                            {layer.warning && (
                              <p className="text-[11px] text-[#8B8B92] italic mt-1">{layer.warning}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {!layer.locked && layer.price > 0 && (
                              <span className="text-[12px] text-[#8B8B92]">+{formatPrice(layer.price)}/mo</span>
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

              {/* Trust Guardrail */}
              <div className="mt-4 text-center">
                <p className="text-[12px] text-[#8B8B92] leading-relaxed">
                  <span className="text-white/70">Turn on or off anytime. No contracts. No penalties.</span>
                </p>
                <p className="text-[11px] text-[#8B8B92] mt-1">
                  Local Context layers are weather-aware and safety-gated.
                </p>
              </div>
            </div>

            {/* GROWTH PATH: Other Suite Modules */}
            <div>
              <h2 className="text-[16px] font-semibold text-white mb-1">Most businesses add these next</h2>
              <p className="text-[13px] text-[#B7B7BD] mb-4">Expand your LaunchBase as you grow.</p>

              <div className="space-y-3">
                {suiteModules.map((module) => {
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
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="text-[14px] font-medium text-white">{module.title}</h4>
                              {isComingSoon && (
                                <Badge variant="outline" className="text-[10px] bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
                                  Coming Soon
                                </Badge>
                              )}
                            </div>
                            <p className="text-[12px] text-[#FF6A00]/80">{module.tagline}</p>
                            <p className="text-[12px] text-[#8B8B92] mt-1">{module.description}</p>
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

            {/* TRUST FOOTER */}
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
                  
                  {/* Line Items */}
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-[#B7B7BD]">Social Media Intelligence</span>
                    </div>
                    <div className="flex justify-between items-center pl-3 border-l-2 border-white/[0.08]">
                      <span className="text-[12px] text-[#8B8B92]">Cadence: {cadence.charAt(0).toUpperCase() + cadence.slice(1)}</span>
                      <span className="text-[12px] text-white">{formatPrice(cadenceTiers[cadence].price)}/mo</span>
                    </div>
                    
                    {getLayerBreakdown().length > 0 && (
                      <>
                        <div className="flex justify-between items-center pl-3 border-l-2 border-white/[0.08]">
                          <span className="text-[12px] text-[#8B8B92]">Local Context:</span>
                        </div>
                        {getLayerBreakdown().map((layer) => (
                          <div key={layer.name} className="flex justify-between items-center pl-6">
                            <span className="text-[12px] text-[#8B8B92]">• {layer.name}</span>
                            <span className="text-[12px] text-white">+{formatPrice(layer.price)}/mo</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="pt-4 border-t border-white/[0.08] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-medium text-white">Monthly Total</span>
                      <span className="text-[20px] font-semibold text-white">{formatPrice(calculateMonthlyPrice())}/mo</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-[#8B8B92]">One-time setup</span>
                      <span className="text-[14px] text-white">{formatPrice(calculateSetupFee())}</span>
                    </div>
                  </div>

                  {/* Pricing Philosophy */}
                  <p className="text-[11px] text-[#8B8B92] italic text-center mt-3 pt-3 border-t border-white/[0.04]">
                    You're not buying software. You're deciding how much responsibility to hand off.
                  </p>

                  {/* Billing Details Collapsible */}
                  <Collapsible open={showBillingDetails} onOpenChange={setShowBillingDetails}>
                    <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-[#8B8B92] hover:text-white mt-3 transition-colors">
                      {showBillingDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      What's included
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 pt-3 border-t border-white/[0.04]">
                      <ul className="space-y-2 text-[11px] text-[#8B8B92]">
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-emerald-400" />
                          Up to {cadenceTiers[cadence].postsIncluded} posts/month
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-emerald-400" />
                          {cadenceTiers[cadence].intelligenceChecks} intelligence checks/month
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-emerald-400" />
                          Approval workflow included
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-emerald-400" />
                          Safety rules always active
                        </li>
                      </ul>
                      <p className="text-[10px] text-[#8B8B92] mt-3 pt-2 border-t border-white/[0.04]">
                        Overages: blocked by default (we ask first)
                      </p>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Save Button */}
                  <Button 
                    onClick={handleSave} 
                    disabled={isSaving || !hasChanges}
                    className={`w-full mt-5 transition-all ${hasChanges ? "bg-[#FF6A00] hover:bg-[#FF6A00]/90" : "bg-zinc-700"} text-white`}
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#151518] border-t border-white/[0.08] p-4 z-40">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#8B8B92]">Monthly total</p>
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
