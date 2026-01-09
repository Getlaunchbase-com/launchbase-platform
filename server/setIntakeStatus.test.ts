import { describe, it, expect, beforeAll } from "vitest";
import { createIntake, setIntakeStatus, getDb } from "./db";
import { intakeStatusEvents } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("setIntakeStatus", () => {
  let testIntakeId: number;

  beforeAll(async () => {
    // Create a test intake for all tests
    const intake = await createIntake({
      businessName: "Test Business",
      contactName: "Test Contact",
      email: "test@example.com",
      language: "en",
      audience: "biz",
      tenant: "launchbase",
      websiteStatus: "none",
      phone: "1234567890",
      vertical: "trades",
      services: ["general contractor"],
      serviceArea: ["60016"],
      primaryCTA: "call",
      rawPayload: {},
    });
    testIntakeId = intake.id;
  });

  it("rejects invalid transition without override (new → approved)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Get initial event count
    const initialEvents = await db
      .select()
      .from(intakeStatusEvents)
      .where(eq(intakeStatusEvents.intakeId, testIntakeId));
    const initialCount = initialEvents.length;

    // Try invalid transition
    const result = await setIntakeStatus(testIntakeId, "approved", {
      actorType: "system",
      reason: "test",
    });

    // Should reject
    expect(result).toBeDefined();
    expect(result?.ok).toBe(false);
    if (!result?.ok) {
      expect(result.code).toBe("INVALID_TRANSITION");
      expect(result.message).toContain("new → approved");
    }

    // Should not create event
    const finalEvents = await db
      .select()
      .from(intakeStatusEvents)
      .where(eq(intakeStatusEvents.intakeId, testIntakeId));
    expect(finalEvents.length).toBe(initialCount);
  });

  it("requires overrideReason when override=true", async () => {
    // Try override without reason - should throw
    await expect(
      setIntakeStatus(testIntakeId, "approved", {
        actorType: "admin",
        override: true,
        // missing overrideReason
      })
    ).rejects.toThrow("overrideReason is required");
  });

  it("allows override with overrideReason and creates event", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Get initial event count
    const initialEvents = await db
      .select()
      .from(intakeStatusEvents)
      .where(eq(intakeStatusEvents.intakeId, testIntakeId));
    const initialCount = initialEvents.length;

    // Try override with reason - should succeed
    const result = await setIntakeStatus(testIntakeId, "approved", {
      actorType: "admin",
      actorId: "admin123",
      override: true,
      overrideReason: "manual admin fix for testing",
    });

    // Should succeed
    expect(result).toBeDefined();
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.from).toBe("new");
      expect(result.to).toBe("approved");
      expect(result.overridden).toBe(true);
    }

    // Should create event with override=1
    const finalEvents = await db
      .select()
      .from(intakeStatusEvents)
      .where(eq(intakeStatusEvents.intakeId, testIntakeId));
    expect(finalEvents.length).toBe(initialCount + 1);

    const latestEvent = finalEvents[finalEvents.length - 1];
    expect(latestEvent.fromStatus).toBe("new");
    expect(latestEvent.toStatus).toBe("approved");
    expect(latestEvent.actorType).toBe("admin");
    expect(latestEvent.actorId).toBe("admin123");
    expect(latestEvent.override).toBe(1);
    expect(latestEvent.reason).toBe("manual admin fix for testing");
  });

  it("creates event for valid transition", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Reset intake to new status first (using override)
    await setIntakeStatus(testIntakeId, "new", {
      actorType: "system",
      override: true,
      overrideReason: "reset for test",
    });

    // Get initial event count
    const initialEvents = await db
      .select()
      .from(intakeStatusEvents)
      .where(eq(intakeStatusEvents.intakeId, testIntakeId));
    const initialCount = initialEvents.length;

    // Valid transition: new → review
    const result = await setIntakeStatus(testIntakeId, "review", {
      actorType: "system",
      reason: "automated transition",
    });

    // Should succeed
    expect(result).toBeDefined();
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.from).toBe("new");
      expect(result.to).toBe("review");
      expect(result.overridden).toBe(false);
    }

    // Should create event with override=0
    const finalEvents = await db
      .select()
      .from(intakeStatusEvents)
      .where(eq(intakeStatusEvents.intakeId, testIntakeId));
    expect(finalEvents.length).toBe(initialCount + 1);

    const latestEvent = finalEvents[finalEvents.length - 1];
    expect(latestEvent.fromStatus).toBe("new");
    expect(latestEvent.toStatus).toBe("review");
    expect(latestEvent.actorType).toBe("system");
    expect(latestEvent.override).toBe(0);
    expect(latestEvent.reason).toBe("automated transition");
  });
});
