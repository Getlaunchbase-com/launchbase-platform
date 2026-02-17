/**
 * Service Summary Builder
 *
 * Builds a structured summary of selected services with pricing.
 * Used for checkout flows and order confirmation pages.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceSelection {
  moduleKey?: string;
  key?: string;
  title?: string;
  name?: string;
  includes?: string[];
  features?: string[];
  setupCents?: number;
  setupFee?: number;
  monthlyCents?: number;
  monthlyFee?: number;
  selected?: boolean;
  quantity?: number;
}

interface PricingSnapshot {
  setupFeeCents?: number;
  monthlyFeeCents?: number;
  baseSetupCents?: number;
  baseMonthlyCents?: number;
  discount?: number;
  promoCode?: string;
  items?: Array<{
    key: string;
    title: string;
    setupCents: number;
    monthlyCents: number;
    includes?: string[];
  }>;
}

interface SummaryItem {
  title: string;
  includes: string[];
  setupCents: number;
  monthlyCents: number;
}

interface ServiceSummary {
  items: SummaryItem[];
  setupTotal: number;
  monthlyTotal: number;
}

// ---------------------------------------------------------------------------
// buildServiceSummary
// ---------------------------------------------------------------------------

export function buildServiceSummary(
  serviceSelections: ServiceSelection[] | any[],
  pricingSnapshot: PricingSnapshot | any,
): ServiceSummary {
  const items: SummaryItem[] = [];
  let setupTotal = 0;
  let monthlyTotal = 0;

  if (!serviceSelections || !Array.isArray(serviceSelections)) {
    // If no selections provided, try to build from pricing snapshot
    if (pricingSnapshot?.items && Array.isArray(pricingSnapshot.items)) {
      for (const item of pricingSnapshot.items) {
        const setupCents = item.setupCents ?? 0;
        const monthlyCents = item.monthlyCents ?? 0;
        items.push({
          title: item.title || item.key || "Service",
          includes: item.includes || [],
          setupCents,
          monthlyCents,
        });
        setupTotal += setupCents;
        monthlyTotal += monthlyCents;
      }
    }

    return { items, setupTotal, monthlyTotal };
  }

  for (const selection of serviceSelections) {
    // Skip unselected items
    if (selection.selected === false) continue;

    const title =
      selection.title || selection.name || selection.moduleKey || selection.key || "Service";
    const includes =
      selection.includes || selection.features || [];
    const setupCents =
      selection.setupCents ?? (selection.setupFee ? selection.setupFee * 100 : 0);
    const monthlyCents =
      selection.monthlyCents ?? (selection.monthlyFee ? selection.monthlyFee * 100 : 0);
    const quantity = selection.quantity ?? 1;

    items.push({
      title,
      includes: Array.isArray(includes) ? includes : [],
      setupCents: setupCents * quantity,
      monthlyCents: monthlyCents * quantity,
    });

    setupTotal += setupCents * quantity;
    monthlyTotal += monthlyCents * quantity;
  }

  // Apply discount from pricing snapshot
  if (pricingSnapshot?.discount && pricingSnapshot.discount > 0) {
    const discountCents = pricingSnapshot.discount;
    setupTotal = Math.max(0, setupTotal - discountCents);
    items.push({
      title: pricingSnapshot.promoCode
        ? `Promo: ${pricingSnapshot.promoCode}`
        : "Discount",
      includes: ["Applied discount"],
      setupCents: -discountCents,
      monthlyCents: 0,
    });
  }

  // Use pricing snapshot totals if they exist (snapshot is authoritative)
  if (pricingSnapshot?.setupFeeCents !== undefined) {
    setupTotal = pricingSnapshot.setupFeeCents;
  }
  if (pricingSnapshot?.monthlyFeeCents !== undefined) {
    monthlyTotal = pricingSnapshot.monthlyFeeCents;
  }

  return { items, setupTotal, monthlyTotal };
}
