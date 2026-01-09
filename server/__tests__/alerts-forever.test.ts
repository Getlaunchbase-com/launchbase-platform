/**
 * FOREVER Tests: Alert System Reliability
 * 
 * Forever contracts:
 * 1. Cooldown/dedupe: same fingerprint twice → only 1 email sent
 * 2. Tenant isolation: vinces alerts never appear in launchbase queries
 * 3. Auto-resolve: condition clears → alert status=resolved
 * 4. No time-based flakes: all tests use frozen time via vi.setSystemTime()
 * 
 * These tests prove the alert system is reliable for production ops monitoring.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getDb } from "../db";
import { processAlerts, type HealthSnapshot } from "../_core/alerts";
import { alertEvents, emailLogs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as emailModule from "../email";

// Freeze time to eliminate flakes
const FROZEN_TIME = new Date("2026-01-09T10:00:00Z");

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_TIME);
  
  // Mock email sending to prevent actual Resend API calls
  vi.spyOn(emailModule, "sendEmail").mockResolvedValue(undefined);
  
  // Clean up test data
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(alertEvents);
  await db.delete(emailLogs);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Alert System - Cooldown & Dedupe", () => {
  it("should send email only once for same fingerprint", async () => {
    const snapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 5, sent: 100 }, // Triggers alert (≥3 failures)
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    // First run - should create and send
    const run1 = await processAlerts(snapshot);
    expect(run1.created).toBe(1);
    expect(run1.sent).toBe(1);
    expect(run1.deduped).toBe(0);
    
    // Verify email was sent (check mock)
    expect(emailModule.sendEmail).toHaveBeenCalledTimes(1);
    
    // Second run with same snapshot - should dedupe, NOT send again
    const run2 = await processAlerts(snapshot);
    expect(run2.created).toBe(0);
    expect(run2.sent).toBe(0);
    expect(run2.deduped).toBe(1);
    
    // Verify NO new email was sent
    expect(emailModule.sendEmail).toHaveBeenCalledTimes(1); // Still only 1 call
    
    // Verify alert was updated (lastSeenAt refreshed)
    const db = await getDb();
    const alerts = await db!.select().from(alertEvents);
    expect(alerts.length).toBe(1);
    expect(alerts[0].status).toBe("active");
    expect(alerts[0].lastSeenAt).toEqual(FROZEN_TIME);
  });
  
  it("should send new email when fingerprint changes (bucket escalation)", async () => {
    const snapshot1: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 5, sent: 100 }, // Bucket: "3plus"
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    // First run - 5 failures (bucket: 3plus)
    const run1 = await processAlerts(snapshot1);
    expect(run1.created).toBe(1);
    expect(run1.sent).toBe(1);
    
    // Second run - 12 failures (bucket: 10plus) → NEW fingerprint
    const snapshot2: HealthSnapshot = {
      ...snapshot1,
      emails: { failed: 12, sent: 100 },
    };
    
    const run2 = await processAlerts(snapshot2);
    expect(run2.created).toBe(1); // New alert created (different fingerprint)
    expect(run2.sent).toBe(1); // New email sent
    
    // Verify 2 emails sent total
    expect(emailModule.sendEmail).toHaveBeenCalledTimes(2);
    
    // Verify 2 alerts exist (different fingerprints)
    const db = await getDb();
    const alerts = await db!.select().from(alertEvents);
    expect(alerts.length).toBe(2);
    expect(alerts[0].fingerprint).toContain("3plus");
    expect(alerts[1].fingerprint).toContain("10plus");
  });
});

describe("Alert System - Tenant Isolation", () => {
  it("should isolate vinces alerts from launchbase queries", async () => {
    // Create alert for vinces tenant
    const vincesSnapshot: HealthSnapshot = {
      tenant: "vinces",
      emails: { failed: 5, sent: 100 },
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    await processAlerts(vincesSnapshot);
    
    // Create alert for launchbase tenant
    const launchbaseSnapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 5, sent: 100 },
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    await processAlerts(launchbaseSnapshot);
    
    // Verify alerts are isolated by tenant
    const db = await getDb();
    const vincesAlerts = await db!
      .select()
      .from(alertEvents)
      .where(eq(alertEvents.tenant, "vinces"));
    
    const launchbaseAlerts = await db!
      .select()
      .from(alertEvents)
      .where(eq(alertEvents.tenant, "launchbase"));
    
    expect(vincesAlerts.length).toBe(1);
    expect(launchbaseAlerts.length).toBe(1);
    
    // Verify fingerprints include tenant
    expect(vincesAlerts[0].fingerprint).toContain("vinces");
    expect(launchbaseAlerts[0].fingerprint).toContain("launchbase");
    
    // Verify no cross-tenant pollution
    expect(vincesAlerts[0].fingerprint).not.toContain("launchbase");
    expect(launchbaseAlerts[0].fingerprint).not.toContain("vinces");
  });
  
  it("should not resolve vinces alerts when launchbase condition clears", async () => {
    // Create alert for both tenants
    const snapshot: HealthSnapshot = {
      tenant: "vinces",
      emails: { failed: 5, sent: 100 },
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    await processAlerts(snapshot);
    await processAlerts({ ...snapshot, tenant: "launchbase" });
    
    // Clear condition for launchbase only
    const clearedSnapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 0, sent: 100 }, // Condition cleared
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    const result = await processAlerts(clearedSnapshot);
    expect(result.resolved).toBe(1); // Only launchbase alert resolved
    
    // Verify vinces alert still active
    const db = await getDb();
    const vincesAlerts = await db!
      .select()
      .from(alertEvents)
      .where(
        and(
          eq(alertEvents.tenant, "vinces"),
          eq(alertEvents.status, "active")
        )
      );
    
    expect(vincesAlerts.length).toBe(1); // Vinces alert unaffected
    
    // Verify launchbase alert resolved
    const launchbaseAlerts = await db!
      .select()
      .from(alertEvents)
      .where(
        and(
          eq(alertEvents.tenant, "launchbase"),
          eq(alertEvents.status, "resolved")
        )
      );
    
    expect(launchbaseAlerts.length).toBe(1);
  });
});

describe("Alert System - Auto-Resolve", () => {
  it("should resolve alert when condition clears", async () => {
    // Create alert
    const alertSnapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 5, sent: 100 },
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    const run1 = await processAlerts(alertSnapshot);
    expect(run1.created).toBe(1);
    expect(run1.sent).toBe(1);
    
    // Clear condition
    const clearedSnapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 0, sent: 100 }, // Condition cleared (< 3 failures)
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    const run2 = await processAlerts(clearedSnapshot);
    expect(run2.resolved).toBe(1);
    
    // Verify alert is resolved
    const db = await getDb();
    const alerts = await db!.select().from(alertEvents);
    expect(alerts.length).toBe(1);
    expect(alerts[0].status).toBe("resolved");
    expect(alerts[0].resolvedAt).toEqual(FROZEN_TIME);
  });
  
  it("should not send email when resolving alert", async () => {
    // Create alert
    const alertSnapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 5, sent: 100 },
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    await processAlerts(alertSnapshot);
    
    // Verify 1 email sent
    expect(emailModule.sendEmail).toHaveBeenCalledTimes(1);
    
    // Clear condition
    const clearedSnapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 0, sent: 100 },
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    await processAlerts(clearedSnapshot);
    
    // Verify NO new email sent (resolve is silent)
    expect(emailModule.sendEmail).toHaveBeenCalledTimes(1); // Still only 1 call
  });
  
  it("should handle multiple alerts resolving simultaneously", async () => {
    // Create multiple alerts
    const snapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 5, sent: 100 }, // Alert 1
      stripeWebhooks: { isStale: true, lastEventAt: new Date(Date.now() - 3 * 60 * 60 * 1000), failed: 0, ok: 10, retryEvents: 0 }, // Alert 2
      deployments: { failed: 3, success: 5, queued: 0, running: 0 }, // Alert 3
      system: { uptime: 1000 },
    };
    
    const run1 = await processAlerts(snapshot);
    expect(run1.created).toBe(3); // 3 alerts created
    
    // Clear all conditions
    const clearedSnapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 0, sent: 100 },
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    const run2 = await processAlerts(clearedSnapshot);
    expect(run2.resolved).toBe(3); // All 3 alerts resolved
    
    // Verify all alerts resolved
    const db = await getDb();
    const alerts = await db!.select().from(alertEvents);
    expect(alerts.length).toBe(3);
    expect(alerts.every(a => a.status === "resolved")).toBe(true);
  });
});

describe("Alert System - Time Determinism", () => {
  it("should use frozen time for all timestamps", async () => {
    const snapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 5, sent: 100 },
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    await processAlerts(snapshot);
    
    // Verify all timestamps match frozen time
    const db = await getDb();
    const alerts = await db!.select().from(alertEvents);
    expect(alerts.length).toBe(1);
    expect(alerts[0].firstSeenAt).toEqual(FROZEN_TIME);
    expect(alerts[0].lastSeenAt).toEqual(FROZEN_TIME);
    expect(alerts[0].sentAt).toEqual(FROZEN_TIME);
  });
  
  it("should update lastSeenAt on dedupe with frozen time", async () => {
    const snapshot: HealthSnapshot = {
      tenant: "launchbase",
      emails: { failed: 5, sent: 100 },
      stripeWebhooks: { isStale: false, lastEventAt: new Date(), failed: 0, ok: 10, retryEvents: 0 },
      deployments: { failed: 0, success: 5, queued: 0, running: 0 },
      system: { uptime: 1000 },
    };
    
    // First run
    await processAlerts(snapshot);
    
    // Advance time by 1 hour
    const newTime = new Date(FROZEN_TIME.getTime() + 60 * 60 * 1000);
    vi.setSystemTime(newTime);
    
    // Second run (dedupe)
    await processAlerts(snapshot);
    
    // Verify lastSeenAt updated to new frozen time
    const db = await getDb();
    const alerts = await db!.select().from(alertEvents);
    expect(alerts.length).toBe(1);
    expect(alerts[0].firstSeenAt).toEqual(FROZEN_TIME); // Unchanged
    expect(alerts[0].lastSeenAt).toEqual(newTime); // Updated
  });
});
