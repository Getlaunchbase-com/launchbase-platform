/**
 * Admin Email Metrics Router Tests
 * Tests for operational email metrics endpoint
 */

import { describe, test, expect, beforeEach } from "vitest";
import { appRouter } from "../../../routers";
import { getDb } from "../../../db";
import { emailLogs } from "../../../../drizzle/schema";

describe("Admin Email Metrics", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Clean up email logs before each test
    await db.delete(emailLogs);

    // Create a mock context with admin user
    const mockContext = {
      user: {
        id: 1,
        openId: "test-admin",
        name: "Test Admin",
        email: "admin@test.com",
        role: "admin",
      },
      req: {} as any,
      res: {} as any,
    };

    caller = appRouter.createCaller(mockContext);
  });

  test("days parameter clamps to [1, 90]", async () => {
    // Test lower bound
    const result1 = await caller.admin.emailMetrics.getSummary({ days: 0 });
    expect(result1.windowDays).toBe(1);

    // Test upper bound
    const result2 = await caller.admin.emailMetrics.getSummary({ days: 999 });
    expect(result2.windowDays).toBe(90);

    // Test within range
    const result3 = await caller.admin.emailMetrics.getSummary({ days: 30 });
    expect(result3.windowDays).toBe(30);
  });

  test("returns zeros for empty window (no data)", async () => {
    const result = await caller.admin.emailMetrics.getSummary({ days: 7 });

    expect(result.totals.attempts).toBe(0);
    expect(result.totals.sent).toBe(0);
    expect(result.totals.failed).toBe(0);
    expect(result.totals.resendSent).toBe(0);
    expect(result.totals.notificationSent).toBe(0);
    expect(result.totals.idempotencyHits).toBe(0);
    expect(result.totals.idempotencyHitEmails).toBe(0);

    expect(result.rates.successRatePct).toBe(0);
    expect(result.rates.fallbackRatePct).toBe(0);
    expect(result.rates.idempotencyHitRatePct).toBe(0);

    expect(result.topFailureCodes).toEqual([]);
    expect(result.providerEvents).toEqual([]);
  });

  test("tenant filter works correctly", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Insert email logs for different tenants
    // Use timestamp 3 days ago to ensure it's safely within the 7-day query window
    // (avoids race condition where Date.now() in query might be slightly before insert timestamp)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await db.insert(emailLogs).values([
      {
        intakeId: 1,
        tenant: "launchbase",
        emailType: "intake_confirmation",
        recipientEmail: "user@launchbase.com",
        subject: "Test Launchbase",
        status: "sent",
        deliveryProvider: "resend",
        sentAt: threeDaysAgo,
      },
      {
        intakeId: 2,
        tenant: "vinces",
        emailType: "intake_confirmation",
        recipientEmail: "user@vinces.com",
        subject: "Test Vinces",
        status: "sent",
        deliveryProvider: "notification",
        sentAt: threeDaysAgo,
      },
    ]);

    // Query for launchbase only
    const resultA = await caller.admin.emailMetrics.getSummary({ 
      days: 7, 
      tenant: "launchbase" 
    });

    expect(resultA.totals.attempts).toBe(1);
    expect(resultA.totals.resendSent).toBe(1);
    expect(resultA.totals.notificationSent).toBe(0);

    // Query for vinces only
    const resultB = await caller.admin.emailMetrics.getSummary({ 
      days: 7, 
      tenant: "vinces" 
    });

    expect(resultB.totals.attempts).toBe(1);
    expect(resultB.totals.resendSent).toBe(0);
    expect(resultB.totals.notificationSent).toBe(1);

    // Query for all tenants (null)
    const resultAll = await caller.admin.emailMetrics.getSummary({ 
      days: 7, 
      tenant: null 
    });

    expect(resultAll.totals.attempts).toBe(2);
    expect(resultAll.totals.resendSent).toBe(1);
    expect(resultAll.totals.notificationSent).toBe(1);
  });
});
