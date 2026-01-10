import type { DesignOutput, IntakeData, BuildPlan } from "./types";

/**
 * Generate 3 hardcoded design candidates (Tier 1 MVP)
 * 
 * No complex logic yet - just 3 curated layout combos
 * Deterministic, no AI
 */

export function generateCandidates(args: {
  intakeData: IntakeData;
  buildPlan: BuildPlan;
}): Array<{ variantKey: string; design: DesignOutput }> {
  return [
    // Variant 1: Balanced (left hero, trust inline, cards)
    {
      variantKey: "hero_left_trust_inline",
      design: {
        version: "v1",
        variantKey: "hero_left_trust_inline",
        tokens: {
          maxWidth: "lg",
          radius: "lg",
          sectionGap: "normal",
          headingScale: "default",
          ctaStyle: "solid",
          trustPlacement: "hero",
          imageStyle: "stock",
        },
        layout: {
          hero: "left",
          trust: "inline",
          services: "cards",
          testimonials: "single",
          cta: "heroAndBottom",
        },
      },
    },
    
    // Variant 2: Trust-First (centered hero, trust below, airy)
    {
      variantKey: "hero_center_trust_cardRow",
      design: {
        version: "v1",
        variantKey: "hero_center_trust_cardRow",
        tokens: {
          maxWidth: "md",
          radius: "lg",
          sectionGap: "airy",
          headingScale: "bold",
          ctaStyle: "solid",
          trustPlacement: "belowHero",
          imageStyle: "abstract",
        },
        layout: {
          hero: "center",
          trust: "cardRow",
          services: "cards",
          testimonials: "grid",
          cta: "heroAndBottom",
        },
      },
    },
    
    // Variant 3: Compact (left hero, list services, tight spacing)
    {
      variantKey: "compact_left_list_services",
      design: {
        version: "v1",
        variantKey: "compact_left_list_services",
        tokens: {
          maxWidth: "lg",
          radius: "md",
          sectionGap: "tight",
          headingScale: "compact",
          ctaStyle: "outline",
          trustPlacement: "hero",
          imageStyle: "none",
        },
        layout: {
          hero: "left",
          trust: "inline",
          services: "list",
          testimonials: "single",
          cta: "heroOnly",
        },
      },
    },
  ];
}
