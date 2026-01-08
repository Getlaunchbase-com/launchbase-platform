"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Rocket, Check, Sparkles, Building2, Users, Briefcase, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const STORAGE_KEY = "launchbase_onboarding_draft";
const TOTAL_STEPS = 9;

interface OnboardingData {
  businessDescription: string;
  customerType: "homeowners" | "businesses" | "both" | "";
  websiteGoals: string[];
  contactPreference: "phone" | "form" | "booking" | "recommend" | "";
  serviceArea: string;
  serviceRadius: string;
  businessName: string;
  phone: string;
  email: string;
  brandFeel: "clean" | "bold" | "friendly" | "auto" | "";
  socialMediaTier: "none" | "4posts" | "8posts" | "12posts";
  enrichmentLayer: boolean;
  googleBusiness: boolean;
  quickBooksSync: boolean;
  promoCode?: string;
}

const initialData: OnboardingData = {
  businessDescription: "",
  customerType: "",
  websiteGoals: [],
  contactPreference: "",
  serviceArea: "",
  serviceRadius: "",
  businessName: "",
  phone: "",
  email: "",
  brandFeel: "",
  socialMediaTier: "none",
  enrichmentLayer: false,
  googleBusiness: false,
  quickBooksSync: false,
};

// AI Inference functions
function inferVertical(description: string, customerType: string, contactPreference: string): "trades" | "appointments" | "professional" {
  const desc = description.toLowerCase();
  
  const tradesKeywords = ["plumber", "plumbing", "hvac", "electrician", "electrical", "roofing", "roofer", "concrete", "landscaping", "landscaper", "contractor", "repair", "install", "emergency", "service call", "24/7", "same-day", "handyman", "painting", "flooring", "remodel"];
  const appointmentKeywords = ["salon", "barber", "stylist", "therapist", "trainer", "massage", "spa", "beauty", "hair", "nail", "fitness", "yoga", "pilates", "coach", "session", "appointment", "schedule", "book", "availability"];
  const professionalKeywords = ["consultant", "consulting", "lawyer", "attorney", "accountant", "accounting", "advisor", "advisory", "strategy", "expertise", "firm", "practice", "discovery call", "consultation"];
  
  let tradesScore = 0;
  let appointmentScore = 0;
  let professionalScore = 0;
  
  tradesKeywords.forEach(kw => { if (desc.includes(kw)) tradesScore += 10; });
  appointmentKeywords.forEach(kw => { if (desc.includes(kw)) appointmentScore += 10; });
  professionalKeywords.forEach(kw => { if (desc.includes(kw)) professionalScore += 10; });
  
  if (contactPreference === "phone") tradesScore += 15;
  if (contactPreference === "booking") appointmentScore += 20;
  if (contactPreference === "form") professionalScore += 10;
  
  if (customerType === "homeowners") tradesScore += 10;
  if (customerType === "businesses") professionalScore += 10;
  
  if (appointmentScore > tradesScore && appointmentScore > professionalScore) return "appointments";
  if (professionalScore > tradesScore && professionalScore > appointmentScore) return "professional";
  return "trades";
}

function inferCTA(contactPreference: string, vertical: string): "call" | "book" | "consult" {
  if (contactPreference === "phone") return "call";
  if (contactPreference === "booking") return "book";
  if (contactPreference === "form") return "consult";
  if (vertical === "trades") return "call";
  if (vertical === "appointments") return "book";
  return "consult";
}

function inferTone(brandFeel: string, vertical: string): "professional" | "bold" | "friendly" {
  if (brandFeel === "clean") return "professional";
  if (brandFeel === "bold") return "bold";
  if (brandFeel === "friendly") return "friendly";
  if (vertical === "professional") return "professional";
  if (vertical === "appointments") return "friendly";
  return "professional";
}

// User-friendly error messages
function getUserFriendlyError(error: string): string {
  if (error.includes("invalid_format") && error.includes("email")) {
    return "Please enter a valid email address";
  }
  if (error.includes("invalid_format")) {
    return "Please check the format of your input";
  }
  if (error.includes("too_small")) {
    return "Please provide more information";
  }
  if (error.includes("too_big")) {
    return "Your input is too long";
  }
  return error || "Please check this field";
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [, setLocation] = useLocation();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string>("");

  const submitMutation = trpc.intake.submit.useMutation({
    onSuccess: () => {
      localStorage.removeItem(STORAGE_KEY);
      setFieldErrors({});
      setGlobalError("");
      setLocation("/onboarding/success");
    },
    onError: (error) => {
      setFieldErrors({});
      setGlobalError("");
      
      // Extract field errors from tRPC error
      const errorData = (error.data as any)?.zodError;
      if (errorData?.fieldErrors) {
        const errors: Record<string, string> = {};
        for (const [field, messages] of Object.entries(errorData.fieldErrors)) {
          if (Array.isArray(messages) && messages.length > 0) {
            errors[field] = getUserFriendlyError(String(messages[0]));
          }
        }
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setGlobalError("Please fix the highlighted fields and try again.");
          return;
        }
      }
      
      // Fallback error message
      setGlobalError("Something went wrong. Please check your information and try again.");
    },
  });

  // Load draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.serviceArea)) {
          parsed.serviceArea = parsed.serviceArea.join(', ');
        }
        if (typeof parsed.serviceArea !== 'string') {
          parsed.serviceArea = '';
        }
        setData({ ...initialData, ...parsed });
      } catch {
        // Invalid data, ignore
      }
    }
  }, []);

  // Save draft to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const updateField = (field: keyof OnboardingData, value: unknown) => {
    setData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const toggleGoal = (goal: string) => {
    if (data.websiteGoals.includes(goal)) {
      updateField("websiteGoals", data.websiteGoals.filter(g => g !== goal));
    } else {
      updateField("websiteGoals", [...data.websiteGoals, goal]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return data.businessDescription.trim().length >= 20;
      case 2: return data.customerType !== "";
      case 3: return data.websiteGoals.length > 0;
      case 4: return data.contactPreference !== "";
      case 5: return typeof data.serviceArea === 'string' && data.serviceArea.trim().length > 0;
      case 6: return data.businessName.trim().length > 0 && data.email.includes("@");
      case 7: return data.brandFeel !== "";
      case 8: return true; // Service selection is optional, always can proceed
      case 9: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    setGlobalError("");
    const vertical = inferVertical(data.businessDescription, data.customerType, data.contactPreference);
    const primaryCTA = inferCTA(data.contactPreference, vertical);
    const tone = inferTone(data.brandFeel, vertical);
    
    const services = data.websiteGoals;
    
    submitMutation.mutate({
      businessName: data.businessName,
      contactName: data.businessName,
      email: data.email,
      phone: data.phone || undefined,
      vertical,
      services,
      serviceArea: data.serviceArea ? [data.serviceArea] : [],
      primaryCTA,
      rawPayload: {
        ...data,
        inferredVertical: vertical,
        inferredCTA: primaryCTA,
        inferredTone: tone,
        promoCode: data.promoCode,
      },
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Tell us about your business</h2>
              <p className="text-gray-400">This helps LaunchBase decide what is safe to do on your behalf.</p>
            </div>
            <Textarea
              value={data.businessDescription}
              onChange={(e) => updateField("businessDescription", e.target.value)}
              placeholder="Example: I run a residential plumbing company helping homeowners with repairs and installs."
              className="min-h-40 text-lg"
              autoFocus
            />
            <p className="text-sm text-gray-500">
              You're not configuring software. You're giving us the context needed to take responsibility.
            </p>
            <p className="text-xs text-gray-600 mt-4 pt-4 border-t border-white/10">
              Nothing deploys without your approval. You can stop at any time.
            </p>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Who do you mainly work with?</h2>
              <p className="text-gray-400">This helps us shape the messaging on your site.</p>
              <p className="text-xs text-[#FF6A00]/70 mt-1">✓ You can change this later</p>
            </div>
            <div className="grid gap-4">
              {[
                { value: "homeowners", label: "Homeowners", icon: Building2 },
                { value: "businesses", label: "Businesses", icon: Briefcase },
                { value: "both", label: "Both", icon: Users },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateField("customerType", option.value)}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left",
                    data.customerType === option.value
                      ? "border-[#FF6A00] bg-[#FF6A00]/10"
                      : "border-white/10 hover:border-white/30 bg-white/5"
                  )}
                >
                  <option.icon className={cn(
                    "w-6 h-6",
                    data.customerType === option.value ? "text-[#FF6A00]" : "text-gray-400"
                  )} />
                  <span className="text-lg font-medium">{option.label}</span>
                  {data.customerType === option.value && (
                    <Check className="w-5 h-5 text-[#FF6A00] ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">What should your website help you do?</h2>
              <p className="text-gray-400">Choose what matters most. We'll handle the rest.</p>
              <p className="text-xs text-[#FF6A00]/70 mt-1">✓ Select as many as you want — you can adjust later</p>
            </div>
            <div className="grid gap-3">
              {[
                { value: "phone_calls", label: "Get phone calls", desc: "Customers call you directly" },
                { value: "leads", label: "Capture leads", desc: "Forms and quote requests" },
                { value: "bookings", label: "Book appointments", desc: "Customers schedule online" },
                { value: "professional", label: "Look more professional", desc: "Build trust instantly" },
                { value: "services", label: "Explain services", desc: "Clear, simple descriptions" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleGoal(option.value)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                    data.websiteGoals.includes(option.value)
                      ? "border-[#FF6A00] bg-[#FF6A00]/10"
                      : "border-white/10 hover:border-white/30 bg-white/5"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-md border-2 flex items-center justify-center",
                    data.websiteGoals.includes(option.value)
                      ? "border-[#FF6A00] bg-[#FF6A00]"
                      : "border-gray-500"
                  )}>
                    {data.websiteGoals.includes(option.value) && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-gray-400">{option.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">How should customers reach you?</h2>
              <p className="text-gray-400">We'll design your site around this.</p>
              <p className="text-xs text-[#FF6A00]/70 mt-1">✓ Not sure? Pick one — we can always add more options</p>
            </div>
            <div className="grid gap-4">
              {[
                { value: "phone", label: "Phone call" },
                { value: "form", label: "Online form" },
                { value: "booking", label: "Appointment booking" },
                { value: "recommend", label: "Not sure — recommend for me" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateField("contactPreference", option.value)}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left",
                    data.contactPreference === option.value
                      ? "border-[#FF6A00] bg-[#FF6A00]/10"
                      : "border-white/10 hover:border-white/30 bg-white/5"
                  )}
                >
                  <span className="text-lg font-medium">{option.label}</span>
                  {data.contactPreference === option.value && (
                    <Check className="w-5 h-5 text-[#FF6A00] ml-auto" />
                  )}
                </button>
              ))}
            </div>
            {data.contactPreference === "recommend" && (
              <p className="text-sm text-gray-500">
                We'll suggest what works best for your business type.
              </p>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Where do you serve?</h2>
              <p className="text-gray-400">Used for visibility, timing, and safety decisions.</p>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Service area</label>
              <Input
                type="text"
                value={data.serviceArea}
                onChange={(e) => updateField("serviceArea", e.target.value)}
                placeholder="e.g., Denver, CO or Denver metro area"
                className="text-lg py-6"
                autoFocus
              />
            </div>
            <p className="text-sm text-gray-500">
              <span className="text-[#FF6A00]/70">✓</span> This is just a preference — not a commitment.
            </p>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Basic business details</h2>
              <p className="text-gray-400">So customers know how to reach you.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Business name</label>
                <Input
                  type="text"
                  value={data.businessName}
                  onChange={(e) => updateField("businessName", e.target.value)}
                  placeholder="e.g., Smith Plumbing Co."
                  className={cn(
                    "text-lg py-6",
                    fieldErrors.businessName && "border-red-500 focus:ring-red-500"
                  )}
                  autoFocus
                />
                {fieldErrors.businessName && (
                  <p className="text-red-400 text-xs mt-2">{fieldErrors.businessName}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Phone number</label>
                <Input
                  type="tel"
                  value={data.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  className={cn(
                    "text-lg py-6",
                    fieldErrors.phone && "border-red-500 focus:ring-red-500"
                  )}
                />
                {fieldErrors.phone && (
                  <p className="text-red-400 text-xs mt-2">{fieldErrors.phone}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Email address</label>
                <Input
                  type="email"
                  value={data.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="you@example.com"
                  className={cn(
                    "text-lg py-6",
                    fieldErrors.email && "border-red-500 focus:ring-red-500"
                  )}
                />
                {fieldErrors.email && (
                  <p className="text-red-400 text-xs mt-2">{fieldErrors.email}</p>
                )}
              </div>
              
              {/* Quiet promo code toggle */}
              <div className="pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    const toggle = document.getElementById('promo-field');
                    if (toggle) {
                      toggle.style.display = toggle.style.display === 'none' ? 'block' : 'none';
                    }
                  }}
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Have a founder code?
                </button>
                <div id="promo-field" style={{ display: 'none' }} className="mt-3">
                  <Input
                    type="text"
                    value={data.promoCode || ''}
                    onChange={(e) => updateField("promoCode", e.target.value.toUpperCase())}
                    placeholder="BETA-FOUNDERS"
                    className="text-lg py-6"
                  />
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              We'll never share your contact info.
              <span className="block mt-1 text-[#FF6A00]/70">✓ You can update these details later</span>
            </p>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">How should your site feel?</h2>
              <p className="text-gray-400">This helps us match the look and tone to your business.</p>
            </div>
            <div className="grid gap-4">
              {[
                { value: "clean", label: "Clean & professional", desc: "Simple, trustworthy" },
                { value: "bold", label: "Bold & modern", desc: "Confident, high-impact" },
                { value: "friendly", label: "Friendly & approachable", desc: "Warm and personal" },
                { value: "auto", label: "Let LaunchBase decide", desc: "We'll choose what fits best" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateField("brandFeel", option.value)}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left",
                    data.brandFeel === option.value
                      ? "border-[#FF6A00] bg-[#FF6A00]/10"
                      : "border-white/10 hover:border-white/30 bg-white/5"
                  )}
                >
                  <div className="flex-1">
                    <p className="text-lg font-medium">{option.label}</p>
                    <p className="text-sm text-gray-400">{option.desc}</p>
                  </div>
                  {data.brandFeel === option.value && (
                    <Check className="w-5 h-5 text-[#FF6A00]" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              <span className="text-[#FF6A00]/70">✓</span> This is just a preference — not a commitment.
            </p>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Choose the services you want LaunchBase to own</h2>
              <p className="text-gray-400">
                You're not committing to automation. You're choosing what responsibility you want handed off.
              </p>
            </div>

            {/* Core Website (required, pre-selected) */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-white">Core Website</h3>
                      <span className="text-xs bg-[#FF6A00]/20 text-[#FF6A00] px-2 py-0.5 rounded">Required</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">Hosting, monitoring, safety, ownership</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Setup:</span>
                        <span className="text-white font-semibold ml-1">$499</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Monthly:</span>
                        <span className="text-white font-semibold ml-1">$49</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-[#FF6A00]/20 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-[#FF6A00]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Social Media Intelligence */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Social Media Intelligence</h3>
                <p className="text-sm text-gray-400 mb-4">Context-aware posting that adapts to your business</p>
                <div className="space-y-3">
                  {[
                    { value: "none", label: "Not right now", monthly: "$0" },
                    { value: "4posts", label: "4 posts/month", monthly: "$79" },
                    { value: "8posts", label: "8 posts/month", monthly: "$129" },
                    { value: "12posts", label: "12 posts/month", monthly: "$179" },
                  ].map((tier) => (
                    <button
                      key={tier.value}
                      onClick={() => updateField("socialMediaTier", tier.value)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg border transition-all",
                        data.socialMediaTier === tier.value
                          ? "bg-[#FF6A00]/10 border-[#FF6A00] text-white"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{tier.label}</span>
                        <span className="text-sm">{tier.monthly}/mo</span>
                      </div>
                    </button>
                  ))}
                </div>
                {data.socialMediaTier !== "none" && (
                  <div className="mt-4 p-4 bg-[#FF6A00]/10 border border-[#FF6A00]/20 rounded-lg">
                    <p className="text-sm text-gray-300 mb-2">
                      <span className="text-[#FF6A00] font-semibold">Setup: $299</span> (one-time, same for all tiers)
                    </p>
                    <p className="text-xs text-gray-500">
                      Includes account connection, safety rules, brand voice, and approval workflow.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enrichment Layer */}
            {data.socialMediaTier !== "none" && (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">Intelligent Enrichment Layer</h3>
                      <p className="text-sm text-gray-400 mb-3">
                        Adds contextual decision-making. This is premium. Treated as such.
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Setup:</span>
                          <span className="text-white font-semibold ml-1">$199</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Monthly:</span>
                          <span className="text-white font-semibold ml-1">+$79</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => updateField("enrichmentLayer", !data.enrichmentLayer)}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        data.enrichmentLayer
                          ? "bg-[#FF6A00] text-white"
                          : "bg-white/10 text-gray-500 hover:bg-white/20"
                      )}
                    >
                      {data.enrichmentLayer && <Check className="w-5 h-5" />}
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Google Business */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">Google Business Setup</h3>
                    <p className="text-sm text-gray-400 mb-3">Profile setup and ongoing visibility monitoring</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Setup:</span>
                        <span className="text-white font-semibold ml-1">$149</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Monthly:</span>
                        <span className="text-white font-semibold ml-1">$29</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => updateField("googleBusiness", !data.googleBusiness)}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      data.googleBusiness
                        ? "bg-[#FF6A00] text-white"
                        : "bg-white/10 text-gray-500 hover:bg-white/20"
                    )}
                  >
                    {data.googleBusiness && <Check className="w-5 h-5" />}
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* QuickBooks Sync */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">QuickBooks Sync</h3>
                    <p className="text-sm text-gray-400 mb-3">Accounting visibility and error monitoring</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Setup:</span>
                        <span className="text-white font-semibold ml-1">$199</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Monthly:</span>
                        <span className="text-white font-semibold ml-1">$39</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => updateField("quickBooksSync", !data.quickBooksSync)}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      data.quickBooksSync
                        ? "bg-[#FF6A00] text-white"
                        : "bg-white/10 text-gray-500 hover:bg-white/20"
                    )}
                  >
                    {data.quickBooksSync && <Check className="w-5 h-5" />}
                  </button>
                </div>
              </CardContent>
            </Card>

            <p className="text-sm text-gray-500 text-center">
              You can pause or change any service anytime. Billing is monthly. No contracts.
            </p>
          </div>
        );

      case 9:
        // Calculate pricing
        const setupItems = [
          { name: "LaunchBase Website", price: 49900 },
        ];
        let serviceCount = 1;
        
        if (data.socialMediaTier && data.socialMediaTier !== "none") {
          setupItems.push({ name: "Social Media Intelligence", price: 29900 });
          serviceCount++;
        }
        if (data.enrichmentLayer) {
          setupItems.push({ name: "Enrichment Layer", price: 19900 });
          serviceCount++;
        }
        if (data.googleBusiness) {
          setupItems.push({ name: "Google Business Setup", price: 14900 });
          serviceCount++;
        }
        if (data.quickBooksSync) {
          setupItems.push({ name: "QuickBooks Sync", price: 19900 });
          serviceCount++;
        }

        // Calculate bundle discount (50% off Social Media setup when 2+ services)
        let bundleDiscount = 0;
        if (serviceCount >= 3 && data.socialMediaTier && data.socialMediaTier !== "none") {
          bundleDiscount = 14950; // $149.50 (50% of $299)
        }

        const setupTotal = setupItems.reduce((sum, item) => sum + item.price, 0) - bundleDiscount;

        // Calculate monthly
        const monthlyItems = [
          { name: "Hosting & System Ownership", price: 4900 },
        ];
        
        if (data.socialMediaTier === "4posts") {
          monthlyItems.push({ name: "Social Media Intelligence (4 posts)", price: 7900 });
        } else if (data.socialMediaTier === "8posts") {
          monthlyItems.push({ name: "Social Media Intelligence (8 posts)", price: 12900 });
        } else if (data.socialMediaTier === "12posts") {
          monthlyItems.push({ name: "Social Media Intelligence (12 posts)", price: 17900 });
        }
        
        if (data.enrichmentLayer) {
          monthlyItems.push({ name: "Enrichment Layer", price: 7900 });
        }
        if (data.googleBusiness) {
          monthlyItems.push({ name: "Google Business Management", price: 2900 });
        }
        if (data.quickBooksSync) {
          monthlyItems.push({ name: "QuickBooks Sync", price: 3900 });
        }

        const monthlyTotal = monthlyItems.reduce((sum, item) => sum + item.price, 0);

        const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

        return (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">Review Your Setup & Ongoing Ownership</h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Here's exactly what LaunchBase will take responsibility for.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Nothing deploys without your approval. Monthly billing starts only after your site goes live.
              </p>
            </div>

            {/* One-Time Setup */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">One-Time Setup (charged today)</h3>
                <div className="space-y-3">
                  {setupItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{item.name}</span>
                      <span className="text-white font-semibold">{formatPrice(item.price)}</span>
                    </div>
                  ))}
                  
                  {bundleDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm pt-3 border-t border-white/10">
                      <span className="text-[#1ED760]">Bundle Discount (50% off Social Media setup)</span>
                      <span className="text-[#1ED760] font-semibold">−{formatPrice(bundleDiscount)}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-lg font-bold pt-3 border-t border-white/10">
                    <span className="text-white">Setup Total Today</span>
                    <span className="text-[#FF6A00]">{formatPrice(setupTotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Ownership */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Monthly Ownership (starts after launch)</h3>
                <div className="space-y-3">
                  {monthlyItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{item.name}</span>
                      <span className="text-white font-semibold">{formatPrice(item.price)}/mo</span>
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between text-lg font-bold pt-3 border-t border-white/10">
                    <span className="text-white">Estimated Monthly Total</span>
                    <span className="text-[#FF6A00]">{formatPrice(monthlyTotal)}/mo</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  You can turn services on or off at any time. Billing adjusts on the next monthly cycle. No penalties.
                </p>
              </CardContent>
            </Card>

            {/* What Happens Next */}
            <Card className="bg-[#FF6A00]/10 border-[#FF6A00]/20">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-3">What happens next</h3>
                <ol className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF6A00] font-semibold">1.</span>
                    <span>You complete setup payment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF6A00] font-semibold">2.</span>
                    <span>We build and connect your system</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF6A00] font-semibold">3.</span>
                    <span>You review your real site</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF6A00] font-semibold">4.</span>
                    <span>You approve launch</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF6A00] font-semibold">5.</span>
                    <span>LaunchBase stays on — monitoring, deciding, protecting</span>
                  </li>
                </ol>
              </CardContent>
            </Card>

            {globalError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-red-200 text-sm font-medium">Please fix the highlighted fields</p>
                  <p className="text-red-300/70 text-xs mt-1">{globalError}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(8)}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Go Back and Adjust Services
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="flex-1 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white"
              >
                {submitMutation.isPending ? (
                  "Processing..."
                ) : (
                  <>
                    <Rocket className="w-5 h-5 mr-2" />
                    Confirm & Continue
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-center text-sm text-gray-500">
              Nothing deploys without your approval. You can stop at any time.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#FF6A00] rounded-lg flex items-center justify-center">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold">LAUNCHBASE</span>
            </a>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                Step {currentStep} of {TOTAL_STEPS}
              </span>
              <span className="text-sm font-medium text-[#FF6A00]">
                {Math.round(progress)}% done
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#FF6A00] to-[#FF8A33] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Progress milestones */}
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span className={currentStep >= 1 ? "text-[#FF6A00]" : ""}>Start</span>
            <span className={currentStep >= 4 ? "text-[#FF6A00]" : ""}>Details</span>
            <span className={currentStep >= 6 ? "text-[#FF6A00]" : ""}>Contact</span>
            <span className={currentStep >= 8 ? "text-[#FF6A00]" : ""}>Done</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-32 pb-32 px-4">
        <div className="container max-w-2xl mx-auto">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8 md:p-12">
              {renderStep()}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer navigation */}
      {currentStep < 8 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-[#0B0B0C]/95 backdrop-blur-sm border-t border-white/10">
          <div className="container max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              <p className="text-xs text-gray-500 hidden sm:block">
                You can change anything later. Nothing is final yet.
              </p>
              
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
