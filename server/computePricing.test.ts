import { describe, it, expect } from "vitest";
import { computePricing } from "../client/src/lib/computePricing";

describe("computePricing", () => {
  describe("Basic service pricing", () => {
    it("should calculate website + email pricing correctly", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: null,
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
      });

      expect(result.setupTotalCents).toBe(49900 + 9900); // $499 + $99
      expect(result.monthlyTotalCents).toBe(4900 + 1900); // $49 + $19
      expect(result.setupDiscountCents).toBe(0); // No bundle discount
      expect(result.setupLineItems).toHaveLength(2);
      expect(result.monthlyLineItems).toHaveLength(2);
    });

    it("should calculate social media LOW tier pricing", () => {
      const result = computePricing({
        website: false,
        emailService: false,
        socialMediaTier: "LOW",
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
      });

      expect(result.setupTotalCents).toBe(29900); // $299
      expect(result.monthlyTotalCents).toBe(7900); // $79
      expect(result.setupLineItems).toHaveLength(1);
      expect(result.setupLineItems[0].label).toContain("Social Media");
    });

    it("should calculate social media MEDIUM tier pricing", () => {
      const result = computePricing({
        website: false,
        emailService: false,
        socialMediaTier: "MEDIUM",
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
      });

      expect(result.monthlyTotalCents).toBe(12900); // $129
    });

    it("should calculate social media HIGH tier pricing", () => {
      const result = computePricing({
        website: false,
        emailService: false,
        socialMediaTier: "HIGH",
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
      });

      expect(result.monthlyTotalCents).toBe(17900); // $179
    });
  });

  describe("Bundle discount (50% off Social setup when 2+ services)", () => {
    it("should apply bundle discount when website + social selected", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: "LOW",
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
      });

      // Setup: Website $499 + Email $99 + Social $299 = $897
      // Discount: 50% off Social = $149.50
      // Total: $897 - $149.50 = $747.50
      expect(result.setupSubtotalCents).toBe(49900 + 9900 + 29900);
      expect(result.setupDiscountCents).toBe(14950); // 50% of $299
      expect(result.setupTotalCents).toBe(49900 + 9900 + 29900 - 14950);
    });

    it("should apply bundle discount when social + enrichment selected", () => {
      const result = computePricing({
        website: false,
        emailService: false,
        socialMediaTier: "MEDIUM",
        enrichmentLayer: true,
        googleBusiness: false,
        quickBooksSync: false,
      });

      // Setup: Social $299 + Enrichment $199 = $498
      // Discount: 50% off Social = $149.50
      // Total: $498 - $149.50 = $348.50
      expect(result.setupDiscountCents).toBe(14950);
      expect(result.setupTotalCents).toBe(29900 + 19900 - 14950);
    });

    it("should NOT apply bundle discount when only 1 service selected", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: null,
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
      });

      expect(result.setupDiscountCents).toBe(0);
    });

    it("should NOT apply bundle discount when social not selected", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: null,
        enrichmentLayer: false,
        googleBusiness: true,
        quickBooksSync: true,
      });

      // 4 services but no social = no bundle discount
      expect(result.setupDiscountCents).toBe(0);
    });
  });

  describe("Founder promo override ($300 flat)", () => {
    it("should override total to $300 when founder promo active", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: "HIGH",
        enrichmentLayer: true,
        googleBusiness: true,
        quickBooksSync: true,
        promoCode: "BETA-FOUNDERS",
      });

      // Should override to $300 regardless of selections
      expect(result.setupTotalCents).toBe(30000);
      expect(result.notes).toContain("Founder pricing: $300 flat setup for all services");
    });

    it("should override total to $300 when isFounderReserved=true", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: "LOW",
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
        isFounderReserved: true,
      });

      expect(result.setupTotalCents).toBe(30000);
    });

    it("should NOT apply founder override with invalid promo code", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: null,
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
        promoCode: "INVALID",
      });

      // Should calculate normally
      expect(result.setupTotalCents).toBe(49900 + 9900);
    });
  });

  describe("Service count calculation", () => {
    it("should count website as 1 service", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: null,
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
      });

      // Website counts, email doesn't count separately when required with website
      expect(result.selectedServiceCount).toBe(1);
    });

    it("should count all selected services correctly", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: "MEDIUM",
        enrichmentLayer: true,
        googleBusiness: true,
        quickBooksSync: true,
      });

      // Website (1) + Social (1) + Enrichment (1) + GMB (1) + QB (1) = 5
      // Email doesn't count separately when required with website
      expect(result.selectedServiceCount).toBe(5);
    });
  });

  describe("Edge cases", () => {
    it("should handle no services selected", () => {
      const result = computePricing({
        website: false,
        emailService: false,
        socialMediaTier: null,
        enrichmentLayer: false,
        googleBusiness: false,
        quickBooksSync: false,
      });

      expect(result.setupTotalCents).toBe(0);
      expect(result.monthlyTotalCents).toBe(0);
      expect(result.setupLineItems).toHaveLength(0);
      expect(result.monthlyLineItems).toHaveLength(0);
    });

    it("should handle enrichment without social (should be prevented by UI)", () => {
      const result = computePricing({
        website: false,
        emailService: false,
        socialMediaTier: null,
        enrichmentLayer: true, // This shouldn't happen in UI
        googleBusiness: false,
        quickBooksSync: false,
      });

      // Enrichment requires social, so it should be ignored
      expect(result.setupLineItems.find(item => item.label.includes("Enrichment"))).toBeUndefined();
    });

    it("should handle all services selected with founder promo", () => {
      const result = computePricing({
        website: true,
        emailService: true,
        socialMediaTier: "HIGH",
        enrichmentLayer: true,
        googleBusiness: true,
        quickBooksSync: true,
        isFounderReserved: true,
      });

      // Setup should be $300 flat
      expect(result.setupTotalCents).toBe(30000);
      
      // Monthly should still be calculated normally
      expect(result.monthlyTotalCents).toBeGreaterThan(0);
      expect(result.monthlyLineItems.length).toBeGreaterThan(0);
    });
  });
});
