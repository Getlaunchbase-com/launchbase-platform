# Design Contract

**Philosophy:** LaunchBase is a business-launch + operations system that outputs websites as credentials/signals/containers for ops. Design is a **presentation quality modifier**, not a creative service.

This document defines the **Design Compiler Contract**: tool-agnostic schemas that freeze philosophy, prevent drift, and enable deterministic evaluation.

---

## DesignInput Schema

**Purpose:** Normalized, tool-agnostic input that describes business context and presentation requirements.

**No colors, fonts, or layouts** — only business semantics and constraints.

```typescript
interface DesignInput {
  // Business Context
  industry: IndustryType;
  serviceTypes: string[];
  trustSignals: TrustSignal[];
  geographicScope: "local" | "regional" | "national" | "global";
  
  // Presentation Intent
  brandTone: "neutral" | "professional" | "authoritative" | "approachable";
  tier: "standard" | "enhanced" | "premium";
  devicePriority: "mobile" | "balanced" | "desktop";
  
  // Content Structure (from intake)
  headline: string;
  subheadline: string;
  services: Service[];
  testimonials?: Testimonial[];
  gallery?: GalleryItem[];
  
  // Operational Requirements
  primaryCTA: CTAType;
  bookingLink?: string;
  paymentEnabled: boolean;
  
  // Constraints (non-negotiable)
  maxFonts: 2;
  maxAccentColors: 2;
  requireMobileFirst: boolean;
  requireAccessibility: boolean;
}

type IndustryType = 
  | "trades" // plumber, electrician, HVAC
  | "appointments" // salon, spa, medical
  | "professional" // consultant, lawyer, accountant
  | "retail" // shop, boutique
  | "hospitality" // restaurant, hotel
  | "fitness" // gym, trainer, studio;

type TrustSignal = 
  | "years_in_business"
  | "certifications"
  | "insurance"
  | "reviews"
  | "awards"
  | "associations";

type CTAType = 
  | "call"
  | "book"
  | "quote"
  | "contact"
  | "buy";

interface Service {
  name: string;
  description: string;
  priceRange?: string;
}

interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}

interface GalleryItem {
  url: string;
  alt: string;
  category?: string;
}
```

---

## DesignOutput Schema

**Purpose:** Structured layout tokens that candidates must produce. Forces structure over creativity.

**No HTML/CSS** — only semantic layout decisions.

```typescript
interface DesignOutput {
  // Hero Section
  hero: {
    layoutType: "split-left" | "split-right" | "centered" | "full-bleed";
    headlineSize: "xl" | "2xl" | "3xl"; // Relative scale
    imageTreatment: "photoreal" | "illustration" | "abstract" | "none";
    ctaPosition: "inline" | "below" | "floating";
    trustIndicatorsVisible: boolean;
  };
  
  // Section Ordering & Layout
  sections: SectionLayout[];
  
  // Typography System
  typography: {
    scale: "compact" | "balanced" | "spacious";
    weightContrast: "low" | "medium" | "high"; // Heading vs body weight delta
    maxFonts: 2; // Enforced
    headingFont: "sans" | "serif" | "display";
    bodyFont: "sans" | "serif";
  };
  
  // Spacing System
  spacing: {
    verticalRhythm: "tight" | "balanced" | "loose";
    sectionDensity: "compact" | "standard" | "spacious";
    containerMaxWidth: 1200 | 1400 | 1600; // px
  };
  
  // Color System
  colors: {
    primary: string; // Hex
    secondary?: string; // Optional accent
    neutral: "light" | "dark"; // Background tone
    maxAccentColors: 2; // Enforced
  };
  
  // Mobile Behavior
  mobile: {
    tapTargetScore: number; // 0-1, calculated
    foldClarity: number; // 0-1, above-fold CTA visibility
    stackOrder: "content-first" | "image-first";
  };
  
  // Metadata
  meta: {
    generatedBy: "manus" | "framer" | "lovable" | "manual";
    variantId: string;
    generatedAt: Date;
  };
}

interface SectionLayout {
  type: "services" | "testimonials" | "gallery" | "faq" | "contact" | "trust";
  order: number;
  layout: "grid" | "list" | "carousel" | "masonry";
  itemsPerRow?: 2 | 3 | 4;
  emphasis: "low" | "medium" | "high";
}
```

---

## Hard Guardrails (Auto-Reject)

Candidates that violate these rules are **automatically discarded** before scoring:

### Typography
- ❌ More than 2 font families
- ❌ Decorative fonts for body text
- ❌ Centered paragraph text (>3 lines)
- ❌ Body text < 16px
- ❌ Line length > 75 characters

### Color
- ❌ More than 2 accent colors
- ❌ Contrast ratio < 4.5:1 (WCAG AA)
- ❌ Pure black (#000) on pure white (#FFF)

### Layout
- ❌ Non-mobile-safe spacing (fixed px below 768px)
- ❌ Horizontal scroll on mobile
- ❌ Tap targets < 44px
- ❌ CTA not visible above fold (mobile)

### Animation
- ❌ Auto-playing video/audio
- ❌ Parallax effects
- ❌ Excessive motion (>3 animated elements)

---

## Design Philosophy (Non-Negotiable)

**LaunchBase optimizes for:**
1. **Credibility** > Creativity
2. **Clarity** > Cleverness
3. **Conversion** > Aesthetics
4. **Operations** > Originality

**We do NOT compete on:**
- Dribbble-artsy visuals
- Trendy experimental layouts
- Brand-specific expression
- Decorative excess

**We deliver:**
- Clean, modern, professional
- Conversion-focused
- Consistently "good"
- Rarely embarrassing
- Operational correctness

---

## Tier Definitions

### Tier 0: Standard (Default)
- **Candidates:** 1
- **Scoring:** Minimal (guardrails only)
- **Speed:** Fastest
- **Cost:** $0 marginal
- **Customer:** "Gets you live"

### Tier 1: Enhanced Presentation
- **Candidates:** 3-5
- **Scoring:** Full PresentationScore rubric
- **Speed:** +30-60s
- **Cost:** $0 marginal (AI-driven)
- **Customer:** +$99-$199 one-time
- **Promise:** "Enhanced presentation pass for visual clarity"

### Tier 2: Premium AI Presentation (Future)
- **Candidates:** 6+ (includes external AI)
- **Scoring:** Full rubric + external layout models
- **Speed:** +2-5min
- **Cost:** $5-$30 per run
- **Customer:** +$299-$599 one-time
- **Promise:** "Premium presentation pass using advanced layout models"

---

## Extension Points (Future)

Once Tier 1 is stable, external AI tools plug in as **candidate generators**:

- **Framer AI:** Premium aesthetic layer
- **Lovable:** SMB conversion focus
- **Shopify:** Commerce tier

**Key principle:** External tools produce `DesignOutput` candidates that are normalized, scored, and selected by LaunchBase. They are **renderers, not thinkers**.

---

## Success Metrics

Track per tier:
- **Approval rate** (% approved without edits)
- **Time to approval** (SENT → LOCKED)
- **Edit rate** (% requiring customer edits)
- **Escalation rate** (% needing human review)
- **Conversion rate** (post-launch CTA performance)

Feed back into:
- Candidate weighting
- Rule thresholds
- Default selections
- Tier recommendations

**Goal:** System improves automatically via confidence learning.
