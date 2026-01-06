import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIntake, getDb } from "./db";
import { intakes } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * INVARIANT TEST: createIntake rawPayload builder
 * 
 * This test locks the "no undefined overwrite" behavior to prevent regression.
 * 
 * Rules:
 * 1. Canonical fields (language, audience, websiteStatus, vertical, email) are always present
 * 2. Optional fields only set if non-nullish (prevents clobber/noise)
 * 3. Caller-provided rawPayload values are preserved (no overwrite with undefined)
 */

describe("createIntake rawPayload builder", () => {
  let testIntakeId: number | undefined;

  afterAll(async () => {
    // Cleanup: delete test intake
    if (testIntakeId) {
      const db = await getDb();
      if (db) {
        await db.delete(intakes).where(eq(intakes.id, testIntakeId));
      }
    }
  });

  it("preserves caller-provided rawPayload values when optional fields are undefined", async () => {
    // SCENARIO: Caller provides rawPayload with phone="111", but passes phone=undefined
    // EXPECTED: rawPayload.phone should remain "111" (not overwritten with undefined)
    
    const result = await createIntake({
      businessName: "Test Business",
      contactName: "Test User",
      email: "test-rawpayload@example.com",
      phone: undefined, // ← undefined should NOT overwrite existing rawPayload.phone
      vertical: "trades",
      language: "en",
      audience: "biz",
      websiteStatus: "systems_only",
      rawPayload: {
        phone: "111", // ← This should be preserved
        customField: "preserved-value",
      },
    }, "new");

    expect(result).not.toBeNull();
    testIntakeId = result?.id;

    // Verify stored rawPayload
    const db = await getDb();
    expect(db).not.toBeNull();
    
    if (db && result?.id) {
      const [stored] = await db
        .select()
        .from(intakes)
        .where(eq(intakes.id, result.id));

      expect(stored).toBeDefined();
      expect(stored.rawPayload).toBeDefined();

      const payload = stored.rawPayload as Record<string, unknown>;

      // INVARIANT 1: Caller-provided rawPayload values are preserved
      expect(payload.phone).toBe("111"); // ← NOT undefined
      expect(payload.customField).toBe("preserved-value");

      // INVARIANT 2: Canonical fields are always present
      expect(payload.businessName).toBe("Test Business");
      expect(payload.contactName).toBe("Test User");
      expect(payload.email).toBe("test-rawpayload@example.com");
      expect(payload.vertical).toBe("trades");
      expect(payload.language).toBe("en");
      expect(payload.audience).toBe("biz");
      expect(payload.websiteStatus).toBe("systems_only");

      // INVARIANT 3: Optional fields are NOT present when undefined
      expect("services" in payload).toBe(false);
      expect("serviceArea" in payload).toBe(false);
      expect("primaryCTA" in payload).toBe(false);
      expect("bookingLink" in payload).toBe(false);
      expect("tagline" in payload).toBe(false);
      expect("brandColors" in payload).toBe(false);
    }
  });

  it("includes optional fields in rawPayload when they are non-nullish", async () => {
    const result = await createIntake({
      businessName: "Test Business 2",
      contactName: "Test User 2",
      email: "test-rawpayload-2@example.com",
      phone: "555-1234", // ← non-nullish, should be included
      vertical: "trades",
      language: "es",
      audience: "org",
      websiteStatus: "existing",
      services: ["Service A", "Service B"],
      serviceArea: ["Chicago, IL"],
      primaryCTA: "book",
      tagline: "Best in town",
    }, "new");

    expect(result).not.toBeNull();
    
    const db = await getDb();
    if (db && result?.id) {
      const [stored] = await db
        .select()
        .from(intakes)
        .where(eq(intakes.id, result.id));

      const payload = stored.rawPayload as Record<string, unknown>;

      // All non-nullish optional fields should be present
      expect(payload.phone).toBe("555-1234");
      expect(payload.services).toEqual(["Service A", "Service B"]);
      expect(payload.serviceArea).toEqual(["Chicago, IL"]);
      expect(payload.primaryCTA).toBe("book");
      expect(payload.tagline).toBe("Best in town");

      // Cleanup
      await db.delete(intakes).where(eq(intakes.id, result.id));
    }
  });

  it("applies defaults for canonical fields when not provided", async () => {
    const result = await createIntake({
      businessName: "Test Business 3",
      contactName: "Test User 3",
      email: "test-rawpayload-3@example.com",
      vertical: "professional",
      // language, audience, websiteStatus not provided → should get defaults
    }, "new");

    expect(result).not.toBeNull();
    
    const db = await getDb();
    if (db && result?.id) {
      const [stored] = await db
        .select()
        .from(intakes)
        .where(eq(intakes.id, result.id));

      const payload = stored.rawPayload as Record<string, unknown>;

      // Defaults should be applied
      expect(payload.language).toBe("en");
      expect(payload.audience).toBe("biz");
      expect(payload.websiteStatus).toBe("none");

      // Cleanup
      await db.delete(intakes).where(eq(intakes.id, result.id));
    }
  });
});
