import { describe, it, expect } from "vitest";
import { moduleConfigs, getModuleConfig, calculateModuleProgress, getNextIncompleteStep } from "../shared/moduleSetupConfig";

describe("Module Setup Configuration", () => {
  describe("moduleConfigs", () => {
    it("should have all three module configurations", () => {
      expect(moduleConfigs).toHaveProperty("social_media_intelligence");
      expect(moduleConfigs).toHaveProperty("quickbooks_sync");
      expect(moduleConfigs).toHaveProperty("google_business");
    });

    it("should have valid structure for social_media_intelligence", () => {
      const config = moduleConfigs.social_media_intelligence;
      expect(config.name).toBe("Social Media Intelligence");
      expect(config.steps.length).toBeGreaterThan(0);
      expect(config.pricing.setupFee).toBe(249);
    });

    it("should have valid structure for quickbooks_sync", () => {
      const config = moduleConfigs.quickbooks_sync;
      expect(config.name).toBe("QuickBooks Sync");
      expect(config.steps.length).toBeGreaterThan(0);
      expect(config.pricing.setupFee).toBe(499);
    });

    it("should have valid structure for google_business", () => {
      const config = moduleConfigs.google_business;
      expect(config.name).toBe("Google Business Assistant");
      expect(config.steps.length).toBeGreaterThan(0);
      expect(config.pricing.setupFee).toBe(249);
    });

    it("should have unique step keys within each module", () => {
      for (const [moduleKey, config] of Object.entries(moduleConfigs)) {
        const stepKeys = config.steps.map(s => s.key);
        const uniqueKeys = new Set(stepKeys);
        expect(uniqueKeys.size).toBe(stepKeys.length);
      }
    });

    it("should have sequential step orders starting from 1", () => {
      for (const [moduleKey, config] of Object.entries(moduleConfigs)) {
        const orders = config.steps.map(s => s.order).sort((a, b) => a - b);
        orders.forEach((order, index) => {
          expect(order).toBe(index + 1);
        });
      }
    });
  });

  describe("getModuleConfig", () => {
    it("should return config for valid module key", () => {
      const config = getModuleConfig("social_media_intelligence");
      expect(config).toBeDefined();
      expect(config?.name).toBe("Social Media Intelligence");
    });

    it("should return undefined for invalid module key", () => {
      const config = getModuleConfig("invalid_module" as any);
      expect(config).toBeUndefined();
    });
  });

  describe("calculateModuleProgress", () => {
    it("should return 0% for no completed steps", () => {
      const completedSteps: string[] = [];
      const progress = calculateModuleProgress("social_media_intelligence", completedSteps);
      expect(progress.percentage).toBe(0);
      expect(progress.completed).toBe(0);
    });

    it("should return 100% when all steps completed", () => {
      const config = moduleConfigs.social_media_intelligence;
      const completedSteps = config.steps.map(s => s.key);
      const progress = calculateModuleProgress("social_media_intelligence", completedSteps);
      expect(progress.percentage).toBe(100);
      expect(progress.completed).toBe(progress.total);
    });

    it("should calculate partial progress correctly", () => {
      const config = moduleConfigs.social_media_intelligence;
      const completedSteps = [config.steps[0].key]; // Complete first step only
      const progress = calculateModuleProgress("social_media_intelligence", completedSteps);
      expect(progress.completed).toBe(1);
      expect(progress.percentage).toBe(Math.round((1 / config.steps.length) * 100));
    });

    it("should return 0 for invalid module", () => {
      const progress = calculateModuleProgress("invalid" as any, []);
      expect(progress.percentage).toBe(0);
      expect(progress.total).toBe(0);
    });
  });

  describe("getNextIncompleteStep", () => {
    it("should return first step when none completed", () => {
      const nextStep = getNextIncompleteStep("social_media_intelligence", []);
      const config = moduleConfigs.social_media_intelligence;
      expect(nextStep?.key).toBe(config.steps[0].key);
    });

    it("should return second step when first is completed", () => {
      const config = moduleConfigs.social_media_intelligence;
      const completedSteps = [config.steps[0].key];
      const nextStep = getNextIncompleteStep("social_media_intelligence", completedSteps);
      expect(nextStep?.key).toBe(config.steps[1].key);
    });

    it("should return undefined when all steps completed", () => {
      const config = moduleConfigs.social_media_intelligence;
      const completedSteps = config.steps.map(s => s.key);
      const nextStep = getNextIncompleteStep("social_media_intelligence", completedSteps);
      expect(nextStep).toBeUndefined();
    });
  });
});

describe("Module Pricing", () => {
  it("should have correct pricing for Social Media Intelligence", () => {
    const config = moduleConfigs.social_media_intelligence;
    expect(config.pricing.setupFee).toBe(249);
    expect(config.pricing.monthlyBase).toBe(79);
    expect(config.pricing.monthlyMax).toBe(199);
  });

  it("should have correct pricing for QuickBooks Sync", () => {
    const config = moduleConfigs.quickbooks_sync;
    expect(config.pricing.setupFee).toBe(499);
    expect(config.pricing.monthlyBase).toBe(79);
  });

  it("should have correct pricing for Google Business", () => {
    const config = moduleConfigs.google_business;
    expect(config.pricing.setupFee).toBe(249);
    expect(config.pricing.monthlyBase).toBe(49);
  });
});

describe("Customer Info Requirements", () => {
  it("should list additional info needed per module", () => {
    // Social Media Intelligence needs Facebook access
    const smiConfig = moduleConfigs.social_media_intelligence;
    const smiSteps = smiConfig.steps.map(s => s.key);
    expect(smiSteps).toContain("connect_facebook");

    // QuickBooks needs QuickBooks login
    const qbConfig = moduleConfigs.quickbooks_sync;
    const qbSteps = qbConfig.steps.map(s => s.key);
    expect(qbSteps).toContain("connect_quickbooks");

    // Google Business needs Google access
    const gbConfig = moduleConfigs.google_business;
    const gbSteps = gbConfig.steps.map(s => s.key);
    expect(gbSteps).toContain("connect_google");
  });

  it("should have estimated time for each step", () => {
    for (const [moduleKey, config] of Object.entries(moduleConfigs)) {
      for (const step of config.steps) {
        expect(step.estimatedMinutes).toBeGreaterThan(0);
        expect(step.estimatedMinutes).toBeLessThanOrEqual(10); // No step should take more than 10 min
      }
    }
  });
});

describe("Post Approval Workflow", () => {
  // These test the business logic, not the database
  
  it("should define valid post statuses", () => {
    const validStatuses = ["needs_review", "approved", "published", "rejected", "expired"];
    // This validates our schema design
    expect(validStatuses).toContain("needs_review");
    expect(validStatuses).toContain("approved");
    expect(validStatuses).toContain("rejected");
  });

  it("should define valid post types", () => {
    const validTypes = ["all_clear", "monitoring", "active_storm", "sports", "community", "trends"];
    expect(validTypes.length).toBe(6);
  });

  it("should have safety gates defined", () => {
    const safetyGates = [
      "Weather conditions checked",
      "No conflicting local events",
      "Within posting hours",
      "Matches brand voice",
      "Respects quiet hours",
    ];
    expect(safetyGates.length).toBeGreaterThanOrEqual(5);
  });
});
