// Service card copy for CUSTOMER vs IT_HELPER experience modes

import type { SocialTier, ExperienceMode } from "./computePricing";

type ServiceCopy = {
  title: string;
  oneLiner: string;
  bullets: string[];
  requirements?: string[]; // for IT_HELPER clarity
};

export const serviceCards: Record<
  ExperienceMode,
  {
    website: ServiceCopy;
    email: ServiceCopy;
    social: Record<SocialTier, ServiceCopy>;
    enrichment: ServiceCopy;
    gmb: ServiceCopy;
    qb: ServiceCopy;
  }
> = {
  CUSTOMER: {
    website: {
      title: "Website",
      oneLiner: "A real site you don't have to babysit.",
      bullets: [
        "We build it, host it, and keep it healthy",
        "Forms, SEO basics, mobile-ready",
        "You approve changes before anything goes live",
      ],
    },
    email: {
      title: "Email (required)",
      oneLiner: "So customers can reach you — and you don't miss leads.",
      bullets: [
        "Your contact forms actually deliver",
        "You receive alerts and confirmations",
        "Required for the website to work properly",
      ],
    },
    social: {
      LOW: {
        title: "Social Media — Starter (4 posts/mo)",
        oneLiner: "Stay visible without thinking about it.",
        bullets: [
          "4 posts each month",
          "We write them, schedule them, and show you what's going out",
          "Safer than random posting — always reviewed and logged",
        ],
      },
      MEDIUM: {
        title: "Social Media — Standard (8 posts/mo)",
        oneLiner: "Consistent presence that feels active.",
        bullets: [
          "8 posts each month",
          "Better coverage for weekly promos and seasonal changes",
          "Same safety + visibility, just more cadence",
        ],
      },
      HIGH: {
        title: "Social Media — Pro (12 posts/mo)",
        oneLiner: "High consistency without hiring a marketing person.",
        bullets: [
          "12 posts each month",
          "Best for busy seasons or competitive markets",
          "Still safety-gated and approval-aware",
        ],
      },
    },
    enrichment: {
      title: "Enrichment Layer (premium)",
      oneLiner: "Smarter posts that adapt to context.",
      bullets: [
        "Adds local + seasonal context to posts",
        "Helps content feel less generic",
        "Only available with Social Media",
      ],
    },
    gmb: {
      title: "Google Business",
      oneLiner: "Show up when people search you locally.",
      bullets: [
        "We set up and tune your profile",
        "Keeps your info accurate (hours, services, location)",
        "Improves local visibility and trust",
      ],
    },
    qb: {
      title: "QuickBooks Sync",
      oneLiner: "Less manual billing + fewer dropped balls.",
      bullets: [
        "Connects your workflow to your bookkeeping",
        "Helps keep customer + job info consistent",
        "Reduces admin work over time",
      ],
    },
  },

  IT_HELPER: {
    website: {
      title: "Website",
      oneLiner: "Managed site + change control with audit logs.",
      bullets: [
        "Hosting + SSL + monitoring included",
        "Forms routed reliably (deliverability + logging)",
        "Approval gate before deploy + rollback available",
      ],
      requirements: [
        "Domain/DNS access (or delegate to LaunchBase)",
        "Existing site access if migrating (optional)",
      ],
    },
    email: {
      title: "Email (required)",
      oneLiner: "DNS + mailbox config so form delivery and notifications are reliable.",
      bullets: [
        "Sets up sending/receiving + deliverability basics",
        "Ensures form submissions reach the owner",
        "Supports operational alerts + confirmations",
      ],
      requirements: [
        "DNS access for MX/SPF/DKIM records",
        "Preferred mailbox provider (Google/Microsoft/other)",
      ],
    },
    social: {
      LOW: {
        title: "Social Media — Starter (4 posts/mo)",
        oneLiner: "Low-cadence, safe, logged publishing.",
        bullets: [
          "4 scheduled posts per month",
          "Approval-aware workflow",
          "Audit trail for what/when/why",
        ],
        requirements: [
          "Facebook Page access (admin/editor)",
          "Optional: Instagram connection",
        ],
      },
      MEDIUM: {
        title: "Social Media — Standard (8 posts/mo)",
        oneLiner: "Weekly cadence with safety gating and visibility.",
        bullets: [
          "8 scheduled posts per month",
          "Approval + logging",
          "Better coverage for promotions/seasonality",
        ],
        requirements: [
          "Facebook Page access (admin/editor)",
          "Optional: Instagram connection",
        ],
      },
      HIGH: {
        title: "Social Media — Pro (12 posts/mo)",
        oneLiner: "High cadence without compromising control.",
        bullets: [
          "12 scheduled posts per month",
          "Approval + logging",
          "Best for seasonal spikes or competitive markets",
        ],
        requirements: [
          "Facebook Page access (admin/editor)",
          "Optional: Instagram connection",
        ],
      },
    },
    enrichment: {
      title: "Enrichment Layer (premium)",
      oneLiner: "Context-driven generation layer on top of the posting workflow.",
      bullets: [
        "Adds contextual data (local/seasonal) to improve relevance",
        "Keeps safety gating + approvals intact",
        "Requires Social tier enabled",
      ],
      requirements: [
        "Service area accuracy (city/zip/radius)",
        "Optional: brand voice notes",
      ],
    },
    gmb: {
      title: "Google Business",
      oneLiner: "Profile setup + maintenance for local search presence.",
      bullets: [
        "Verify/claim listing if needed",
        "Configure hours, categories, services, photos",
        "Ongoing updates to prevent stale info",
      ],
      requirements: [
        "Google account access / invite",
        "Business verification steps (may require postcard/phone)",
      ],
    },
    qb: {
      title: "QuickBooks Sync",
      oneLiner: "Integration layer to reduce manual bookkeeping/admin.",
      bullets: [
        "Connects bookkeeping to operational workflows",
        "Reduces duplicate data entry",
        "Keeps records consistent over time",
      ],
      requirements: [
        "QuickBooks Online admin access / invite",
        "Confirm invoice/workflow preferences",
      ],
    },
  },
};
