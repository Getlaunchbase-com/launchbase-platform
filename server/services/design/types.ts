/**
 * Simplified Design Output (v1)
 * 
 * Just layout tokens - no complex schema yet
 * Toggles existing sections/classes instead of generating HTML from scratch
 */

export type DesignOutput = {
  version: "v1";
  variantKey: string; // e.g., "hero_left_trust_inline"
  
  // Design tokens (CSS-level adjustments)
  tokens: {
    maxWidth: "sm" | "md" | "lg"; // Container width
    radius: "md" | "lg"; // Border radius
    sectionGap: "tight" | "normal" | "airy"; // Vertical spacing
    headingScale: "compact" | "default" | "bold"; // Heading size
    ctaStyle: "solid" | "outline"; // CTA button style
    trustPlacement: "hero" | "belowHero"; // Where trust indicators go
    imageStyle: "none" | "stock" | "abstract"; // Hero image treatment
  };
  
  // Layout decisions (section ordering/style)
  layout: {
    hero: "left" | "center"; // Hero layout
    trust: "inline" | "cardRow"; // Trust indicators style
    services: "cards" | "list"; // Services section style
    testimonials: "none" | "single" | "grid"; // Testimonials style
    cta: "heroOnly" | "heroAndBottom"; // CTA placement
  };
};

/**
 * Intake data (from onboarding)
 */
export interface IntakeData {
  businessName: string;
  businessDescription: string;
  customerType: string;
  websiteGoals: string[];
  contactPreference: string;
  serviceArea: string;
  phone: string;
  email: string;
  brandFeel: string;
}

/**
 * Build plan (inferred from intake)
 */
export interface BuildPlan {
  vertical: string;
  tone: string;
  primaryCTA: string;
  confidence: number;
}
