import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Rocket, Check, Sparkles, Building2, Users, Briefcase } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "launchbase_onboarding_draft";
const TOTAL_STEPS = 8;

interface OnboardingData {
  // Step 1: Business description (AI infers vertical)
  businessDescription: string;
  // Step 2: Customer type
  customerType: "homeowners" | "businesses" | "both" | "";
  // Step 3: Website goals (multi-select)
  websiteGoals: string[];
  // Step 4: Contact preference
  contactPreference: "phone" | "form" | "booking" | "recommend" | "";
  // Step 5: Service area
  serviceArea: string;
  serviceRadius: string;
  // Step 6: Business info
  businessName: string;
  phone: string;
  email: string;
  // Step 7: Brand feel
  brandFeel: "clean" | "bold" | "friendly" | "auto" | "";
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
};

// AI Inference functions
function inferVertical(description: string, customerType: string, contactPreference: string): "trades" | "appointments" | "professional" {
  const desc = description.toLowerCase();
  
  // Trades keywords
  const tradesKeywords = ["plumber", "plumbing", "hvac", "electrician", "electrical", "roofing", "roofer", "concrete", "landscaping", "landscaper", "contractor", "repair", "install", "emergency", "service call", "24/7", "same-day", "handyman", "painting", "flooring", "remodel"];
  
  // Appointment keywords
  const appointmentKeywords = ["salon", "barber", "stylist", "therapist", "trainer", "massage", "spa", "beauty", "hair", "nail", "fitness", "yoga", "pilates", "coach", "session", "appointment", "schedule", "book", "availability"];
  
  // Professional keywords
  const professionalKeywords = ["consultant", "consulting", "lawyer", "attorney", "accountant", "accounting", "advisor", "advisory", "strategy", "expertise", "firm", "practice", "discovery call", "consultation"];
  
  let tradesScore = 0;
  let appointmentScore = 0;
  let professionalScore = 0;
  
  tradesKeywords.forEach(kw => { if (desc.includes(kw)) tradesScore += 10; });
  appointmentKeywords.forEach(kw => { if (desc.includes(kw)) appointmentScore += 10; });
  professionalKeywords.forEach(kw => { if (desc.includes(kw)) professionalScore += 10; });
  
  // Behavioral signals
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
  
  // Defaults by vertical
  if (vertical === "trades") return "call";
  if (vertical === "appointments") return "book";
  return "consult";
}

function inferTone(brandFeel: string, vertical: string): "professional" | "bold" | "friendly" {
  if (brandFeel === "clean") return "professional";
  if (brandFeel === "bold") return "bold";
  if (brandFeel === "friendly") return "friendly";
  
  // Default by vertical
  if (vertical === "professional") return "professional";
  if (vertical === "appointments") return "friendly";
  return "professional";
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [, setLocation] = useLocation();

  const submitMutation = trpc.intake.submit.useMutation({
    onSuccess: () => {
      localStorage.removeItem(STORAGE_KEY);
      setLocation("/onboarding/success");
    },
  });

  // Load draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate old data format: serviceArea was array, now string
        if (Array.isArray(parsed.serviceArea)) {
          parsed.serviceArea = parsed.serviceArea.join(', ');
        }
        // Ensure serviceArea is a string
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
      case 8: return true;
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
    const vertical = inferVertical(data.businessDescription, data.customerType, data.contactPreference);
    const primaryCTA = inferCTA(data.contactPreference, vertical);
    const tone = inferTone(data.brandFeel, vertical);
    
    // Build services from goals
    const services = data.websiteGoals;
    
    submitMutation.mutate({
      businessName: data.businessName,
      contactName: data.businessName, // Use business name as contact for now
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
              <p className="text-gray-400">This helps us understand what to build for you.</p>
            </div>
            <Textarea
              value={data.businessDescription}
              onChange={(e) => updateField("businessDescription", e.target.value)}
              placeholder="Example: I run a residential plumbing company helping homeowners with repairs and installs."
              className="min-h-40 text-lg"
              autoFocus
            />
            <p className="text-sm text-gray-500">
              No need to be perfect — we'll handle wording and structure.
              <span className="block mt-1 text-[#FF6A00]/70">✓ You can edit this later</span>
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
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Where do you provide services?</h2>
              <p className="text-gray-400">This helps with local search and clarity for customers.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">City / State</label>
                <Input
                  value={data.serviceArea}
                  onChange={(e) => updateField("serviceArea", e.target.value)}
                  placeholder="e.g., Austin, TX"
                  className="text-lg py-6"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Service radius (optional)</label>
                <Input
                  value={data.serviceRadius}
                  onChange={(e) => updateField("serviceRadius", e.target.value)}
                  placeholder="e.g., 25 miles"
                  className="text-lg py-6"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              <span className="text-[#FF6A00]/70">✓</span> You can update this anytime.
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
                  value={data.businessName}
                  onChange={(e) => updateField("businessName", e.target.value)}
                  placeholder="e.g., Smith Plumbing Co."
                  className="text-lg py-6"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Phone number</label>
                <Input
                  type="tel"
                  value={data.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  className="text-lg py-6"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Email address</label>
                <Input
                  type="email"
                  value={data.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="you@example.com"
                  className="text-lg py-6"
                />
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
          <div className="space-y-8 text-center">
            <div className="w-20 h-20 bg-[#FF6A00]/20 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-[#FF6A00]" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">You're all set</h2>
              <p className="text-gray-400 text-lg max-w-md mx-auto">
                We'll build your website and notify you when it's ready to review.
                A real human checks everything before it goes live.
              </p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              size="lg"
              className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-lg px-10 py-7"
            >
              {submitMutation.isPending ? (
                "Building..."
              ) : (
                <>
                  <Rocket className="w-5 h-5 mr-2" />
                  Build My Website
                </>
              )}
            </Button>
            <p className="text-sm text-gray-500">
              No payment required to review your site.
            </p>
            {submitMutation.isError && (
              <p className="text-red-500 text-sm">
                Something went wrong. Please try again.
              </p>
            )}
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
