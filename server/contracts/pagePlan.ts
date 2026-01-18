/**
 * PagePlanV1 Contract
 * 
 * Universal "work order" format for building pages.
 * Prevents Builder from freestyling - all structure is pre-defined.
 * 
 * Constitutional Rules:
 * - Builder executes ONLY what's in the PagePlan
 * - No invention of sections, CTAs, or structure
 * - All content must pass truth-pack validation
 * - Mobile requirements are mandatory, not optional
 */

export type PagePlanV1 = {
  version: "pageplan.v1";
  
  page: {
    slug: string; // URL slug (e.g., "pricing", "how-it-works")
    title: string; // Page title (for <title> and OG tags)
    goal: string; // Conversion goal (e.g., "Get user to start trial")
    primaryCTA: string; // Main call-to-action text
    secondaryCTA?: string; // Optional secondary CTA
  };
  
  sections: Array<{
    id: string; // Unique section ID (e.g., "hero", "pricing_grid")
    type: string; // Section type: "hero" | "pricing_grid" | "faq" | "trust" | "comparison" | "cta"
    headline?: string; // Section headline
    subheadline?: string; // Section subheadline
    bullets?: string[]; // Bullet points or feature list
    proof?: string[]; // Testimonials, stats, logos (truth-pack validated)
    ctas?: Array<{
      label: string; // CTA button text
      href: string; // CTA link
      style: "primary" | "secondary" | "ghost"; // Visual style
    }>;
    notes?: string; // Layout + behavior constraints (e.g., "2-column grid on desktop")
  }>;
  
  constraints: {
    allowedFolders: string[]; // Folders Builder can modify (e.g., ["client/src/pages", "client/src/components/premium"])
    forbiddenFolders: string[]; // Folders Builder must NOT touch (e.g., ["server", "drizzle"])
    mustUseExistingComponents: boolean; // If true, Builder must use existing components only
    mobileRequirements: string[]; // Mobile-specific requirements (e.g., ["Sticky CTA on mobile", "Single-column layout"])
  };
  
  acceptance: {
    mustPass: string[]; // Hard gates (e.g., "All CTAs above the fold on mobile", "Page load < 2s")
    shouldPass: string[]; // Soft gates (e.g., "Lighthouse score > 90", "No accessibility warnings")
  };
};

/**
 * Validate PagePlanV1 structure
 */
export function validatePagePlan(plan: any): plan is PagePlanV1 {
  if (plan.version !== "pageplan.v1") return false;
  if (!plan.page?.slug || !plan.page?.title || !plan.page?.goal) return false;
  if (!Array.isArray(plan.sections)) return false;
  if (!plan.constraints?.allowedFolders || !plan.constraints?.forbiddenFolders) return false;
  if (!plan.acceptance?.mustPass || !plan.acceptance?.shouldPass) return false;
  
  // Validate each section has required fields
  for (const section of plan.sections) {
    if (!section.id || !section.type) return false;
  }
  
  return true;
}

/**
 * Example PagePlan for reference
 */
export const EXAMPLE_PAGE_PLAN: PagePlanV1 = {
  version: "pageplan.v1",
  page: {
    slug: "pricing",
    title: "LaunchBase Pricing - Choose Your Plan",
    goal: "Get user to select a tier and start trial",
    primaryCTA: "Start Free Trial",
    secondaryCTA: "Compare Plans",
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      headline: "Simple, Transparent Pricing",
      subheadline: "Choose the plan that fits your business. Upgrade or downgrade anytime.",
      ctas: [
        { label: "Start Free Trial", href: "/signup", style: "primary" },
        { label: "See How It Works", href: "/how-it-works", style: "secondary" },
      ],
    },
    {
      id: "pricing_grid",
      type: "pricing_grid",
      notes: "3-column grid on desktop, single-column on mobile. Highlight Growth tier.",
    },
    {
      id: "faq",
      type: "faq",
      headline: "Frequently Asked Questions",
      bullets: [
        "Can I change plans anytime?",
        "What happens if I run out of credits?",
        "Do you offer refunds?",
      ],
    },
    {
      id: "final_cta",
      type: "cta",
      headline: "Ready to automate your business?",
      ctas: [
        { label: "Start Free Trial", href: "/signup", style: "primary" },
      ],
    },
  ],
  constraints: {
    allowedFolders: ["client/src/pages/pricing", "client/src/components/premium"],
    forbiddenFolders: ["server", "drizzle", "scripts"],
    mustUseExistingComponents: true,
    mobileRequirements: [
      "Sticky CTA on mobile",
      "Single-column layout below 768px",
      "Tap targets minimum 44px",
    ],
  },
  acceptance: {
    mustPass: [
      "All CTAs above the fold on mobile",
      "Page load < 2s",
      "No broken links",
      "Pricing tiers match database",
    ],
    shouldPass: [
      "Lighthouse score > 90",
      "No accessibility warnings",
      "Mobile-friendly test passes",
    ],
  },
};
