import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve({
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
  })),
}));

import { trackEvent, getFunnelMetrics, getBuildQualityMetrics, getDailyHealth } from "./analytics";

describe("Analytics Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("trackEvent", () => {
    it("should track a page view event", async () => {
      const result = await trackEvent({
        eventName: "page_view_home",
        sessionId: "test_session_123",
      });
      
      expect(result).toBe(true);
    });

    it("should track an onboarding step event with step number", async () => {
      const result = await trackEvent({
        eventName: "onboarding_step_completed",
        sessionId: "test_session_123",
        stepNumber: 3,
        vertical: "trades",
      });
      
      expect(result).toBe(true);
    });

    it("should track an onboarding completion event with intake ID", async () => {
      const result = await trackEvent({
        eventName: "onboarding_completed",
        sessionId: "test_session_123",
        intakeId: 42,
        vertical: "appointments",
      });
      
      expect(result).toBe(true);
    });

    it("should track event with metadata", async () => {
      const result = await trackEvent({
        eventName: "cta_click_start_intake",
        sessionId: "test_session_123",
        metadata: { source: "hero_button", variant: "A" },
      });
      
      expect(result).toBe(true);
    });
  });

  describe("getFunnelMetrics", () => {
    it("should return funnel metrics structure", async () => {
      const metrics = await getFunnelMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty("funnel");
      expect(metrics).toHaveProperty("stepMetrics");
      expect(metrics).toHaveProperty("dropOffByStep");
      expect(metrics).toHaveProperty("period");
    });

    it("should return funnel with expected properties", async () => {
      const metrics = await getFunnelMetrics();
      
      expect(metrics?.funnel).toHaveProperty("homeViews");
      expect(metrics?.funnel).toHaveProperty("ctaClicks");
      expect(metrics?.funnel).toHaveProperty("ctaClickRate");
      expect(metrics?.funnel).toHaveProperty("onboardingStarted");
      expect(metrics?.funnel).toHaveProperty("onboardingCompleted");
      expect(metrics?.funnel).toHaveProperty("completionRate");
      expect(metrics?.funnel).toHaveProperty("sitesDeployed");
    });
  });

  describe("getBuildQualityMetrics", () => {
    it("should return build quality metrics structure", async () => {
      const metrics = await getBuildQualityMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty("buildPlansGenerated");
      expect(metrics).toHaveProperty("clarificationsRequested");
      expect(metrics).toHaveProperty("clarificationRate");
      expect(metrics).toHaveProperty("firstPassApprovals");
      expect(metrics).toHaveProperty("firstPassApprovalRate");
      expect(metrics).toHaveProperty("revisionsRequested");
    });
  });

  describe("getDailyHealth", () => {
    it("should return daily health metrics", async () => {
      const health = await getDailyHealth();
      
      expect(health).toBeDefined();
      expect(health).toHaveProperty("intakesToday");
      expect(health).toHaveProperty("sitesDeployedToday");
      expect(health).toHaveProperty("avgConfidenceScore");
      expect(health).toHaveProperty("date");
    });
  });
});

describe("Analytics Event Types", () => {
  it("should accept valid landing page events", async () => {
    const events = ["page_view_home", "cta_click_start_intake"];
    
    for (const eventName of events) {
      const result = await trackEvent({ eventName: eventName as any });
      expect(result).toBe(true);
    }
  });

  it("should accept valid onboarding events", async () => {
    const events = [
      "onboarding_started",
      "onboarding_step_viewed",
      "onboarding_step_completed",
      "onboarding_completed",
      "onboarding_abandoned",
    ];
    
    for (const eventName of events) {
      const result = await trackEvent({ eventName: eventName as any });
      expect(result).toBe(true);
    }
  });

  it("should accept valid build quality events", async () => {
    const events = [
      "build_plan_generated",
      "clarification_requested",
      "build_approved_first_pass",
      "build_revision_requested",
    ];
    
    for (const eventName of events) {
      const result = await trackEvent({ eventName: eventName as any });
      expect(result).toBe(true);
    }
  });
});
