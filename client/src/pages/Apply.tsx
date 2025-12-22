import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Link } from "wouter";

type BusinessType = "TRADES" | "FOOD" | "RETAIL" | "PRO" | "OTHER";
type Cadence = "LOW" | "MEDIUM" | "HIGH";
type Mode = "AUTO" | "GUIDED" | "CUSTOM";
type StartTiming = "NOW" | "TWO_WEEKS" | "EXPLORING";

type Layers = {
  weather: true;
  sports: boolean;
  community: boolean;
  trends: boolean;
};

type ApplyForm = {
  businessType: BusinessType | null;
  cityZip: string;
  radiusMiles: number;
  cadence: Cadence;
  layers: Layers;
  mode: Mode;
  startTiming: StartTiming | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  termsAccepted: boolean;
};

const STORAGE_KEY = "launchbase_apply_draft_v1";

const CADENCE_MONTHLY: Record<Cadence, number> = {
  LOW: 79,
  MEDIUM: 129,
  HIGH: 199,
};

const LAYER_MONTHLY = {
  sports: 29,
  community: 39,
  trends: 49,
};

const BASE_SETUP_FEE = 249;
const PER_LAYER_SETUP_FEE = 99;

function formatMoney(n: number) {
  return `$${n.toFixed(0)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computePricing(form: ApplyForm) {
  const cadenceMonthly = CADENCE_MONTHLY[form.cadence];
  const enabledLayerKeys = (["sports", "community", "trends"] as const).filter(
    (k) => form.layers[k]
  );
  const layersMonthly = enabledLayerKeys.reduce((sum, k) => sum + LAYER_MONTHLY[k], 0);
  const monthlyTotal = cadenceMonthly + layersMonthly;
  const setupFee = BASE_SETUP_FEE + enabledLayerKeys.length * PER_LAYER_SETUP_FEE;

  return {
    cadenceMonthly,
    enabledLayerKeys,
    layersMonthly,
    monthlyTotal,
    setupFee,
  };
}

const steps = [
  { id: "business", label: "Business" },
  { id: "location", label: "Location" },
  { id: "cadence", label: "Cadence" },
  { id: "layers", label: "Context" },
  { id: "mode", label: "Control" },
  { id: "timing", label: "Start" },
  { id: "contact", label: "Contact" },
  { id: "review", label: "Review" },
] as const;

type StepId = (typeof steps)[number]["id"];

export default function ApplyPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<ApplyForm>(() => {
    const base: ApplyForm = {
      businessType: null,
      cityZip: "",
      radiusMiles: 15,
      cadence: "MEDIUM",
      layers: { weather: true, sports: true, community: false, trends: false },
      mode: "GUIDED",
      startTiming: null,
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      termsAccepted: false,
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<ApplyForm>;
      return {
        ...base,
        ...parsed,
        layers: { ...base.layers, ...(parsed.layers ?? {}), weather: true },
      };
    } catch {
      return base;
    }
  });

  // Autosave draft
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      // ignore
    }
  }, [form]);

  const pricing = useMemo(() => computePricing(form), [form]);
  const currentStep = steps[stepIndex]?.id ?? "business";

  const submitMutation = trpc.suiteApply.submit.useMutation({
    onSuccess: (data) => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = `/apply/success?app=${data.applicationId}`;
    },
    onError: (error) => {
      setSubmitError(error.message);
    },
  });

  function next() {
    setStepIndex((i) => clamp(i + 1, 0, steps.length - 1));
  }

  function back() {
    setStepIndex((i) => clamp(i - 1, 0, steps.length - 1));
  }

  function gotoStep(id: StepId) {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx >= 0 && idx <= stepIndex) setStepIndex(idx);
  }

  const canContinue = useMemo(() => {
    switch (currentStep) {
      case "business":
        return !!form.businessType;
      case "location":
        return form.cityZip.trim().length >= 3 && form.radiusMiles >= 5;
      case "timing":
        return !!form.startTiming;
      case "contact":
        return (
          form.contactName.trim().length >= 2 &&
          form.contactEmail.includes("@") &&
          form.contactPhone.trim().length >= 7
        );
      case "review":
        return form.termsAccepted;
      default:
        return true;
    }
  }, [currentStep, form]);

  async function submit() {
    if (!form.businessType || !form.startTiming) return;
    
    setSubmitError(null);
    
    submitMutation.mutate({
      businessType: form.businessType,
      location: { cityZip: form.cityZip.trim(), radiusMiles: form.radiusMiles },
      module: {
        name: "SOCIAL_MEDIA_INTELLIGENCE" as const,
        cadence: form.cadence,
        mode: form.mode,
        layers: form.layers,
      },
      startTiming: form.startTiming,
      contact: {
        name: form.contactName.trim(),
        email: form.contactEmail.trim(),
        phone: form.contactPhone.trim(),
      },
      pricing: {
        cadenceMonthly: pricing.cadenceMonthly,
        layersMonthly: pricing.layersMonthly,
        monthlyTotal: pricing.monthlyTotal,
        setupFee: pricing.setupFee,
        enabledLayers: pricing.enabledLayerKeys,
      },
      termsAccepted: form.termsAccepted as true,
    });
  }

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <img src="/logo-cropped.png" alt="LaunchBase" className="h-8 w-auto" />
          </Link>
        </div>
      </nav>

      <div className="pt-24 pb-32 lg:pb-12">
        <div className="mx-auto max-w-[1120px] px-4">
          {/* Page Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              <span className="h-2 w-2 rounded-full bg-[#FF6A00]" />
              Founder pricing locks for 12 months
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              Apply for LaunchBase
            </h1>
            <p className="mt-2 max-w-2xl text-white/70">
              3–5 minutes. You'll preview what LaunchBase would run for your business before anything goes live.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* Main Form */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:p-7">
              <Stepper stepIndex={stepIndex} onGoto={gotoStep} />

              <div className="mt-6">
                {currentStep === "business" && (
                  <StepBusinessType
                    value={form.businessType}
                    onChange={(v) => setForm((f) => ({ ...f, businessType: v }))}
                  />
                )}

                {currentStep === "location" && (
                  <StepLocation
                    cityZip={form.cityZip}
                    radiusMiles={form.radiusMiles}
                    onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                  />
                )}

                {currentStep === "cadence" && (
                  <StepCadence
                    cadence={form.cadence}
                    onChange={(cadence) => setForm((f) => ({ ...f, cadence }))}
                  />
                )}

                {currentStep === "layers" && (
                  <StepLayers
                    layers={form.layers}
                    onChange={(layers) => setForm((f) => ({ ...f, layers }))}
                  />
                )}

                {currentStep === "mode" && (
                  <StepMode
                    mode={form.mode}
                    onChange={(mode) => setForm((f) => ({ ...f, mode }))}
                  />
                )}

                {currentStep === "timing" && (
                  <StepTiming
                    value={form.startTiming}
                    onChange={(startTiming) => setForm((f) => ({ ...f, startTiming }))}
                  />
                )}

                {currentStep === "contact" && (
                  <StepContact
                    form={form}
                    onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                  />
                )}

                {currentStep === "review" && (
                  <StepReview
                    form={form}
                    pricing={pricing}
                    onToggleTerms={(v) => setForm((f) => ({ ...f, termsAccepted: v }))}
                  />
                )}
              </div>

              {/* Error Display */}
              {submitError && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {submitError}
                </div>
              )}

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
                  onClick={back}
                  disabled={stepIndex === 0}
                >
                  Back
                </button>

                {currentStep !== "review" ? (
                  <button
                    className={`rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                      canContinue
                        ? "bg-[#FF6A00] text-black hover:brightness-110"
                        : "bg-white/10 text-white/40 cursor-not-allowed"
                    }`}
                    onClick={next}
                    disabled={!canContinue}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    className={`rounded-xl px-5 py-2.5 text-sm font-medium transition flex items-center gap-2 ${
                      canContinue && !submitMutation.isPending
                        ? "bg-[#FF6A00] text-black hover:brightness-110"
                        : "bg-white/10 text-white/40 cursor-not-allowed"
                    }`}
                    onClick={submit}
                    disabled={!canContinue || submitMutation.isPending}
                  >
                    {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitMutation.isPending ? "Submitting..." : "Submit application"}
                  </button>
                )}
              </div>

              <div className="mt-4 text-xs text-white/50">
                Silence is valid. LaunchBase posts only when it's relevant and safe.
              </div>
            </div>

            {/* Pricing Rail */}
            <PricingRail form={form} pricing={pricing} />
          </div>
        </div>
      </div>

      {/* Mobile Summary Bar */}
      <MobileSummaryBar pricing={pricing} />
    </div>
  );
}

/* ----------------------- UI COMPONENTS ----------------------- */

function Stepper({
  stepIndex,
  onGoto,
}: {
  stepIndex: number;
  onGoto: (id: StepId) => void;
}) {
  const pct = Math.round(((stepIndex + 1) / steps.length) * 100);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/70">
          Step {stepIndex + 1} of {steps.length}
        </div>
        <div className="text-sm text-white/50">{pct}%</div>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#FF6A00] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => idx <= stepIndex && onGoto(s.id)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              idx === stepIndex
                ? "bg-[#FF6A00]/20 text-[#FF6A00] border border-[#FF6A00]/50"
                : idx < stepIndex
                ? "bg-white/5 text-white/70 hover:bg-white/10"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            }`}
            disabled={idx > stepIndex}
          >
            {idx < stepIndex && <Check className="w-3 h-3 inline mr-1" />}
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardOption({
  title,
  desc,
  selected,
  onClick,
  badge,
}: {
  title: string;
  desc?: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-[#FF6A00] bg-[#FF6A00]/10"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="font-medium">{title}</div>
        {badge && (
          <span className="rounded-full bg-[#FF6A00]/20 text-[#FF6A00] px-2 py-0.5 text-xs">
            {badge}
          </span>
        )}
      </div>
      {desc && <div className="mt-1 text-sm text-white/60">{desc}</div>}
    </button>
  );
}

function StepBusinessType({
  value,
  onChange,
}: {
  value: BusinessType | null;
  onChange: (v: BusinessType) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Business snapshot</h2>
      <p className="mt-1 text-sm text-white/60">
        This helps LaunchBase choose the right context signals.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CardOption
          title="Trades & Services"
          desc="Plumbing, HVAC, snow removal, contractors"
          selected={value === "TRADES"}
          onClick={() => onChange("TRADES")}
        />
        <CardOption
          title="Restaurant / Bar / Café"
          desc="Food, drinks, hospitality"
          selected={value === "FOOD"}
          onClick={() => onChange("FOOD")}
        />
        <CardOption
          title="Retail / Shop"
          desc="Storefronts, boutiques, convenience"
          selected={value === "RETAIL"}
          onClick={() => onChange("RETAIL")}
        />
        <CardOption
          title="Professional Services"
          desc="Consultants, legal, accounting, agencies"
          selected={value === "PRO"}
          onClick={() => onChange("PRO")}
        />
        <CardOption
          title="Other"
          desc="We'll adapt the system to your workflow"
          selected={value === "OTHER"}
          onClick={() => onChange("OTHER")}
        />
      </div>
    </div>
  );
}

function StepLocation({
  cityZip,
  radiusMiles,
  onChange,
}: {
  cityZip: string;
  radiusMiles: number;
  onChange: (patch: Partial<Pick<ApplyForm, "cityZip" | "radiusMiles">>) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Location & locality</h2>
      <p className="mt-1 text-sm text-white/60">
        LaunchBase observes what's happening around your business.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <div className="text-sm text-white/70">City or ZIP</div>
          <input
            value={cityZip}
            onChange={(e) => onChange({ cityZip: e.target.value })}
            placeholder="e.g., Phoenix, AZ or 85004"
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-sm outline-none focus:border-[#FF6A00] transition"
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>Service area radius</span>
            <span className="text-[#FF6A00] font-medium">{radiusMiles} miles</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            value={radiusMiles}
            onChange={(e) => onChange({ radiusMiles: Number(e.target.value) })}
            className="mt-3 w-full accent-[#FF6A00]"
          />
          <div className="mt-1 text-xs text-white/50">
            Typical is 10–15 miles.
          </div>
        </label>
      </div>
    </div>
  );
}

function StepCadence({
  cadence,
  onChange,
}: {
  cadence: Cadence;
  onChange: (v: Cadence) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Visibility goal</h2>
      <p className="mt-1 text-sm text-white/60">
        Cadence controls how often you stay visible. Silence is valid.
      </p>

      <div className="mt-4 grid gap-3">
        <CardOption
          title={`Low — ${formatMoney(CADENCE_MONTHLY.LOW)}/mo`}
          desc="1–2 posts/week • Stay present. No noise."
          selected={cadence === "LOW"}
          onClick={() => onChange("LOW")}
        />
        <CardOption
          title={`Medium — ${formatMoney(CADENCE_MONTHLY.MEDIUM)}/mo`}
          desc="2–3 posts/week • Consistent, relevant, professional."
          selected={cadence === "MEDIUM"}
          onClick={() => onChange("MEDIUM")}
          badge="Recommended"
        />
        <CardOption
          title={`High — ${formatMoney(CADENCE_MONTHLY.HIGH)}/mo`}
          desc="4–6 posts/week • Maximum presence when it matters."
          selected={cadence === "HIGH"}
          onClick={() => onChange("HIGH")}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  price,
  desc,
  checked,
  disabled,
  onChange,
  badge,
}: {
  title: string;
  price?: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${disabled ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium">{title}</div>
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                badge === "Included" 
                  ? "bg-[#1ED760]/20 text-[#1ED760]" 
                  : badge === "High impact"
                  ? "bg-[#FF6A00]/20 text-[#FF6A00]"
                  : "bg-white/10 text-white/70"
              }`}>
                {badge}
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-white/60">{desc}</div>
        </div>

        <div className="flex items-center gap-3">
          {price && <div className="text-sm text-white/70">{price}</div>}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`h-7 w-12 rounded-full border border-white/10 p-1 transition ${
              checked ? "bg-[#FF6A00]" : "bg-white/10"
            } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            aria-pressed={checked}
          >
            <div
              className={`h-5 w-5 rounded-full bg-black transition-transform ${
                checked ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepLayers({
  layers,
  onChange,
}: {
  layers: Layers;
  onChange: (v: Layers) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Local context</h2>
      <p className="mt-1 text-sm text-white/60">
        Choose what LaunchBase can reference. Weather is always included for safety gating.
      </p>

      <div className="mt-4 grid gap-3">
        <ToggleRow
          title="Weather & safety conditions"
          desc="Always on. Prevents awkward posts. Ensures relevance and safety."
          checked={true}
          disabled
          onChange={() => {}}
          badge="Included"
        />
        <ToggleRow
          title="Sports & events"
          desc="Game days, local event timing, crowd patterns."
          price={`+${formatMoney(LAYER_MONTHLY.sports)}/mo`}
          checked={layers.sports}
          onChange={(v) => onChange({ ...layers, sports: v })}
          badge="High impact"
        />
        <ToggleRow
          title="Community & schools"
          desc="School schedules, closures, community calendar moments."
          price={`+${formatMoney(LAYER_MONTHLY.community)}/mo`}
          checked={layers.community}
          onChange={(v) => onChange({ ...layers, community: v })}
        />
        <ToggleRow
          title="Local trends"
          desc="What people nearby are actually talking about — gated by weather and relevance."
          price={`+${formatMoney(LAYER_MONTHLY.trends)}/mo`}
          checked={layers.trends}
          onChange={(v) => onChange({ ...layers, trends: v })}
        />
      </div>
    </div>
  );
}

function StepMode({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (v: Mode) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Control style</h2>
      <p className="mt-1 text-sm text-white/60">
        You can switch modes anytime.
      </p>

      <div className="mt-4 grid gap-3">
        <CardOption
          title="Auto"
          desc="LaunchBase decides. You approve major changes only."
          selected={mode === "AUTO"}
          onClick={() => onChange("AUTO")}
        />
        <CardOption
          title="Guided"
          desc="You review and approve posts before they go live."
          selected={mode === "GUIDED"}
          onClick={() => onChange("GUIDED")}
          badge="Most popular"
        />
        <CardOption
          title="Custom"
          desc="Full control with guardrails. Advanced users only."
          selected={mode === "CUSTOM"}
          onClick={() => onChange("CUSTOM")}
        />
      </div>
    </div>
  );
}

function StepTiming({
  value,
  onChange,
}: {
  value: StartTiming | null;
  onChange: (v: StartTiming) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Start timing</h2>
      <p className="mt-1 text-sm text-white/60">
        This helps us prioritize your rollout.
      </p>

      <div className="mt-4 grid gap-3">
        <CardOption
          title="Immediately"
          desc="Ready to move now"
          selected={value === "NOW"}
          onClick={() => onChange("NOW")}
        />
        <CardOption
          title="Within 2 weeks"
          desc="Soon, but not today"
          selected={value === "TWO_WEEKS"}
          onClick={() => onChange("TWO_WEEKS")}
        />
        <CardOption
          title="Just exploring"
          desc="Researching options"
          selected={value === "EXPLORING"}
          onClick={() => onChange("EXPLORING")}
        />
      </div>

      {value === "EXPLORING" && (
        <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60">
          LaunchBase works best for businesses ready to offload this completely. 
          We'll still send you a preview so you can see what's possible.
        </div>
      )}
    </div>
  );
}

function StepContact({
  form,
  onChange,
}: {
  form: ApplyForm;
  onChange: (patch: Partial<ApplyForm>) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Contact</h2>
      <p className="mt-1 text-sm text-white/60">
        We'll send your preview link here.
      </p>

      <div className="mt-5 grid gap-4">
        <input
          value={form.contactName}
          onChange={(e) => onChange({ contactName: e.target.value })}
          placeholder="Full name"
          className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-sm outline-none focus:border-[#FF6A00] transition"
        />
        <input
          type="email"
          value={form.contactEmail}
          onChange={(e) => onChange({ contactEmail: e.target.value })}
          placeholder="Email"
          className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-sm outline-none focus:border-[#FF6A00] transition"
        />
        <input
          type="tel"
          value={form.contactPhone}
          onChange={(e) => onChange({ contactPhone: e.target.value })}
          placeholder="Phone"
          className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-4 py-3 text-sm outline-none focus:border-[#FF6A00] transition"
        />
      </div>
    </div>
  );
}

function StepReview({
  form,
  pricing,
  onToggleTerms,
}: {
  form: ApplyForm;
  pricing: ReturnType<typeof computePricing>;
  onToggleTerms: (v: boolean) => void;
}) {
  const businessLabels: Record<BusinessType, string> = {
    TRADES: "Trades & Services",
    FOOD: "Restaurant / Bar / Café",
    RETAIL: "Retail / Shop",
    PRO: "Professional Services",
    OTHER: "Other",
  };

  return (
    <div>
      <h2 className="text-xl font-semibold">Review</h2>
      <p className="mt-1 text-sm text-white/60">
        Confirm your setup. You'll receive a preview before anything goes live.
      </p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-2 text-sm text-white/75">
          <div className="flex justify-between">
            <span className="text-white/50">Business</span>
            <span>{form.businessType ? businessLabels[form.businessType] : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Area</span>
            <span>{form.cityZip || "-"} ({form.radiusMiles} mi)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Cadence</span>
            <span>{form.cadence}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Mode</span>
            <span>{form.mode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Layers</span>
            <span>
              Weather
              {form.layers.sports && ", Sports"}
              {form.layers.community && ", Community"}
              {form.layers.trends && ", Trends"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Start</span>
            <span>{form.startTiming ?? "-"}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3">
        <input
          id="terms"
          type="checkbox"
          checked={form.termsAccepted}
          onChange={(e) => onToggleTerms(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[#FF6A00]"
        />
        <label htmlFor="terms" className="text-sm text-white/70">
          I understand LaunchBase posts only when it's relevant and safe, and that approvals are required before anything goes live.
        </label>
      </div>
    </div>
  );
}

function PricingRail({
  form,
  pricing,
}: {
  form: ApplyForm;
  pricing: ReturnType<typeof computePricing>;
}) {
  return (
    <div className="sticky top-24 hidden h-fit rounded-2xl border border-white/10 bg-white/5 p-5 lg:block">
      <div className="text-sm text-white/60">Your configuration</div>
      <div className="mt-2 text-lg font-semibold">Social Media Intelligence</div>

      <div className="mt-5 space-y-3 text-sm">
        <LineItem label={`Cadence (${form.cadence})`} value={formatMoney(pricing.cadenceMonthly) + "/mo"} />
        {pricing.enabledLayerKeys.map((k) => (
          <LineItem
            key={k}
            label={
              k === "sports" ? "Sports & Events" : k === "community" ? "Community & Schools" : "Local Trends"
            }
            value={`+${formatMoney(LAYER_MONTHLY[k])}/mo`}
          />
        ))}

        <div className="my-3 border-t border-white/10" />

        <LineItem label="Monthly total" value={formatMoney(pricing.monthlyTotal) + "/mo"} strong />

        <div className="mt-3 rounded-xl border border-white/10 bg-[#0B0B0C] p-3">
          <LineItem label="One-time setup" value={formatMoney(pricing.setupFee)} strong />
          <div className="mt-2 text-xs text-white/50">
            Includes activation + configuration. Add/remove layers anytime.
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1ED760]" />
          Weather-aware and safety-gated
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00]" />
          Silence is valid output
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Preview before activation
        </div>
      </div>
    </div>
  );
}

function LineItem({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className={strong ? "text-white" : "text-white/70"}>{label}</div>
      <div className={strong ? "text-white font-medium" : "text-white/70"}>{value}</div>
    </div>
  );
}

function MobileSummaryBar({
  pricing,
}: {
  pricing: ReturnType<typeof computePricing>;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0B0B0C]/95 backdrop-blur px-4 py-3 lg:hidden z-40">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between">
        <div>
          <div className="text-xs text-white/50">Monthly total</div>
          <div className="text-base font-semibold text-[#FF6A00]">{formatMoney(pricing.monthlyTotal)}/mo</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50">Setup</div>
          <div className="text-sm text-white/80">{formatMoney(pricing.setupFee)}</div>
        </div>
      </div>
    </div>
  );
}
