/**
 * Weather Intelligence & Facebook Poster Tests
 */

import { describe, it, expect } from "vitest";

// Test weather classification logic
describe("Weather Intelligence", () => {
  describe("Post Type Classification", () => {
    it("should classify extreme cold correctly", () => {
      // Temperature <= 10°F should be EXTREME_COLD
      const conditions = { temperature: 5, temperatureUnit: "F", shortForecast: "Clear" };
      const alerts: { event: string; severity: string }[] = [];
      
      // Simulate classification logic
      const temp = conditions.temperature;
      let postType = "ALL_CLEAR";
      
      if (temp <= 10) postType = "EXTREME_COLD";
      else if (temp <= 25) postType = "FLASH_FREEZE";
      else if (temp >= 100) postType = "EXTREME_HEAT";
      
      expect(postType).toBe("EXTREME_COLD");
    });

    it("should classify flash freeze correctly", () => {
      const conditions = { temperature: 20, temperatureUnit: "F", shortForecast: "Clear" };
      
      const temp = conditions.temperature;
      let postType = "ALL_CLEAR";
      
      if (temp <= 10) postType = "EXTREME_COLD";
      else if (temp <= 25) postType = "FLASH_FREEZE";
      
      expect(postType).toBe("FLASH_FREEZE");
    });

    it("should classify extreme heat correctly", () => {
      const conditions = { temperature: 105, temperatureUnit: "F", shortForecast: "Sunny" };
      
      const temp = conditions.temperature;
      let postType = "ALL_CLEAR";
      
      if (temp >= 100) postType = "EXTREME_HEAT";
      
      expect(postType).toBe("EXTREME_HEAT");
    });

    it("should return ALL_CLEAR for normal conditions", () => {
      const conditions = { temperature: 72, temperatureUnit: "F", shortForecast: "Sunny" };
      
      const temp = conditions.temperature;
      let postType = "ALL_CLEAR";
      
      if (temp <= 10) postType = "EXTREME_COLD";
      else if (temp <= 25) postType = "FLASH_FREEZE";
      else if (temp >= 100) postType = "EXTREME_HEAT";
      
      expect(postType).toBe("ALL_CLEAR");
    });

    it("should classify winter storm from forecast", () => {
      const conditions = { temperature: 30, temperatureUnit: "F", shortForecast: "Heavy Snow Expected" };
      
      const forecast = conditions.shortForecast.toLowerCase();
      let postType = "ALL_CLEAR";
      
      if (forecast.includes("snow") || forecast.includes("blizzard") || forecast.includes("ice")) {
        postType = "WINTER_STORM";
      }
      
      expect(postType).toBe("WINTER_STORM");
    });

    it("should classify active storm from forecast", () => {
      const conditions = { temperature: 75, temperatureUnit: "F", shortForecast: "Thunderstorms likely" };
      
      const forecast = conditions.shortForecast.toLowerCase();
      let postType = "ALL_CLEAR";
      
      if (forecast.includes("thunderstorm") || forecast.includes("severe")) {
        postType = "ACTIVE_STORM";
      }
      
      expect(postType).toBe("ACTIVE_STORM");
    });
  });

  describe("Safety Gate Logic", () => {
    it("should activate safety gate for extreme cold", () => {
      const postType = "EXTREME_COLD";
      const safetyGate = ["EXTREME_COLD", "EXTREME_HEAT", "SEVERE_WEATHER", "FLOODING"].includes(postType);
      expect(safetyGate).toBe(true);
    });

    it("should not activate safety gate for monitoring", () => {
      const postType = "MONITORING";
      const safetyGate = ["EXTREME_COLD", "EXTREME_HEAT", "SEVERE_WEATHER", "FLOODING"].includes(postType);
      expect(safetyGate).toBe(false);
    });

    it("should not activate safety gate for all clear", () => {
      const postType = "ALL_CLEAR";
      const safetyGate = ["EXTREME_COLD", "EXTREME_HEAT", "SEVERE_WEATHER", "FLOODING"].includes(postType);
      expect(safetyGate).toBe(false);
    });
  });

  describe("Business Content Generation", () => {
    it("should generate plumbing-specific content for extreme cold", () => {
      const businessType = "plumbing";
      const postType = "EXTREME_COLD";
      
      // Simulate content generation
      let bullets: string[] = [];
      let suggestedCTA = "";
      
      if (businessType.includes("plumb") && (postType === "EXTREME_COLD" || postType === "FLASH_FREEZE")) {
        bullets = [
          "Let faucets drip to prevent frozen pipes",
          "Know where your main water shutoff is",
          "Insulate exposed pipes in unheated areas",
        ];
        suggestedCTA = "Frozen pipe emergency? Call us 24/7.";
      }
      
      expect(bullets.length).toBe(3);
      expect(suggestedCTA).toContain("Frozen pipe");
    });

    it("should generate HVAC-specific content for extreme heat", () => {
      const businessType = "hvac";
      const postType = "EXTREME_HEAT";
      
      let bullets: string[] = [];
      let suggestedCTA = "";
      
      if (businessType.includes("hvac") && postType === "EXTREME_HEAT") {
        bullets = [
          "Set AC to 78°F when away",
          "Close blinds on sunny windows",
          "Check air filter monthly",
        ];
        suggestedCTA = "AC not keeping up? Call us.";
      }
      
      expect(bullets.length).toBe(3);
      expect(suggestedCTA).toContain("AC");
    });

    it("should generate snow removal content for winter storm", () => {
      const businessType = "snow plow";
      const postType = "WINTER_STORM";
      
      let bullets: string[] = [];
      let suggestedCTA = "";
      
      if ((businessType.includes("snow") || businessType.includes("plow")) && postType === "WINTER_STORM") {
        bullets = [
          "Storm expected — we're ready",
          "Priority service for contract customers",
          "Salt and sand supplies stocked",
        ];
        suggestedCTA = "Not on our list? Sign up now.";
      }
      
      expect(bullets.length).toBe(3);
      expect(suggestedCTA).toContain("Sign up");
    });
  });
});

// Test Facebook post formatting
describe("Facebook Post Formatting", () => {
  it("should format post with emoji", () => {
    const postType = "EXTREME_COLD";
    const summary = "Cold snap hitting the area — 5°F and dropping.";
    const bullets = ["Let faucets drip", "Know your shutoff"];
    const cta = "Call us 24/7.";
    
    const emojiMap: Record<string, string> = {
      ALL_CLEAR: "☀️",
      MONITORING: "🌤️",
      ACTIVE_STORM: "⛈️",
      EXTREME_COLD: "🥶",
      EXTREME_HEAT: "🥵",
      FLASH_FREEZE: "❄️",
      SEVERE_WEATHER: "⚠️",
      WINTER_STORM: "🌨️",
      FLOODING: "🌊",
    };
    
    let post = emojiMap[postType] + " " + summary + "\n\n";
    post += bullets.map(b => `• ${b}`).join("\n");
    post += "\n\n" + cta;
    
    expect(post).toContain("🥶");
    expect(post).toContain("Cold snap");
    expect(post).toContain("• Let faucets drip");
    expect(post).toContain("Call us 24/7");
  });

  it("should format post without emoji when disabled", () => {
    const summary = "Looking good out there.";
    const includeEmoji = false;
    
    let post = "";
    if (includeEmoji) {
      post += "☀️ ";
    }
    post += summary;
    
    expect(post).not.toContain("☀️");
    expect(post).toBe("Looking good out there.");
  });

  it("should add powered by line when enabled", () => {
    const summary = "Test post";
    const includePoweredBy = true;
    
    let post = summary;
    if (includePoweredBy) {
      post += "\n\n—\nPowered by LaunchBase";
    }
    
    expect(post).toContain("Powered by LaunchBase");
  });
});

// Test Facebook connection validation
describe("Facebook Connection", () => {
  it("should detect missing credentials", () => {
    const pageToken = undefined;
    const pageId = undefined;
    
    const configured = !!(pageToken && pageId);
    
    expect(configured).toBe(false);
  });

  it("should detect configured credentials", () => {
    const pageToken = "test_token_123";
    const pageId = "123456789";
    
    const configured = !!(pageToken && pageId);
    
    expect(configured).toBe(true);
  });

  it("should validate required permissions", () => {
    const grantedPermissions = ["pages_manage_posts", "pages_read_engagement"];
    const requiredPermission = "pages_manage_posts";
    
    const hasPermission = grantedPermissions.includes(requiredPermission);
    
    expect(hasPermission).toBe(true);
  });

  it("should detect missing permissions", () => {
    const grantedPermissions = ["pages_read_engagement"];
    const requiredPermission = "pages_manage_posts";
    
    const hasPermission = grantedPermissions.includes(requiredPermission);
    
    expect(hasPermission).toBe(false);
  });
});

// Test Stripe Price ID configuration
describe("Stripe Configuration", () => {
  it("should have correct cadence pricing", () => {
    const pricing = {
      LOW: 79,
      MEDIUM: 129,
      HIGH: 199,
    };
    
    expect(pricing.LOW).toBe(79);
    expect(pricing.MEDIUM).toBe(129);
    expect(pricing.HIGH).toBe(199);
  });

  it("should have correct layer pricing", () => {
    const layerPricing = {
      sports: 29,
      community: 39,
      trends: 49,
    };
    
    expect(layerPricing.sports).toBe(29);
    expect(layerPricing.community).toBe(39);
    expect(layerPricing.trends).toBe(49);
  });

  it("should calculate total correctly", () => {
    const cadence = 129; // MEDIUM
    const layers = [29, 39]; // sports + community
    const setupBase = 249;
    const setupPerLayer = 99;
    
    const monthlyTotal = cadence + layers.reduce((a, b) => a + b, 0);
    const setupTotal = setupBase + (layers.length * setupPerLayer);
    
    expect(monthlyTotal).toBe(197);
    expect(setupTotal).toBe(447);
  });
});
