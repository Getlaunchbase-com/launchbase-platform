import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Check, Clock, Mail, ArrowRight } from "lucide-react";

export default function ApplySuccess() {
  const [applicationId, setApplicationId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const appId = params.get("app");
    if (appId) {
      setApplicationId(parseInt(appId, 10));
    }
  }, []);

  const { data: application } = trpc.suiteApply.getById.useQuery(
    { id: applicationId! },
    { enabled: !!applicationId }
  );

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0C]/95 backdrop-blur-sm border-b border-white/10">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <Link href="/">
            <img src="/logo-cropped.png" alt="LaunchBase" className="h-8 w-auto" />
          </Link>
        </div>
      </nav>

      <div className="pt-32 pb-20">
        <div className="mx-auto max-w-2xl px-4 text-center">
          {/* Success Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#1ED760]/20">
            <Check className="h-10 w-10 text-[#1ED760]" />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            Application received
          </h1>
          <p className="mt-3 text-lg text-white/70">
            We're building your preview now. You'll receive an email within 24 hours.
          </p>

          {/* What happens next */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <h2 className="text-lg font-medium mb-4">What happens next</h2>
            
            <div className="space-y-4">
              <Step
                number={1}
                title="We review your configuration"
                description="Our team reviews your business type, location, and module settings."
                status="in_progress"
              />
              <Step
                number={2}
                title="We generate your preview"
                description="You'll see exactly what LaunchBase would post for your business."
                status="upcoming"
              />
              <Step
                number={3}
                title="You approve and activate"
                description="Once you're happy, we'll set up billing and go live."
                status="upcoming"
              />
            </div>
          </div>

          {/* Application summary */}
          {application && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
              <h2 className="text-lg font-medium mb-4">Your configuration</h2>
              
              <div className="grid gap-2 text-sm">
                <Row label="Business" value={formatBusinessType(application.businessType)} />
                <Row label="Location" value={`${application.cityZip} (${application.radiusMiles} mi)`} />
                <Row label="Cadence" value={application.cadence} />
                <Row label="Mode" value={application.mode} />
                <Row 
                  label="Layers" 
                  value={formatLayers(application.layers as { weather: true; sports: boolean; community: boolean; trends: boolean })} 
                />
                <div className="my-2 border-t border-white/10" />
                <Row 
                  label="Monthly" 
                  value={`$${(application.pricing as { monthlyTotal: number }).monthlyTotal}/mo`} 
                  highlight 
                />
                <Row 
                  label="Setup" 
                  value={`$${(application.pricing as { setupFee: number }).setupFee}`} 
                />
              </div>
            </div>
          )}

          {/* Contact info */}
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-white/60">
            <Mail className="h-4 w-4" />
            <span>Check your email for updates</span>
          </div>

          {/* CTA */}
          <div className="mt-8">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition"
            >
              Back to home
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  status,
}: {
  number: number;
  title: string;
  description: string;
  status: "complete" | "in_progress" | "upcoming";
}) {
  return (
    <div className="flex gap-4">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
        status === "complete" 
          ? "bg-[#1ED760]/20 text-[#1ED760]"
          : status === "in_progress"
          ? "bg-[#FF6A00]/20 text-[#FF6A00]"
          : "bg-white/10 text-white/50"
      }`}>
        {status === "complete" ? <Check className="h-4 w-4" /> : number}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {status === "in_progress" && (
            <span className="flex items-center gap-1 rounded-full bg-[#FF6A00]/20 px-2 py-0.5 text-xs text-[#FF6A00]">
              <Clock className="h-3 w-3" />
              In progress
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-white/60">{description}</p>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}</span>
      <span className={highlight ? "text-[#FF6A00] font-medium" : "text-white/80"}>{value}</span>
    </div>
  );
}

function formatBusinessType(type: string): string {
  const map: Record<string, string> = {
    TRADES: "Trades & Services",
    FOOD: "Restaurant / Bar / Café",
    RETAIL: "Retail / Shop",
    PRO: "Professional Services",
    OTHER: "Other",
  };
  return map[type] || type;
}

function formatLayers(layers: { weather: true; sports: boolean; community: boolean; trends: boolean }): string {
  const active = ["Weather"];
  if (layers.sports) active.push("Sports");
  if (layers.community) active.push("Community");
  if (layers.trends) active.push("Trends");
  return active.join(", ");
}
