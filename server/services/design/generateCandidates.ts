/**
 * Generate design candidates (variants) for presentation scoring
 * 
 * Tier 1 (Enhanced): 3 variants
 * - Same content, different layout parameters within guardrails
 * - Vary: hero layout, trust placement, CTA styling, spacing, imagery
 * - Never vary: content, meaning, ops wiring
 */

export interface DesignInput {
  // Business Context
  businessName: string;
  vertical: "trades" | "appointments" | "professional";
  services: string[];
  serviceArea?: string;
  phone?: string;
  email?: string;
  
  // Presentation Intent
  brandTone: "neutral" | "professional" | "authoritative" | "approachable";
  tier: "standard" | "enhanced" | "premium";
  primaryCTA: string;
  
  // Build Plan Context
  confidence: number;
}

export interface DesignOutput {
  // Hero Section
  hero: {
    layoutType: "split-left" | "split-right" | "centered" | "full-bleed";
    headlineSize: "xl" | "2xl" | "3xl";
    imageTreatment: "photoreal" | "illustration" | "abstract" | "none";
    ctaPosition: "inline" | "below" | "floating";
    trustIndicatorsVisible: boolean;
  };
  
  // Section Ordering & Layout
  sections: Array<{
    type: "services" | "testimonials" | "gallery" | "faq" | "contact" | "trust";
    order: number;
    layout: "grid" | "list" | "carousel" | "masonry";
    itemsPerRow?: 2 | 3 | 4;
    emphasis: "low" | "medium" | "high";
  }>;
  
  // Typography System
  typography: {
    scale: "compact" | "balanced" | "spacious";
    weightContrast: "low" | "medium" | "high";
    maxFonts: 2;
    headingFont: "sans" | "serif" | "display";
    bodyFont: "sans" | "serif";
  };
  
  // Spacing System
  spacing: {
    verticalRhythm: "tight" | "balanced" | "loose";
    sectionDensity: "compact" | "standard" | "spacious";
    containerMaxWidth: 1200 | 1400 | 1600;
  };
  
  // Color System
  colors: {
    primary: string;
    secondary?: string;
    neutral: "light" | "dark";
    maxAccentColors: 2;
  };
  
  // Mobile Behavior
  mobile: {
    tapTargetScore: number; // 0-1
    foldClarity: number; // 0-1
    stackOrder: "content-first" | "image-first";
  };
  
  // Metadata
  meta: {
    generatedBy: "manus" | "framer" | "lovable" | "manual";
    variantId: string;
    generatedAt: Date;
  };
}

/**
 * Generate design candidates based on tier
 * 
 * @param input - Normalized design input
 * @param count - Number of candidates to generate (1 for standard, 3-5 for enhanced)
 * @returns Array of design output candidates
 */
export function generateCandidates(input: DesignInput, count: number): DesignOutput[] {
  const candidates: DesignOutput[] = [];
  
  if (count === 1) {
    // Standard tier: single default candidate
    candidates.push(generateDefaultCandidate(input));
  } else {
    // Enhanced tier: 3 variants
    candidates.push(generateVariant1_Balanced(input));
    candidates.push(generateVariant2_TrustFirst(input));
    candidates.push(generateVariant3_CTAFocused(input));
  }
  
  return candidates;
}

/**
 * Variant 0: Default (Standard Tier)
 * - Balanced, safe, proven patterns
 * - Works for all verticals
 */
function generateDefaultCandidate(input: DesignInput): DesignOutput {
  return {
    hero: {
      layoutType: "split-left",
      headlineSize: "2xl",
      imageTreatment: "photoreal",
      ctaPosition: "below",
      trustIndicatorsVisible: true,
    },
    sections: [
      { type: "services", order: 1, layout: "grid", itemsPerRow: 3, emphasis: "high" },
      { type: "trust", order: 2, layout: "list", emphasis: "medium" },
      { type: "testimonials", order: 3, layout: "carousel", emphasis: "medium" },
      { type: "contact", order: 4, layout: "list", emphasis: "high" },
    ],
    typography: {
      scale: "balanced",
      weightContrast: "medium",
      maxFonts: 2,
      headingFont: "sans",
      bodyFont: "sans",
    },
    spacing: {
      verticalRhythm: "balanced",
      sectionDensity: "standard",
      containerMaxWidth: 1200,
    },
    colors: {
      primary: getVerticalColor(input.vertical),
      neutral: "light",
      maxAccentColors: 2,
    },
    mobile: {
      tapTargetScore: 0.9,
      foldClarity: 0.85,
      stackOrder: "content-first",
    },
    meta: {
      generatedBy: "manus",
      variantId: "default_balanced",
      generatedAt: new Date(),
    },
  };
}

/**
 * Variant 1: Balanced (Enhanced Tier)
 * - Spacious layout, high readability
 * - Trust signals prominent
 * - Best for professional services
 */
function generateVariant1_Balanced(input: DesignInput): DesignOutput {
  return {
    hero: {
      layoutType: "split-right", // Image on right
      headlineSize: "2xl",
      imageTreatment: "photoreal",
      ctaPosition: "inline", // CTA next to headline
      trustIndicatorsVisible: true,
    },
    sections: [
      { type: "trust", order: 1, layout: "grid", itemsPerRow: 4, emphasis: "high" }, // Trust first
      { type: "services", order: 2, layout: "grid", itemsPerRow: 3, emphasis: "high" },
      { type: "testimonials", order: 3, layout: "list", emphasis: "medium" },
      { type: "contact", order: 4, layout: "list", emphasis: "high" },
    ],
    typography: {
      scale: "spacious", // More breathing room
      weightContrast: "high", // Strong hierarchy
      maxFonts: 2,
      headingFont: "sans",
      bodyFont: "sans",
    },
    spacing: {
      verticalRhythm: "loose", // Airy
      sectionDensity: "spacious",
      containerMaxWidth: 1400,
    },
    colors: {
      primary: getVerticalColor(input.vertical),
      neutral: "light",
      maxAccentColors: 2,
    },
    mobile: {
      tapTargetScore: 0.95,
      foldClarity: 0.9,
      stackOrder: "content-first",
    },
    meta: {
      generatedBy: "manus",
      variantId: "variant1_balanced_spacious",
      generatedAt: new Date(),
    },
  };
}

/**
 * Variant 2: Trust-First (Enhanced Tier)
 * - Trust signals immediately under hero
 * - Compact layout, more content above fold
 * - Best for trades (licensed, insured, years in business)
 */
function generateVariant2_TrustFirst(input: DesignInput): DesignOutput {
  return {
    hero: {
      layoutType: "centered", // Centered hero
      headlineSize: "3xl", // Bigger headline
      imageTreatment: "abstract", // Less literal
      ctaPosition: "below",
      trustIndicatorsVisible: true,
    },
    sections: [
      { type: "trust", order: 1, layout: "grid", itemsPerRow: 4, emphasis: "high" }, // Trust immediately after hero
      { type: "services", order: 2, layout: "grid", itemsPerRow: 4, emphasis: "high" }, // 4-col for compactness
      { type: "testimonials", order: 3, layout: "carousel", emphasis: "medium" },
      { type: "contact", order: 4, layout: "list", emphasis: "high" },
    ],
    typography: {
      scale: "compact", // Tighter
      weightContrast: "medium",
      maxFonts: 2,
      headingFont: "sans",
      bodyFont: "sans",
    },
    spacing: {
      verticalRhythm: "tight", // More content above fold
      sectionDensity: "compact",
      containerMaxWidth: 1200,
    },
    colors: {
      primary: getVerticalColor(input.vertical),
      neutral: "light",
      maxAccentColors: 2,
    },
    mobile: {
      tapTargetScore: 0.88,
      foldClarity: 0.92, // CTA very visible
      stackOrder: "content-first",
    },
    meta: {
      generatedBy: "manus",
      variantId: "variant2_trust_first_compact",
      generatedAt: new Date(),
    },
  };
}

/**
 * Variant 3: CTA-Focused (Enhanced Tier)
 * - CTA inline with hero, highly prominent
 * - Services before trust (conversion focus)
 * - Best for appointments (book now)
 */
function generateVariant3_CTAFocused(input: DesignInput): DesignOutput {
  return {
    hero: {
      layoutType: "split-left", // Copy on left
      headlineSize: "2xl",
      imageTreatment: "photoreal",
      ctaPosition: "floating", // Sticky CTA
      trustIndicatorsVisible: false, // Trust below, not in hero
    },
    sections: [
      { type: "services", order: 1, layout: "list", emphasis: "high" }, // Services first (what you can book)
      { type: "trust", order: 2, layout: "grid", itemsPerRow: 3, emphasis: "medium" }, // Trust after
      { type: "testimonials", order: 3, layout: "carousel", emphasis: "medium" },
      { type: "contact", order: 4, layout: "list", emphasis: "high" },
    ],
    typography: {
      scale: "balanced",
      weightContrast: "high", // Strong CTA contrast
      maxFonts: 2,
      headingFont: "sans",
      bodyFont: "sans",
    },
    spacing: {
      verticalRhythm: "balanced",
      sectionDensity: "standard",
      containerMaxWidth: 1200,
    },
    colors: {
      primary: getVerticalColor(input.vertical),
      secondary: getVerticalAccent(input.vertical), // Accent for CTA
      neutral: "light",
      maxAccentColors: 2,
    },
    mobile: {
      tapTargetScore: 0.92,
      foldClarity: 0.95, // Floating CTA always visible
      stackOrder: "content-first",
    },
    meta: {
      generatedBy: "manus",
      variantId: "variant3_cta_focused",
      generatedAt: new Date(),
    },
  };
}

/**
 * Get primary color by vertical
 */
function getVerticalColor(vertical: string): string {
  const colors = {
    trades: "#FF6A00", // Orange (trust, urgency)
    appointments: "#6366F1", // Indigo (calm, professional)
    professional: "#0EA5E9", // Sky blue (trustworthy, corporate)
  };
  return colors[vertical as keyof typeof colors] || colors.trades;
}

/**
 * Get accent color by vertical
 */
function getVerticalAccent(vertical: string): string {
  const colors = {
    trades: "#FFB347", // Light orange
    appointments: "#A5B4FC", // Light indigo
    professional: "#7DD3FC", // Light sky blue
  };
  return colors[vertical as keyof typeof colors] || colors.trades;
}
