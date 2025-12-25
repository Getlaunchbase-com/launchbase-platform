import { useState } from "react";
import { useLocation } from "wouter";
import { 
  ArrowLeft, Building2, Facebook, Calculator, 
  Check, ExternalLink, Copy, Download,
  ChevronRight, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Integration definitions
const integrations = [
  {
    id: "google_business" as const,
    name: "Google Business Profile",
    icon: Building2,
    description: "Get found on Google Search and Maps. We prepare your business name, description, categories, hours, and review response templates.",
    color: "bg-blue-500",
    benefits: [
      "Appear in local search results",
      "Show up on Google Maps",
      "Collect and respond to reviews",
      "Display business hours and contact info"
    ],
  },
  {
    id: "meta" as const,
    name: "Facebook & Instagram",
    icon: Facebook,
    description: "Build your social presence. We prepare your page bio, about section, cover image specs, and first week of content.",
    color: "bg-indigo-500",
    benefits: [
      "Professional Facebook business page",
      "Instagram business profile",
      "Ready-to-post content calendar",
      "Hashtag strategy"
    ],
  },
  {
    id: "quickbooks" as const,
    name: "QuickBooks Online",
    icon: Calculator,
    description: "Get paid faster. We prepare your customer types, service items, invoice templates, and payment terms.",
    color: "bg-green-500",
    benefits: [
      "Professional invoices",
      "Track income and expenses",
      "Service item catalog",
      "Payment terms configured"
    ],
  },
];

type IntegrationType = "google_business" | "meta" | "quickbooks";

interface CopyableFieldProps {
  label: string;
  value: string;
  onCopy: (text: string, label: string) => void;
  multiline?: boolean;
}

function CopyableField({ label, value, onCopy, multiline = false }: CopyableFieldProps) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
          <p className={`text-white ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</p>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          className="flex-shrink-0"
          onClick={() => onCopy(value, label)}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface SetupPacketViewerProps {
  intakeId: number;
  integration: IntegrationType;
}

function SetupPacketViewer({ intakeId, integration }: SetupPacketViewerProps) {
  const { data, isLoading } = trpc.setupPackets.getByType.useQuery({ 
    intakeId, 
    integration 
  });

  const downloadPdf = trpc.setupPackets.downloadPdf.useMutation({
    onSuccess: (data) => {
      // Open PDF in new tab
      window.open(data.url, "_blank");
      toast.success("PDF generated successfully");
    },
    onError: () => {
      toast.error("Failed to generate PDF");
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!data?.packet) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Setup packet not found. Please contact support.</p>
      </div>
    );
  }

  const packet = data.packet;

  return (
    <div className="space-y-6">
      {/* Download PDF Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadPdf.mutate({ intakeId, integration })}
          disabled={downloadPdf.isPending}
          className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
        >
          {downloadPdf.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download PDF
        </Button>
      </div>

      {/* Business Info Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Business Information</h3>
        <div className="grid gap-3">
          <CopyableField label="Business Name" value={packet.business.name} onCopy={copyToClipboard} />
          <CopyableField label="Phone" value={packet.business.phone} onCopy={copyToClipboard} />
          {packet.business.website && (
            <CopyableField label="Website" value={packet.business.website} onCopy={copyToClipboard} />
          )}
          {packet.business.serviceArea.length > 0 && (
            <CopyableField 
              label="Service Area" 
              value={packet.business.serviceArea.join(", ")} 
              onCopy={copyToClipboard} 
            />
          )}
        </div>
      </div>

      {/* Positioning Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Positioning</h3>
        <div className="grid gap-3">
          <CopyableField label="One-Liner" value={packet.positioning.oneLiner} onCopy={copyToClipboard} />
          <CopyableField label="Primary CTA" value={packet.positioning.primaryCTA} onCopy={copyToClipboard} />
          <CopyableField label="Tone" value={packet.positioning.tone} onCopy={copyToClipboard} />
        </div>
      </div>

      {/* Services Section */}
      {packet.services.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Services</h3>
          <div className="space-y-2">
            {packet.services.map((service: { name: string; description: string; priceHint: string | null }, i: number) => (
              <div key={i} className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{service.name}</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyToClipboard(service.name, "Service name")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-zinc-400 mt-1">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Integration-Specific Content */}
      {"specific" in packet && packet.specific && (
        <>
          {packet.integration === "google_business" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Google Business Profile</h3>
              <div className="grid gap-3">
                <CopyableField 
                  label="Primary Category" 
                  value={(packet.specific as { primaryCategory: string }).primaryCategory} 
                  onCopy={copyToClipboard} 
                />
                <CopyableField 
                  label="Description (750 char)" 
                  value={(packet.specific as { description: string }).description} 
                  onCopy={copyToClipboard} 
                  multiline
                />
              </div>
              
              {(packet.specific as { reviewResponseTemplates?: { positive: string; negative: string } }).reviewResponseTemplates && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-300">Review Response Templates</h4>
                  <CopyableField 
                    label="Positive Review" 
                    value={(packet.specific as { reviewResponseTemplates: { positive: string } }).reviewResponseTemplates.positive} 
                    onCopy={copyToClipboard} 
                    multiline
                  />
                  <CopyableField 
                    label="Negative Review" 
                    value={(packet.specific as { reviewResponseTemplates: { negative: string } }).reviewResponseTemplates.negative} 
                    onCopy={copyToClipboard} 
                    multiline
                  />
                </div>
              )}
            </div>
          )}

          {packet.integration === "meta" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Facebook & Instagram</h3>
              <div className="grid gap-3">
                <CopyableField 
                  label="Page Bio (160 char)" 
                  value={(packet.specific as { pageBio: string }).pageBio} 
                  onCopy={copyToClipboard} 
                />
                <CopyableField 
                  label="About Section" 
                  value={(packet.specific as { aboutSection: string }).aboutSection} 
                  onCopy={copyToClipboard} 
                  multiline
                />
                <CopyableField 
                  label="Pinned Post Draft" 
                  value={(packet.specific as { pinnedPostDraft: string }).pinnedPostDraft} 
                  onCopy={copyToClipboard} 
                  multiline
                />
              </div>
              
              {(packet.specific as { hashtagStrategy?: string[] }).hashtagStrategy?.length && (
                <CopyableField 
                  label="Hashtags" 
                  value={(packet.specific as { hashtagStrategy: string[] }).hashtagStrategy.join(" ")} 
                  onCopy={copyToClipboard} 
                />
              )}
            </div>
          )}

          {packet.integration === "quickbooks" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">QuickBooks Online</h3>
              
              {(packet.specific as { serviceItems?: Array<{ name: string; description: string; rate: number | null }> }).serviceItems?.length && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-300">Service Items</h4>
                  {(packet.specific as { serviceItems: Array<{ name: string; description: string; rate: number | null }> }).serviceItems.map((item, i) => (
                    <div key={i} className="bg-zinc-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{item.name}</span>
                        {item.rate && <span className="text-green-400">${item.rate}</span>}
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">{item.description}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {(packet.specific as { invoiceTemplate?: { terms: string; notes: string } }).invoiceTemplate && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-300">Invoice Settings</h4>
                  <CopyableField 
                    label="Payment Terms" 
                    value={(packet.specific as { invoiceTemplate: { terms: string } }).invoiceTemplate.terms} 
                    onCopy={copyToClipboard} 
                  />
                  <CopyableField 
                    label="Invoice Notes" 
                    value={(packet.specific as { invoiceTemplate: { notes: string } }).invoiceTemplate.notes} 
                    onCopy={copyToClipboard} 
                    multiline
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Setup Steps */}
      {packet.setupSteps.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Setup Steps</h3>
          <div className="space-y-3">
            {packet.setupSteps.map((step: { step: number; title: string; instructions: string; deepLink?: string }, i: number) => (
              <div key={i} className="flex gap-3 bg-zinc-800/50 rounded-lg p-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center text-sm font-medium">
                  {step.step}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{step.title}</p>
                  <p className="text-sm text-zinc-400 mt-1">{step.instructions}</p>
                  {step.deepLink && (
                    <a 
                      href={step.deepLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-orange-400 hover:text-orange-300 mt-2 inline-flex items-center gap-1"
                    >
                      Open setup page
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets Needed */}
      {packet.assetsNeeded.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Assets You'll Need</h3>
          <div className="space-y-2">
            {packet.assetsNeeded.map((asset: { item: string; priority: string; note: string }, i: number) => (
              <div key={i} className="flex items-start gap-3 bg-zinc-800/50 rounded-lg p-3">
                <Badge variant={asset.priority === "high" ? "destructive" : asset.priority === "medium" ? "default" : "secondary"}>
                  {asset.priority}
                </Badge>
                <div>
                  <p className="font-medium text-white">{asset.item}</p>
                  <p className="text-sm text-zinc-400">{asset.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Integrations() {
  const [, setLocation] = useLocation();
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationType | null>(null);
  
  // For demo, using a fixed intake ID - in production this would come from auth context
  const intakeId = 120001;
  
  const { data: packets, isLoading } = trpc.setupPackets.getForIntake.useQuery({ intakeId });
  
  const getPacketStatus = (integrationId: IntegrationType): string => {
    if (isLoading || !packets) return "loading";
    const packetData = packets[integrationId === "google_business" ? "google" : integrationId];
    if (!packetData) return "not_generated";
    return packetData.status || "ready";
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/expand")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Expand
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Setup Packets</h1>
              <p className="text-sm text-zinc-400">Everything prepared for your integrations</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Philosophy Banner */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
          <p className="text-zinc-300 text-center">
            <span className="text-orange-400 font-medium">LaunchBase prepares everything first</span> — 
            then you decide how much you want automated. Click any card to view your setup packet.
          </p>
        </div>

        {/* Integration Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {integrations.map((integration) => {
            const status = getPacketStatus(integration.id);
            const Icon = integration.icon;
            
            return (
              <Card 
                key={integration.id}
                className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                onClick={() => setSelectedIntegration(integration.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl ${integration.color} flex items-center justify-center`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <Badge 
                      variant={status === "ready" ? "default" : status === "connected" ? "default" : "secondary"}
                      className={status === "connected" ? "bg-green-500/20 text-green-400" : ""}
                    >
                      {status === "ready" && "Ready"}
                      {status === "in_progress" && "In Progress"}
                      {status === "connected" && "Connected"}
                      {status === "loading" && "Loading..."}
                      {status === "not_generated" && "Generating..."}
                    </Badge>
                  </div>
                  <CardTitle className="text-white mt-4">{integration.name}</CardTitle>
                  <CardDescription className="text-zinc-400">
                    {integration.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {integration.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full mt-4 bg-orange-500 hover:bg-orange-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIntegration(integration.id);
                    }}
                  >
                    View Setup Packet
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Setup Packet Dialog */}
        <Dialog open={!!selectedIntegration} onOpenChange={(open) => !open && setSelectedIntegration(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white">
                {selectedIntegration && integrations.find(i => i.id === selectedIntegration)?.name} Setup Packet
              </DialogTitle>
            </DialogHeader>
            {selectedIntegration && (
              <SetupPacketViewer 
                intakeId={intakeId} 
                integration={selectedIntegration} 
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
