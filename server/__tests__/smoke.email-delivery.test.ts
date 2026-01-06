/**
 * FOREVER CONTRACT: Email Delivery Smoke Test
 * 
 * This test proves the email pipeline works end-to-end:
 * ✅ sendEmail() returns success
 * ✅ email_logs rows are written with correct status
 * ✅ Resend routing is enforced (no fallback allowed when key is present)
 * 
 * This runs in CI via `pnpm smoke` with no human login required.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../db";
import { intakes, emailLogs } from "../../drizzle/schema";
import { sendEmail } from "../email";
import { eq, desc } from "drizzle-orm";
import { ENV } from "../_core/env";

describe.sequential("smoke.email-delivery", () => {
  let testIntakeId: number;
  // Use allowed test email (Resend test mode restriction)
  const testEmail = "vince@vincessnowplow.com";

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Pattern A: Insert + select by unique email (avoids insertId issues)
    await db.insert(intakes).values({
      email: testEmail,
      businessName: "Smoke Test Delivery Co",
      contactName: "Test User",
      vertical: "trades",
      status: "new",
    });

    const [intake] = await db
      .select()
      .from(intakes)
      .where(eq(intakes.email, testEmail))
      .limit(1);

    if (!intake) throw new Error("Failed to create test intake");
    testIntakeId = intake.id;
  });

  it("sendEmail() succeeds and logs to email_logs", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Call sendEmail directly
    const success = await sendEmail(testIntakeId, "intake_confirmation", {
      firstName: "Test",
      businessName: "Smoke Test Delivery Co",
      email: testEmail,
    });

    // Assert success (now returns object with provider)
    expect(success.ok).toBe(true);
    expect(success.provider).toBe("resend");

    // Assert email_logs row exists with Resend delivery (use latest row for delta safety)
    const logs = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.intakeId, testIntakeId))
      .orderBy(desc(emailLogs.sentAt))
      .limit(1);

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].emailType).toBe("intake_confirmation");
    expect(logs[0].recipientEmail).toBe(testEmail);
    expect(logs[0].status).toBe("sent");
    expect(logs[0].deliveryProvider).toBe("resend");
    expect(logs[0].errorMessage).toBeNull();
  });

  it("enforces Resend routing when RESEND_API_KEY is present", async () => {
    // This test proves routing observability
    // If RESEND_API_KEY is set, we MUST use Resend (not notification fallback)
    
    if (!ENV.resendApiKey) {
      console.warn("[Smoke Test] RESEND_API_KEY not set - skipping routing enforcement test");
      return;
    }

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Pattern A: Insert + select by unique email
    const routingEmail = "vince@vincessnowplow.com";
    await db.insert(intakes).values({
      email: routingEmail,
      businessName: "Routing Test Co",
      contactName: "Routing User",
      vertical: "trades",
      status: "new",
    });

    const [routingIntake] = await db
      .select()
      .from(intakes)
      .where(eq(intakes.email, routingEmail))
      .limit(1);

    if (!routingIntake) throw new Error("Failed to create routing test intake");
    const routingIntakeId = routingIntake.id;

    // Capture console logs to verify routing
    const consoleLogs: string[] = [];
    const originalLog = console.log;

    try {
      console.log = (...args: any[]) => {
        consoleLogs.push(args.join(" "));
        originalLog(...args);
      };

      const success = await sendEmail(routingIntakeId, "intake_confirmation", {
        firstName: "Routing User",
        businessName: "Routing Test Co",
        email: routingEmail, // Use allowed test email
      });

      expect(success.ok).toBe(true);
      expect(success.provider).toBe("resend");

      // Assert Resend was used in logs (not notification fallback)
      const resendUsed = consoleLogs.some(log => log.includes("Sent via Resend"));
      const notificationUsed = consoleLogs.some(log => log.includes("Sent via notification"));

      expect(resendUsed).toBe(true);
      expect(notificationUsed).toBe(false);

      // Assert DB shows Resend delivery
      const emailLog = await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.intakeId, routingIntakeId))
        .orderBy(desc(emailLogs.sentAt))
        .limit(1);

      expect(emailLog.length).toBe(1);
      expect(emailLog[0].deliveryProvider).toBe("resend");
      expect(emailLog[0].status).toBe("sent");
      expect(emailLog[0].errorMessage).toBeNull();

      console.log("[Smoke Test] ✅ Resend routing enforced (no fallback)");
    } finally {
      // Restore console.log
      console.log = originalLog;
    }
  });
});
