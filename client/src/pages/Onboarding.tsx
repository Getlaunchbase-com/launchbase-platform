import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Rocket, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

const STORAGE_KEY = "launchbase_onboarding_draft";

interface OnboardingData {
  // Step 1-3: Business basics
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  // Step 4-5: What you do
  businessDescription: string;
  services: string[];
  // Step 6-7: Who you serve
  serviceArea: string[];
  targetCustomer: string;
  // Step 8-9: How customers reach you
  primaryCTA: "call" | "book" | "consult" | "";
  bookingLink: string;
  // Step 10-11: Branding
  tagline: string;
  brandColors: { primary: string; secondary: string };
  // Step 12-13: Final details
  competitors: string;
  additionalNotes: string;
}

const initialData: OnboardingData = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  businessDescription: "",
  services: [],
  serviceArea: [],
  targetCustomer: "",
  primaryCTA: "",
  bookingLink: "",
  tagline: "",
  brandColors: { primary: "", secondary: "" },
  competitors: "",
  additionalNotes: "",
};

const steps = [
  { id: 1, title: "Business Name", field: "businessName" },
  { id: 2, title: "Your Name", field: "contactName" },
  { id: 3, title: "Contact Info", field: "email" },
  { id: 4, title: "What You Do", field: "businessDescription" },
  { id: 5, title: "Your Services", field: "services" },
  { id: 6, title: "Service Area", field: "serviceArea" },
  { id: 7, title: "Target Customer", field: "targetCustomer" },
  { id: 8, title: "How Customers Reach You", field: "primaryCTA" },
  { id: 9, title: "Booking Link", field: "bookingLink" },
  { id: 10, title: "Tagline", field: "tagline" },
  { id: 11, title: "Brand Colors", field: "brandColors" },
  { id: 12, title: "Competitors", field: "competitors" },
  { id: 13, title: "Additional Notes", field: "additionalNotes" },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [serviceInput, setServiceInput] = useState("");
  const [areaInput, setAreaInput] = useState("");
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

  const progress = (currentStep / steps.length) * 100;

  const updateField = (field: keyof OnboardingData, value: unknown) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const addService = () => {
    if (serviceInput.trim() && !data.services.includes(serviceInput.trim())) {
      updateField("services", [...data.services, serviceInput.trim()]);
      setServiceInput("");
    }
  };

  const removeService = (service: string) => {
    updateField("services", data.services.filter((s) => s !== service));
  };

  const addArea = () => {
    if (areaInput.trim() && !data.serviceArea.includes(areaInput.trim())) {
      updateField("serviceArea", [...data.serviceArea, areaInput.trim()]);
      setAreaInput("");
    }
  };

  const removeArea = (area: string) => {
    updateField("serviceArea", data.serviceArea.filter((a) => a !== area));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return data.businessName.trim().length > 0;
      case 2: return data.contactName.trim().length > 0;
      case 3: return data.email.trim().length > 0 && data.email.includes("@");
      case 4: return data.businessDescription.trim().length > 0;
      case 5: return data.services.length > 0;
      case 6: return data.serviceArea.length > 0;
      case 7: return data.targetCustomer.trim().length > 0;
      case 8: return data.primaryCTA !== "";
      case 9: return true; // Optional
      case 10: return true; // Optional
      case 11: return true; // Optional
      case 12: return true; // Optional
      case 13: return true; // Optional
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    // Infer vertical based on primaryCTA and business description
    let vertical: "trades" | "appointments" | "professional" = "trades";
    const desc = data.businessDescription.toLowerCase();
    
    if (data.primaryCTA === "book" || 
        desc.includes("salon") || desc.includes("spa") || 
        desc.includes("therapy") || desc.includes("trainer") ||
        desc.includes("coach") || desc.includes("massage")) {
      vertical = "appointments";
    } else if (data.primaryCTA === "consult" ||
               desc.includes("consult") || desc.includes("lawyer") ||
               desc.includes("attorney") || desc.includes("accountant") ||
               desc.includes("advisor") || desc.includes("firm")) {
      vertical = "professional";
    } else if (data.primaryCTA === "call" ||
               desc.includes("plumb") || desc.includes("electric") ||
               desc.includes("hvac") || desc.includes("roof") ||
               desc.includes("landscape") || desc.includes("contractor")) {
      vertical = "trades";
    }

    submitMutation.mutate({
      businessName: data.businessName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone || undefined,
      vertical,
      services: data.services,
      serviceArea: data.serviceArea,
      primaryCTA: data.primaryCTA || undefined,
      bookingLink: data.bookingLink || undefined,
      tagline: data.tagline || undefined,
      brandColors: data.brandColors.primary ? data.brandColors : undefined,
      rawPayload: JSON.parse(JSON.stringify(data)),
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">What's your business name?</h2>
            <p className="text-gray-400">This will appear on your website.</p>
            <Input
              value={data.businessName}
              onChange={(e) => updateField("businessName", e.target.value)}
              placeholder="e.g., Smith Plumbing Co."
              className="text-lg py-6"
              autoFocus
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">What's your name?</h2>
            <p className="text-gray-400">So we know who to contact.</p>
            <Input
              value={data.contactName}
              onChange={(e) => updateField("contactName", e.target.value)}
              placeholder="e.g., John Smith"
              className="text-lg py-6"
              autoFocus
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">How can we reach you?</h2>
            <p className="text-gray-400">We'll send updates about your site here.</p>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="you@example.com"
              className="text-lg py-6 mb-4"
              autoFocus
            />
            <Input
              type="tel"
              value={data.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="Phone (optional)"
              className="text-lg py-6"
            />
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Tell us about your business</h2>
            <p className="text-gray-400">In a few sentences, what do you do?</p>
            <Textarea
              value={data.businessDescription}
              onChange={(e) => updateField("businessDescription", e.target.value)}
              placeholder="e.g., We're a family-owned plumbing company serving the Dallas area for over 20 years..."
              className="min-h-32"
              autoFocus
            />
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">What services do you offer?</h2>
            <p className="text-gray-400">Add your main services (3-6 recommended).</p>
            <div className="flex gap-2">
              <Input
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService())}
                placeholder="e.g., Emergency Repairs"
                className="flex-1"
              />
              <Button onClick={addService} variant="secondary">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {data.services.map((service) => (
                <Badge key={service} variant="secondary" className="py-2 px-3 text-sm">
                  {service}
                  <button onClick={() => removeService(service)} className="ml-2">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Where do you serve?</h2>
            <p className="text-gray-400">Add cities, neighborhoods, or regions.</p>
            <div className="flex gap-2">
              <Input
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addArea())}
                placeholder="e.g., Dallas, TX"
                className="flex-1"
              />
              <Button onClick={addArea} variant="secondary">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {data.serviceArea.map((area) => (
                <Badge key={area} variant="secondary" className="py-2 px-3 text-sm">
                  {area}
                  <button onClick={() => removeArea(area)} className="ml-2">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Who's your ideal customer?</h2>
            <p className="text-gray-400">Describe who you want to attract.</p>
            <Textarea
              value={data.targetCustomer}
              onChange={(e) => updateField("targetCustomer", e.target.value)}
              placeholder="e.g., Homeowners in suburban areas who need reliable, same-day plumbing service..."
              className="min-h-32"
              autoFocus
            />
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">How do customers typically reach you?</h2>
            <p className="text-gray-400">This helps us design the right call-to-action.</p>
            <div className="grid gap-4 mt-4">
              {[
                { value: "call", label: "Phone Call", desc: "They call for quotes or emergencies" },
                { value: "book", label: "Online Booking", desc: "They schedule appointments online" },
                { value: "consult", label: "Consultation Request", desc: "They request a consultation first" },
              ].map((option) => (
                <Card
                  key={option.value}
                  className={`cursor-pointer transition-all ${
                    data.primaryCTA === option.value
                      ? "border-[#FF6A00] bg-[#FF6A00]/10"
                      : "hover:border-gray-600"
                  }`}
                  onClick={() => updateField("primaryCTA", option.value)}
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      data.primaryCTA === option.value ? "border-[#FF6A00] bg-[#FF6A00]" : "border-gray-500"
                    }`}>
                      {data.primaryCTA === option.value && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm text-gray-400">{option.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Do you have an online booking link?</h2>
            <p className="text-gray-400">Calendly, Square, Acuity, etc. (optional)</p>
            <Input
              value={data.bookingLink}
              onChange={(e) => updateField("bookingLink", e.target.value)}
              placeholder="https://calendly.com/yourbusiness"
              className="text-lg py-6"
            />
          </div>
        );

      case 10:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Got a tagline?</h2>
            <p className="text-gray-400">A short phrase that captures your business. (optional)</p>
            <Input
              value={data.tagline}
              onChange={(e) => updateField("tagline", e.target.value)}
              placeholder="e.g., Your trusted local plumber since 2005"
              className="text-lg py-6"
            />
          </div>
        );

      case 11:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Any brand colors?</h2>
            <p className="text-gray-400">If you have existing colors, we'll use them. (optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Primary Color</label>
                <Input
                  value={data.brandColors.primary}
                  onChange={(e) => updateField("brandColors", { ...data.brandColors, primary: e.target.value })}
                  placeholder="#FF6A00"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Secondary Color</label>
                <Input
                  value={data.brandColors.secondary}
                  onChange={(e) => updateField("brandColors", { ...data.brandColors, secondary: e.target.value })}
                  placeholder="#0B0B0C"
                />
              </div>
            </div>
          </div>
        );

      case 12:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Any competitors we should know about?</h2>
            <p className="text-gray-400">Links to sites you like or want to differentiate from. (optional)</p>
            <Textarea
              value={data.competitors}
              onChange={(e) => updateField("competitors", e.target.value)}
              placeholder="e.g., www.competitor1.com - I like their clean design..."
              className="min-h-32"
            />
          </div>
        );

      case 13:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Anything else we should know?</h2>
            <p className="text-gray-400">Special features, certifications, unique selling points. (optional)</p>
            <Textarea
              value={data.additionalNotes}
              onChange={(e) => updateField("additionalNotes", e.target.value)}
              placeholder="e.g., We're BBB accredited, offer 24/7 emergency service, and have been in business for 20 years..."
              className="min-h-32"
            />
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
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FF6A00] rounded-lg flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LAUNCHBASE</span>
          </div>
          <div className="text-sm text-gray-400">
            Step {currentStep} of {steps.length}
          </div>
        </div>
        <Progress value={progress} className="h-1" />
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-32 px-4">
        <div className="container max-w-2xl mx-auto">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-sm text-[#FF6A00] uppercase tracking-wide">
                {steps[currentStep - 1]?.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderStep()}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0B0B0C]/95 backdrop-blur-sm border-t border-white/10">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          {currentStep < steps.length ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-[#FF6A00] hover:bg-[#FF6A00]/90"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="bg-[#1ED760] hover:bg-[#1ED760]/90"
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Intake"} 
              <Check className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
