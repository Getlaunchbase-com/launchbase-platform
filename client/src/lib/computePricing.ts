// Pricing computation - single source of truth for Step 9 + Stripe checkout

export type ExperienceMode = "CUSTOMER" | "IT_HELPER";
export type SocialTier = "LOW" | "MEDIUM" | "HIGH"; // 4 / 8 / 12 posts

export type PricingInput = {
  website: boolean;
  emailService: boolean; // will be forced true when website=true (caller/UI)
  socialMediaTier?: SocialTier | null;
  enrichmentLayer: boolean;
  googleBusiness: boolean;
  quickBooksSync: boolean;

  // promo
  promoCode?: string | null;
  isFounderReserved?: boolean; // strongest signal (from backend reservation)
};

export type MoneyLine = {
  key: string;
  label: string;
  amountCents: number;
};

export type PricingOutput = {
  setupLineItems: MoneyLine[];
  setupSubtotalCents: number;
  setupDiscountCents: number;
  setupTotalCents: number;

  monthlyLineItems: MoneyLine[];
  monthlyTotalCents: number;

  // helpful for UI banners / validations
  selectedServiceCount: number;
  notes: string[];
};

const PRICES = {
  setup: {
    website: 49900,
    social: 29900, // flat regardless of tier
    enrichment: 19900,
    gmb: 14900,
    qb: 19900,
    email: 9900,
  },
  monthly: {
    website: 4900,
    social: {
      LOW: 7900,    // 4 posts
      MEDIUM: 12900, // 8 posts
      HIGH: 17900,  // 12 posts
    } as const,
    enrichment: 7900,
    gmb: 2900,
    qb: 3900,
    email: 1900,
  },
} as const;

function isFounder(input: PricingInput): boolean {
  // Backend should pass isFounderReserved=true after reservation.
  if (input.isFounderReserved) return true;

  // Optional fallback for UI preview if you want:
  const code = (input.promoCode ?? "").trim().toUpperCase();
  return code === "BETA-FOUNDERS";
}

export function computePricing(input: PricingInput): PricingOutput {
  const notes: string[] = [];

  const hasWebsite = !!input.website;
  const hasSocial = !!input.socialMediaTier;
  const hasEnrichment = hasSocial && !!input.enrichmentLayer;
  const hasGmb = !!input.googleBusiness;
  const hasQb = !!input.quickBooksSync;

  // Email required when Website selected (caller/UI should enforce, but we also guard)
  const hasEmail = hasWebsite ? true : !!input.emailService;
  if (hasWebsite && !input.emailService) {
    notes.push("Email is required when Website is selected (auto-included).");
  }

  // Enrichment only if Social selected
  if (input.enrichmentLayer && !hasSocial) {
    notes.push("Enrichment requires a Social Media tier; enrichment excluded.");
  }

  // Count services for bundle discount eligibility
  // (Count Website + Social + Enrichment + GMB + QB + Email (if website forces it))
  const selectedServiceCount =
    (hasWebsite ? 1 : 0) +
    (hasSocial ? 1 : 0) +
    (hasEnrichment ? 1 : 0) +
    (hasGmb ? 1 : 0) +
    (hasQb ? 1 : 0) +
    (hasEmail ? 1 : 0);

  // Setup line items
  const setupLineItems: MoneyLine[] = [];
  if (hasWebsite) setupLineItems.push({ key: "setup_website", label: "Website setup", amountCents: PRICES.setup.website });
  if (hasEmail) setupLineItems.push({ key: "setup_email", label: "Email setup", amountCents: PRICES.setup.email });
  if (hasSocial) setupLineItems.push({ key: "setup_social", label: "Social Media setup", amountCents: PRICES.setup.social });
  if (hasEnrichment) setupLineItems.push({ key: "setup_enrichment", label: "Enrichment layer setup", amountCents: PRICES.setup.enrichment });
  if (hasGmb) setupLineItems.push({ key: "setup_gmb", label: "Google Business setup", amountCents: PRICES.setup.gmb });
  if (hasQb) setupLineItems.push({ key: "setup_qb", label: "QuickBooks sync setup", amountCents: PRICES.setup.qb });

  const setupSubtotalCents = setupLineItems.reduce((sum, li) => sum + li.amountCents, 0);

  // Bundle discount: 50% off Social Media setup when 2+ services selected
  let setupDiscountCents = 0;
  if (selectedServiceCount >= 2 && hasSocial) {
    const discount = Math.round(PRICES.setup.social * 0.5);
    setupDiscountCents += discount;
    notes.push("Bundle discount applied: 50% off Social Media setup.");
  }

  // Founder promo: $300 flat setup overrides all setup fees
  if (isFounder(input)) {
    // Founder override ignores other discounts by definition.
    // We still compute them above for transparency, but final total is forced.
    // Discount = subtotal - $300, but never negative (if subtotal < $300, no discount)
    if (setupSubtotalCents > 30000) {
      setupDiscountCents = setupSubtotalCents - 30000; // makes total exactly $300
    } else {
      setupDiscountCents = 0; // subtotal already <= $300, no discount needed
    }
    notes.push("Founder pricing applied: $300 flat setup.");
  }

  const setupTotalCents = Math.max(0, setupSubtotalCents - setupDiscountCents);

  // Monthly line items (starts after launch / next billing cycle)
  const monthlyLineItems: MoneyLine[] = [];
  if (hasWebsite) monthlyLineItems.push({ key: "mo_website", label: "Website hosting & support", amountCents: PRICES.monthly.website });
  if (hasEmail) monthlyLineItems.push({ key: "mo_email", label: "Email service", amountCents: PRICES.monthly.email });

  if (hasSocial && input.socialMediaTier) {
    const tierLabel =
      input.socialMediaTier === "LOW" ? "Social Media (4 posts/mo)" :
      input.socialMediaTier === "MEDIUM" ? "Social Media (8 posts/mo)" :
      "Social Media (12 posts/mo)";

    monthlyLineItems.push({
      key: "mo_social",
      label: tierLabel,
      amountCents: PRICES.monthly.social[input.socialMediaTier],
    });
  }

  if (hasEnrichment) monthlyLineItems.push({ key: "mo_enrichment", label: "Enrichment layer", amountCents: PRICES.monthly.enrichment });
  if (hasGmb) monthlyLineItems.push({ key: "mo_gmb", label: "Google Business management", amountCents: PRICES.monthly.gmb });
  if (hasQb) monthlyLineItems.push({ key: "mo_qb", label: "QuickBooks sync", amountCents: PRICES.monthly.qb });

  const monthlyTotalCents = monthlyLineItems.reduce((sum, li) => sum + li.amountCents, 0);

  return {
    setupLineItems,
    setupSubtotalCents,
    setupDiscountCents,
    setupTotalCents,
    monthlyLineItems,
    monthlyTotalCents,
    selectedServiceCount,
    notes,
  };
}

// Helper to format cents as dollars
export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
