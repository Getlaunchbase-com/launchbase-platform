/**
 * Health Dashboard Tests
 * 
 * Verify health metrics endpoint returns correct data structure
 */

import { describe, it, expect } from "vitest";
import { getHealthMetrics } from "../health";

describe("Health Dashboard", () => {
  it("should return health metrics with correct structure", async () => {
    const metrics = await getHealthMetrics();

    // Verify deployments metrics
    expect(metrics.deployments).toBeDefined();
    expect(typeof metrics.deployments.total).toBe("number");
    expect(typeof metrics.deployments.queued).toBe("number");
    expect(typeof metrics.deployments.running).toBe("number");
    expect(typeof metrics.deployments.success).toBe("number");
    expect(typeof metrics.deployments.failed).toBe("number");

    // Verify emails metrics
    expect(metrics.emails).toBeDefined();
    expect(typeof metrics.emails.total).toBe("number");
    expect(typeof metrics.emails.sent).toBe("number");
    expect(typeof metrics.emails.failed).toBe("number");
    expect(typeof metrics.emails.currentSender).toBe("string");

    // Verify Stripe webhooks metrics
    expect(metrics.stripeWebhooks).toBeDefined();
    expect(typeof metrics.stripeWebhooks.total).toBe("number");
    expect(typeof metrics.stripeWebhooks.success).toBe("number");
    expect(typeof metrics.stripeWebhooks.failed).toBe("number");

    // Verify system metrics
    expect(metrics.system).toBeDefined();
    expect(typeof metrics.system.uptime).toBe("number");
    expect(metrics.system.uptime).toBeGreaterThanOrEqual(0);
    expect(metrics.system.startTime).toBeInstanceOf(Date);
    expect(typeof metrics.system.environment).toBe("string");
  });

  it("should return valid email sender based on RESEND_DOMAIN_VERIFIED", async () => {
    const metrics = await getHealthMetrics();
    
    const expectedSender = process.env.RESEND_DOMAIN_VERIFIED === "true"
      ? "support@getlaunchbase.com"
      : "onboarding@resend.dev";
    
    expect(metrics.emails.currentSender).toBe(expectedSender);
  });

  it("should calculate deployment counts correctly", async () => {
    const metrics = await getHealthMetrics();
    
    // Total should equal sum of all statuses
    const sum = metrics.deployments.queued + 
                metrics.deployments.running + 
                metrics.deployments.success + 
                metrics.deployments.failed;
    
    expect(metrics.deployments.total).toBe(sum);
  });

  it("should calculate email counts correctly", async () => {
    const metrics = await getHealthMetrics();
    
    // Total should equal sum of sent + failed
    const sum = metrics.emails.sent + metrics.emails.failed;
    
    expect(metrics.emails.total).toBe(sum);
  });
});
