/**
 * Pricing Computation
 *
 * Computes pricing based on selected modules, tier, and options.
 */

interface PricingLineItem {
  id: string;
  label: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

interface PricingResult {
  total: number;
  lineItems: PricingLineItem[];
  currency: string;
  tier: string;
  discount: number;
}

const MODULE_PRICES: Record<string, number> = {
  domain: 15,
  branding: 50,
  analytics: 20,
  seo: 30,
  blog: 25,
  contact: 10,
  social: 35,
  payments: 45,
};

const TIER_MULTIPLIERS: Record<string, number> = {
  starter: 1.0,
  standard: 1.0,
  professional: 1.5,
  enterprise: 2.0,
};

const TIER_DISCOUNTS: Record<string, number> = {
  starter: 0,
  standard: 0,
  professional: 0.1,
  enterprise: 0.15,
};

export function computePricing(data: {
  modules?: string[];
  tier?: string;
  billingCycle?: "monthly" | "annual";
  addons?: string[];
}): PricingResult {
  const modules = data.modules || [];
  const tier = data.tier || "standard";
  const billingCycle = data.billingCycle || "monthly";

  const multiplier = TIER_MULTIPLIERS[tier] || 1.0;
  const discountRate = TIER_DISCOUNTS[tier] || 0;

  const lineItems: PricingLineItem[] = modules.map((moduleId) => {
    const basePrice = MODULE_PRICES[moduleId] || 20;
    const unitPrice = Math.round(basePrice * multiplier * 100) / 100;
    return {
      id: moduleId,
      label: moduleId.charAt(0).toUpperCase() + moduleId.slice(1),
      unitPrice,
      quantity: 1,
      subtotal: unitPrice,
    };
  });

  // Add platform base fee
  const baseFee: PricingLineItem = {
    id: "platform-base",
    label: "Platform Base Fee",
    unitPrice: 49 * multiplier,
    quantity: 1,
    subtotal: 49 * multiplier,
  };
  lineItems.unshift(baseFee);

  // Apply annual billing discount
  const annualDiscount = billingCycle === "annual" ? 0.1 : 0;

  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalDiscount = discountRate + annualDiscount;
  const discount = Math.round(subtotal * totalDiscount * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;

  return {
    total,
    lineItems,
    currency: "USD",
    tier,
    discount,
  };
}
