/**
 * Generate fixed deterministic input for selector probe
 * 
 * 20 items total:
 * - 2 duplicates by targetKey (test dedupe)
 * - 2 risky/unbuildable items (test avoidance)
 * - 16 normal items (mix of high/medium/low impact)
 */

export interface ProposedChange {
  targetKey: string;
  description: string;
  rationale: string;
  impact: "high" | "medium" | "low";
  buildable: boolean;
}

export function generateFixedInput(): ProposedChange[] {
  return [
    // High impact (6 items)
    {
      targetKey: "hero.headline",
      description: "Rewrite headline to emphasize speed and reliability",
      rationale: "Current headline doesn't communicate core value prop clearly",
      impact: "high",
      buildable: true,
    },
    {
      targetKey: "cta.primary",
      description: "Change CTA from 'Learn More' to 'Start Free Trial'",
      rationale: "Action-oriented CTAs increase conversion by 30%",
      impact: "high",
      buildable: true,
    },
    {
      targetKey: "pricing.layout",
      description: "Switch from horizontal to vertical pricing cards",
      rationale: "Vertical layout improves mobile readability and comparison",
      impact: "high",
      buildable: true,
    },
    {
      targetKey: "testimonials.position",
      description: "Move testimonials above pricing section",
      rationale: "Social proof before pricing reduces friction",
      impact: "high",
      buildable: true,
    },
    {
      targetKey: "nav.sticky",
      description: "Make navigation sticky on scroll",
      rationale: "Improves access to CTA and reduces bounce rate",
      impact: "high",
      buildable: true,
    },
    {
      targetKey: "hero.image",
      description: "Replace stock photo with product screenshot",
      rationale: "Real product visuals build trust and clarity",
      impact: "high",
      buildable: true,
    },

    // Medium impact (8 items)
    {
      targetKey: "footer.links",
      description: "Add FAQ and Support links to footer",
      rationale: "Reduces support inquiries by providing self-service options",
      impact: "medium",
      buildable: true,
    },
    {
      targetKey: "features.icons",
      description: "Add icons to feature list for visual hierarchy",
      rationale: "Icons improve scannability and engagement",
      impact: "medium",
      buildable: true,
    },
    {
      targetKey: "pricing.highlight",
      description: "Add 'Most Popular' badge to middle pricing tier",
      rationale: "Guides decision-making and increases conversions",
      impact: "medium",
      buildable: true,
    },
    {
      targetKey: "hero.subheadline",
      description: "Add subheadline explaining key benefit",
      rationale: "Clarifies value prop for visitors who skim",
      impact: "medium",
      buildable: true,
    },
    {
      targetKey: "testimonials.format",
      description: "Add company logos to testimonials",
      rationale: "Brand recognition increases trust",
      impact: "medium",
      buildable: true,
    },
    {
      targetKey: "features.layout",
      description: "Change features from 3-column to 2-column grid",
      rationale: "Improves mobile layout and reduces cognitive load",
      impact: "medium",
      buildable: true,
    },
    {
      targetKey: "cta.secondary",
      description: "Add secondary CTA 'Watch Demo' below primary",
      rationale: "Provides low-commitment option for hesitant visitors",
      impact: "medium",
      buildable: true,
    },
    {
      targetKey: "pricing.annual",
      description: "Add annual billing toggle with discount badge",
      rationale: "Encourages higher-value commitments",
      impact: "medium",
      buildable: true,
    },

    // Low impact (4 items)
    {
      targetKey: "footer.social",
      description: "Add social media icons to footer",
      rationale: "Provides additional touchpoints for engagement",
      impact: "low",
      buildable: true,
    },
    {
      targetKey: "nav.logo",
      description: "Increase logo size by 20%",
      rationale: "Improves brand visibility",
      impact: "low",
      buildable: true,
    },
    {
      targetKey: "features.spacing",
      description: "Increase spacing between feature blocks",
      rationale: "Improves visual breathing room",
      impact: "low",
      buildable: true,
    },
    {
      targetKey: "testimonials.count",
      description: "Show 6 testimonials instead of 3",
      rationale: "More social proof builds trust",
      impact: "low",
      buildable: true,
    },

    // DUPLICATE (test dedupe) - same targetKey as item 1
    {
      targetKey: "hero.headline",
      description: "Make headline more action-oriented and benefit-focused",
      rationale: "Action-oriented headlines increase engagement",
      impact: "high",
      buildable: true,
    },

    // RISKY/UNBUILDABLE (test avoidance)
    {
      targetKey: "integration.zapier",
      description: "Add Zapier integration for workflow automation",
      rationale: "Expands use cases and increases stickiness",
      impact: "high",
      buildable: false, // Requires backend work, not just design
    },
  ];
}
