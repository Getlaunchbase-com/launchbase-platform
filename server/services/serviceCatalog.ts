/**
 * Canonical Service Catalog
 * 
 * Single source of truth for what LaunchBase sells.
 * Maps serviceKey → metadata for itemized summaries.
 */

export type ServiceKey = 
  | "website"
  | "email"
  | "social_small"
  | "social_medium"
  | "social_large"
  | "google_business"
  | "quickbooks"
  | "phone";

export interface ServiceMetadata {
  title: string;
  includes: string[]; // Max 3 bullets
  requires: string[]; // Max 2 bullets - customer inputs needed
  nextStep: string;
  priceKey: string; // Matches computePricing keys
}

export const SERVICE_CATALOG: Record<ServiceKey, ServiceMetadata> = {
  website: {
    title: "Website",
    includes: [
      "Custom template with your branding",
      "Mobile-responsive design",
      "Hosting & domain connection"
    ],
    requires: [
      "Business name, services, contact info",
      "Logo (if available)"
    ],
    nextStep: "Preview ready in 24-48 hours",
    priceKey: "website"
  },
  
  email: {
    title: "Email Service",
    includes: [
      "Professional email address (@yourdomain.com)",
      "Gmail integration setup",
      "Inbox & sending configured"
    ],
    requires: [
      "Domain ownership verification",
      "Preferred email addresses"
    ],
    nextStep: "Setup after website approval",
    priceKey: "emailService"
  },
  
  social_small: {
    title: "Social Media (Small - 4 posts/month)",
    includes: [
      "4 posts per month to Facebook",
      "Seasonal & business-aware content",
      "Automated posting schedule"
    ],
    requires: [
      "Facebook page access",
      "Business context & preferences"
    ],
    nextStep: "Connect Facebook after website launch",
    priceKey: "socialMediaTier"
  },
  
  social_medium: {
    title: "Social Media (Medium - 8 posts/month)",
    includes: [
      "8 posts per month to Facebook",
      "Seasonal & business-aware content",
      "Automated posting schedule"
    ],
    requires: [
      "Facebook page access",
      "Business context & preferences"
    ],
    nextStep: "Connect Facebook after website launch",
    priceKey: "socialMediaTier"
  },
  
  social_large: {
    title: "Social Media (Large - 12 posts/month)",
    includes: [
      "12 posts per month to Facebook",
      "Seasonal & business-aware content",
      "Automated posting schedule"
    ],
    requires: [
      "Facebook page access",
      "Business context & preferences"
    ],
    nextStep: "Connect Facebook after website launch",
    priceKey: "socialMediaTier"
  },
  
  google_business: {
    title: "Google Business Profile",
    includes: [
      "Profile setup & optimization",
      "Business hours & service area",
      "Photos & description"
    ],
    requires: [
      "Google account access",
      "Business verification code"
    ],
    nextStep: "Setup + handoff for ongoing management",
    priceKey: "googleBusiness"
  },
  
  quickbooks: {
    title: "QuickBooks Sync",
    includes: [
      "QuickBooks Online connection",
      "Service items & rates setup",
      "Invoice template configuration"
    ],
    requires: [
      "QuickBooks Online account",
      "Service pricing list"
    ],
    nextStep: "Setup + handoff for ongoing use",
    priceKey: "quickBooksSync"
  },
  
  phone: {
    title: "Phone Service",
    includes: [
      "Business phone number setup",
      "Call forwarding configuration",
      "Voicemail setup"
    ],
    requires: [
      "Forwarding number",
      "Voicemail greeting preferences"
    ],
    nextStep: "Setup + handoff for ongoing use",
    priceKey: "phoneService"
  }
};

/**
 * Get service metadata by key
 */
export function getServiceMetadata(serviceKey: ServiceKey): ServiceMetadata {
  return SERVICE_CATALOG[serviceKey];
}

/**
 * Map social media tier to service key
 */
export function getSocialServiceKey(tier: "SMALL" | "MEDIUM" | "LARGE" | null): ServiceKey | null {
  if (!tier) return null;
  
  switch (tier) {
    case "SMALL": return "social_small";
    case "MEDIUM": return "social_medium";
    case "LARGE": return "social_large";
    default: return null;
  }
}
