import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Copy,
  Check,
  QrCode,
  Facebook,
  Linkedin,
  Twitter,
  MessageSquare,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface ShareSiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteUrl: string;
  siteSlug: string;
  siteId?: number;
  businessName: string;
}

// Caption templates
const captionTemplates = {
  launch: {
    title: "Just Launched",
    captions: [
      "🚀 We're officially online! Check out our new website and see what we can do for you.",
      "Big news! Our new website is live. Take a look and let us know what you think!",
      "We've been working hard on this — our brand new website is finally here! 🎉",
    ],
  },
  promo: {
    title: "Seasonal Promo",
    captions: [
      "🌟 Special offer this season! Visit our website to learn more about our services.",
      "Looking for quality service? We've got you covered. Check out our website for details!",
      "New season, new opportunities! See how we can help you at our website.",
    ],
  },
  referral: {
    title: "Referral Offer",
    captions: [
      "Know someone who needs our services? Send them our way! Visit our website to learn more.",
      "Spread the word! We'd love to help your friends and family too. Check out our site!",
      "Your referrals mean the world to us. Share our website with someone who could use our help!",
    ],
  },
};

export function ShareSiteModal({
  open,
  onOpenChange,
  siteUrl,
  siteSlug,
  siteId,
  businessName,
}: ShareSiteModalProps) {
  const [copied, setCopied] = useState(false);
  const [captionCopied, setCaptionCopied] = useState<string | null>(null);
  const [selectedCaption, setSelectedCaption] = useState(captionTemplates.launch.captions[0]);

  // Track share events
  const logEvent = trpc.referralAnalytics.logEvent.useMutation();

  // Log share_opened when modal opens
  useEffect(() => {
    if (open) {
      logEvent.mutate({
        eventType: "share_opened",
        siteSlug,
        siteId,
        metadata: { businessName },
      });
    }
  }, [open, siteSlug, siteId, businessName]);

  // Generate referral-tracked URL
  const referralUrl = `/r/${siteSlug}`;
  const fullReferralUrl = `${window.location.origin}${referralUrl}`;
  
  // Customer share URL (with UTM for their own tracking)
  const customerShareUrl = `${siteUrl}?utm_source=customer_share&utm_medium=share&utm_campaign=launch`;

  const copyToClipboard = async (text: string, type: "link" | "caption") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "link") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        logEvent.mutate({
          eventType: "share_copy_link",
          siteSlug,
          siteId,
          metadata: { url: text },
        });
      } else {
        setCaptionCopied(text);
        setTimeout(() => setCaptionCopied(null), 2000);
      }
      toast.success("Copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleSocialShare = (platform: string) => {
    logEvent.mutate({
      eventType: "share_social_clicked",
      siteSlug,
      siteId,
      metadata: { platform },
    });

    const text = encodeURIComponent(`${selectedCaption} ${customerShareUrl}`);
    const url = encodeURIComponent(customerShareUrl);

    let shareUrl = "";
    switch (platform) {
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(selectedCaption)}`;
        break;
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?text=${text}`;
        break;
      case "linkedin":
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      case "sms":
        shareUrl = `sms:?body=${text}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, "_blank", "width=600,height=400");
    }
  };

  const showQRCode = () => {
    logEvent.mutate({
      eventType: "share_qr_shown",
      siteSlug,
      siteId,
    });
  };

  // Generate QR code URL using a free service
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(customerShareUrl)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FF6A00]" />
            Share Your Site
          </DialogTitle>
          <DialogDescription>
            Spread the word about your new website. Every share helps grow your business!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Copy Link Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Website Link</label>
            <div className="flex gap-2">
              <Input
                value={customerShareUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(customerShareUrl, "link")}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              QR Code
              <span className="text-xs text-muted-foreground">
                Great for business cards & shop counters
              </span>
            </label>
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg">
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="w-32 h-32"
                onLoad={showQRCode}
              />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Scan to visit your website instantly
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = qrCodeUrl;
                    link.download = `${siteSlug}-qr-code.png`;
                    link.click();
                  }}
                >
                  Download QR Code
                </Button>
              </div>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Share on Social</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => handleSocialShare("facebook")}
              >
                <Facebook className="w-4 h-4 text-blue-600" />
                Facebook
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => handleSocialShare("twitter")}
              >
                <Twitter className="w-4 h-4 text-sky-500" />
                X / Twitter
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => handleSocialShare("linkedin")}
              >
                <Linkedin className="w-4 h-4 text-blue-700" />
                LinkedIn
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => handleSocialShare("sms")}
              >
                <MessageSquare className="w-4 h-4 text-green-500" />
                SMS
              </Button>
            </div>
          </div>

          {/* Caption Templates */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Suggested Captions</label>
            <Tabs defaultValue="launch" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="launch">Just Launched</TabsTrigger>
                <TabsTrigger value="promo">Seasonal</TabsTrigger>
                <TabsTrigger value="referral">Referral</TabsTrigger>
              </TabsList>
              {Object.entries(captionTemplates).map(([key, template]) => (
                <TabsContent key={key} value={key} className="space-y-2">
                  {template.captions.map((caption, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedCaption === caption
                          ? "border-[#FF6A00] bg-[#FF6A00]/10"
                          : "border-border hover:border-[#FF6A00]/50"
                      }`}
                      onClick={() => setSelectedCaption(caption)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm">{caption}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(caption, "caption");
                          }}
                        >
                          {captionCopied === caption ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* LaunchBase Referral Link (for driving signups) */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Know someone who needs a website?
              </span>
              <Button
                variant="link"
                size="sm"
                className="text-[#FF6A00] gap-1"
                onClick={() => copyToClipboard(fullReferralUrl, "link")}
              >
                Share LaunchBase <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
