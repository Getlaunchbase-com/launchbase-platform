/**
 * Integration tests for Facebook posting mutations with policy enforcement
 * 
 * Tests that mutations correctly enforce policy and return structured responses
 * when blocked/queued/drafted.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the policy module BEFORE any imports that use it
vi.mock("../services/facebook-policy", () => ({
  checkFacebookPostingPolicy: vi.fn(),
}));

// Mock the Facebook poster
vi.mock("../services/facebook-poster", () => ({
  postToFacebook: vi.fn(),
  testFacebookConnection: vi.fn(),
}));

// Mock database
vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

// Mock weather intelligence
vi.mock("../services/weather-intelligence", () => ({
  getWeatherIntelligence: vi.fn(),
  formatFacebookPost: vi.fn(),
}));

describe("Facebook Mutations - Policy Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Ensure fresh module imports for each test
  });

  describe("facebook.post mutation", () => {
    it("should return BLOCK response and NOT call Facebook when daily cap is reached", async () => {
      // Mock policy to return BLOCK
      const { checkFacebookPostingPolicy } = await import("../services/facebook-policy");
      vi.mocked(checkFacebookPostingPolicy).mockResolvedValue({
        allowed: false,
        action: "BLOCK",
        reasons: ["Daily post limit reached (2 posts per 24 hours). Please wait before posting again."],
      });

      // Mock database to return connection
      const { getDb } = await import("../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                userId: 123,
                externalId: "page123",
                connectionType: "facebook_page",
              }]),
            }),
          }),
        }),
      } as any);

      // Import routers and create caller
      const { appRouter } = await import("../routers");
      const caller = appRouter.createCaller({
        user: { id: 123, name: "Test User", email: "test@example.com", role: "user" },
      });

      // Call the mutation
      const result = await caller.facebook.post({
        message: "Test post",
      });

      // Assert response structure
      expect(result.success).toBe(false);
      expect(result.action).toBe("BLOCK");
      // Assert semantic meaning, not exact wording (allows copy to evolve)
      expect(result.error?.toLowerCase()).toMatch(/limit|cap/);

      // Assert Facebook poster was NOT called
      const facebookPoster = await import("../services/facebook-poster");
      expect(facebookPoster.postToFacebook).not.toHaveBeenCalled();
    });

    it("should call Facebook when policy allows PUBLISH", async () => {
      // Mock policy to return PUBLISH
      const { checkFacebookPostingPolicy } = await import("../services/facebook-policy");
      vi.mocked(checkFacebookPostingPolicy).mockResolvedValue({
        allowed: true,
        action: "PUBLISH",
      });

      // Mock database
      const { getDb } = await import("../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                userId: 123,
                externalId: "page123",
                connectionType: "facebook_page",
              }]),
            }),
          }),
        }),
      } as any);

      // Mock Facebook poster to return success
      const facebookPoster = await import("../services/facebook-poster");
      vi.mocked(facebookPoster.postToFacebook).mockResolvedValue({
        success: true,
        postId: "fb123",
        postUrl: "https://facebook.com/post/fb123",
      });

      // Import routers and create caller
      const { appRouter } = await import("../routers");
      const caller = appRouter.createCaller({
        user: { id: 123, name: "Test User", email: "test@example.com", role: "user" },
      });

      // Call the mutation
      const result = await caller.facebook.post({
        message: "Test post",
      });

      // Assert response
      expect(result.success).toBe(true);
      expect(result.postId).toBe("fb123");

      // Assert Facebook poster WAS called
      expect(facebookPoster.postToFacebook).toHaveBeenCalledWith({
        message: "Test post",
      });
    });
  });

  describe("facebook.postWeatherAware mutation", () => {
    it("should return DRAFT response and NOT call Facebook when approval is required", async () => {
      // Mock weather intelligence to return non-severe conditions (bypass safety gate)
      const weatherIntel = await import("../services/weather-intelligence");
      vi.mocked(weatherIntel.getWeatherIntelligence).mockResolvedValue({
        postType: "ALL_CLEAR",
        urgency: "low",
        summary: "Nice weather today",
        bullets: ["Clear skies"],
        suggestedCTA: "Enjoy the day!",
        safetyGate: false, // Critical: bypass safety gate to reach policy check
        rawConditions: {
          temperature: 70,
          temperatureUnit: "F",
          shortForecast: "Sunny",
          windSpeed: "5 mph",
          windDirection: "N",
        },
        alerts: [],
      });
      vi.mocked(weatherIntel.formatFacebookPost).mockReturnValue("Nice weather today");
      
      // Mock policy to return DRAFT
      const { checkFacebookPostingPolicy } = await import("../services/facebook-policy");
      vi.mocked(checkFacebookPostingPolicy).mockResolvedValue({
        allowed: false,
        action: "DRAFT",
        requiresApproval: true,
        reasons: ["Approval required: LaunchBase is in launch mode (first 7 days after connection)."],
      });

      // Mock database
      const { getDb } = await import("../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                userId: 123,
                externalId: "page123",
                connectionType: "facebook_page",
              }]),
            }),
          }),
        }),
      } as any);

      // Note: We don't need to mock weather intelligence because the policy
      // returns DRAFT before weather intelligence would be called.
      // This test verifies the policy gate prevents FB calls, not weather logic.

      // Import routers and create caller
      const { appRouter } = await import("../routers");
      const caller = appRouter.createCaller({
        user: { id: 123, name: "Test User", email: "test@example.com", role: "user" },
      });

      // Call the mutation
      const result = await caller.facebook.postWeatherAware({
        latitude: 41.8781,
        longitude: -87.6298,
      });

      // Assert response structure
      console.log("[TEST] Facebook DRAFT result:", JSON.stringify(result, null, 2));
      expect(result.posted).toBe(false);
      expect(result.action).toBe("DRAFT");
      // Assert semantic meaning (allows copy to evolve)
      expect(result.error?.toLowerCase()).toMatch(/needs approval/);

      // Assert Facebook poster was NOT called
      const facebookPoster = await import("../services/facebook-poster");
      expect(facebookPoster.postToFacebook).not.toHaveBeenCalled();
    });

    it("should return QUEUE response with retryAt when outside business hours", async () => {
      // Mock weather intelligence to return non-severe conditions (bypass safety gate)
      const weatherIntel = await import("../services/weather-intelligence");
      vi.mocked(weatherIntel.getWeatherIntelligence).mockResolvedValue({
        postType: "ALL_CLEAR",
        urgency: "low",
        summary: "Nice weather today",
        bullets: ["Clear skies"],
        suggestedCTA: "Enjoy the day!",
        safetyGate: false, // Critical: bypass safety gate to reach policy check
        rawConditions: {
          temperature: 70,
          temperatureUnit: "F",
          shortForecast: "Sunny",
          windSpeed: "5 mph",
          windDirection: "N",
        },
        alerts: [],
      });
      vi.mocked(weatherIntel.formatFacebookPost).mockReturnValue("Nice weather today");
      
      // Mock policy to return QUEUE
      const { checkFacebookPostingPolicy } = await import("../services/facebook-policy");
      
      // Sanity check: verify mock is actually applied
      expect(vi.isMockFunction(checkFacebookPostingPolicy)).toBe(true);
      
      vi.mocked(checkFacebookPostingPolicy).mockResolvedValue({
        allowed: false,
        action: "QUEUE",
        reasons: ["Outside business hours (6 AM - 9 PM Chicago time). Queued for next allowed window."],
        retryAt: "2026-01-16T12:00:00Z",
      });

      // Mock database
      const { getDb } = await import("../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                userId: 123,
                externalId: "page123",
                connectionType: "facebook_page",
              }]),
            }),
          }),
        }),
      } as any);

      // Note: We don't need to mock weather intelligence because the policy
      // returns QUEUE before weather intelligence would be called.
      // This test verifies the policy gate prevents FB calls, not weather logic.

      // Import routers and create caller
      const { appRouter } = await import("../routers");
      const caller = appRouter.createCaller({
        user: { id: 123, name: "Test User", email: "test@example.com", role: "user" },
      });

      // Call the mutation
      const result = await caller.facebook.postWeatherAware({
        latitude: 41.8781,
        longitude: -87.6298,
      });

      // Assert response structure
      expect(result.posted).toBe(false);
      expect(result.action).toBe("QUEUE");
      // Assert semantic meaning (allows copy to evolve)
      expect(result.error?.toLowerCase()).toMatch(/queue|scheduled/);
      expect(result.retryAt).toBe("2026-01-16T12:00:00Z");

      // Assert Facebook poster was NOT called
      const facebookPoster = await import("../services/facebook-poster");
      expect(facebookPoster.postToFacebook).not.toHaveBeenCalled();
    });
  });
});
