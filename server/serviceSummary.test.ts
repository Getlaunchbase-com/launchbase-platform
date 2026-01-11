/**
 * FOREVER Tests: Service Summary Parity
 * 
 * These tests lock in the guarantee that:
 * - Quote totals == Checkout totals (same intake)
 * - Version parity is enforced
 * - Determinism/idempotency
 * - Null/legacy intake safety
 * 
 * DO NOT REMOVE OR WEAKEN THESE TESTS.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { intakes } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { buildServiceSummary } from "./services/serviceSummary";
import { computePricing } from "../client/src/lib/computePricing";

describe("Service Summary Parity (FOREVER)", () => {
  let testIntakeId: number;
  
  beforeAll(async () => {
    // Create test intake with representative service selections
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const [intake] = await db.insert(intakes).values({
      businessName: "Test Service Summary Co",
      contactName: "Test Owner",
      email: "test-summary@example.com",
      phone: "555-0123",
      vertical: "trades",
      services: "Test services",
      serviceArea: ["Test City"],
      primaryCTA: "call",
      status: "new",
      tenant: "vinces",
      rawPayload: {
        website: true,
        emailService: true,
        socialMediaTier: "MEDIUM",
        googleBusiness: true,
        quickBooksSync: false,
        phoneService: false,
        promoCode: null,
      },
    }).$returningId();
    
    testIntakeId = intake.id;
  });
  
  afterAll(async () => {
    // Cleanup test intake
    const db = await getDb();
    if (!db) return;
    await db.delete(intakes).where(eq(intakes.id, testIntakeId));
  });
  
  it("Quote totals == Checkout totals (same intake)", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Get intake
    const [intake] = await db.select().from(intakes).where(eq(intakes.id, testIntakeId));
    if (!intake) throw new Error("Test intake not found");
    
    // Derive service selections from rawPayload
    const rawPayload = intake.rawPayload as Record<string, unknown>;
    const selections = {
      website: rawPayload.website === true,
      emailService: rawPayload.emailService === true,
      socialMediaTier: (rawPayload.socialMediaTier as "SMALL" | "MEDIUM" | "LARGE" | null) || null,
      googleBusiness: rawPayload.googleBusiness === true,
      quickBooksSync: rawPayload.quickBooksSync === true,
      phoneService: rawPayload.phoneService === true,
    };
    
    // Compute pricing (what Stripe checkout uses)
    const pricing = computePricing({
      website: selections.website,
      emailService: selections.emailService,
      socialMediaTier: selections.socialMediaTier,
      enrichmentLayer: false,
      googleBusiness: selections.googleBusiness,
      quickBooksSync: selections.quickBooksSync,
      phoneService: selections.phoneService,
      promoCode: null,
      isFounderReserved: false,
    });
    
    // Build service summary (what customer sees in preview)
    const summary = buildServiceSummary(selections, pricing);
    
    // ASSERT: Totals must match exactly
    expect(summary.setupTotal).toBe(pricing.setupTotalCents);
    expect(summary.monthlyTotal).toBe(pricing.monthlyTotalCents);
    
    // ASSERT: Notes should be present (if any)
    expect(summary.notes).toBeDefined();
  });
  
  it("Determinism: Same intake → same totals (idempotency)", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const [intake] = await db.select().from(intakes).where(eq(intakes.id, testIntakeId));
    if (!intake) throw new Error("Test intake not found");
    
    // Derive selections and pricing
    const rawPayload = intake.rawPayload as Record<string, unknown>;
    const selections = {
      website: rawPayload.website === true,
      emailService: rawPayload.emailService === true,
      socialMediaTier: (rawPayload.socialMediaTier as "SMALL" | "MEDIUM" | "LARGE" | null) || null,
      googleBusiness: rawPayload.googleBusiness === true,
      quickBooksSync: rawPayload.quickBooksSync === true,
      phoneService: rawPayload.phoneService === true,
    };
    
    const pricing = computePricing({
      website: selections.website,
      emailService: selections.emailService,
      socialMediaTier: selections.socialMediaTier,
      enrichmentLayer: false,
      googleBusiness: selections.googleBusiness,
      quickBooksSync: selections.quickBooksSync,
      phoneService: selections.phoneService,
      promoCode: null,
      isFounderReserved: false,
    });
    
    // Call buildServiceSummary twice
    const summary1 = buildServiceSummary(selections, pricing);
    const summary2 = buildServiceSummary(selections, pricing);
    
    // ASSERT: Must be identical
    expect(summary1.setupTotal).toBe(summary2.setupTotal);
    expect(summary1.monthlyTotal).toBe(summary2.monthlyTotal);
    expect(summary1.items).toEqual(summary2.items);
  });
  
  it("Null/legacy intake safety: No 500s, safe defaults", () => {
    // Test with empty selections
    const emptySelections = {};
    const emptyPricing = computePricing({
      website: false,
      emailService: false,
      socialMediaTier: null,
      enrichmentLayer: false,
      googleBusiness: false,
      quickBooksSync: false,
      phoneService: false,
      promoCode: null,
      isFounderReserved: false,
    });
    const summary1 = buildServiceSummary(emptySelections, emptyPricing);
    
    // ASSERT: Should return safe defaults, not throw
    expect(summary1.items).toEqual([]);
    expect(summary1.setupTotal).toBe(0);
    expect(summary1.monthlyTotal).toBe(0);
    
    // Test with partial selections
    const partialSelections = {
      website: true,
      // Missing other fields
    };
    const partialPricing = computePricing({
      website: true,
      emailService: false,
      socialMediaTier: null,
      enrichmentLayer: false,
      googleBusiness: false,
      quickBooksSync: false,
      phoneService: false,
      promoCode: null,
      isFounderReserved: false,
    });
    const summary2 = buildServiceSummary(partialSelections, partialPricing);
    
    // ASSERT: Should handle gracefully
    expect(summary2.items.length).toBeGreaterThan(0); // At least website
    expect(summary2.setupTotal).toBeGreaterThan(0);
  });
  
  it("Version parity: Same source for quote & checkout", () => {
    const selections = {
      website: true,
      emailService: true,
      socialMediaTier: "SMALL" as const,
    };
    
    const pricing = computePricing({
      website: true,
      emailService: true,
      socialMediaTier: "SMALL",
      enrichmentLayer: false,
      googleBusiness: false,
      quickBooksSync: false,
      phoneService: false,
      promoCode: null,
      isFounderReserved: false,
    });
    
    const summary = buildServiceSummary(selections, pricing);
    
    // ASSERT: Summary must be consistent with pricing
    expect(summary.setupTotal).toBe(pricing.setupTotalCents);
    expect(summary.monthlyTotal).toBe(pricing.monthlyTotalCents);
  });
  
  it("Service items match catalog entries", () => {
    const selections = {
      website: true,
      emailService: true,
      socialMediaTier: "MEDIUM" as const,
      googleBusiness: true,
    };
    
    const pricing = computePricing({
      website: true,
      emailService: true,
      socialMediaTier: "MEDIUM",
      enrichmentLayer: false,
      googleBusiness: true,
      quickBooksSync: false,
      phoneService: false,
      promoCode: null,
      isFounderReserved: false,
    });
    
    const summary = buildServiceSummary(selections, pricing);
    
    // ASSERT: Items should contain expected services
    const titles = summary.items.map(item => item.title).join(" ");
    expect(titles).toContain("Website");
    expect(titles).toContain("Email");
    expect(titles).toContain("Social Media");
    expect(titles).toContain("Google Business");
    
    // ASSERT: Should not contain unselected services
    expect(titles).not.toContain("QuickBooks");
    expect(titles).not.toContain("Phone");
  });
});
