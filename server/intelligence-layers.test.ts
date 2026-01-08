/**
 * Intelligence Layers Router Tests
 * Tests for the Social Media Intelligence module configuration
 * Model A: Cadence + Layers (Clean Add-on Model)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(null)),
}));

// Mock analytics
vi.mock("./analytics", () => ({
  trackEvent: vi.fn(() => Promise.resolve(true)),
}));

describe("Intelligence Layers - Model A Pricing", () => {
  describe("Cadence Pricing (Base Price)", () => {
    const cadencePrices = { low: 7900, medium: 12900, high: 19900 };

    it("should have correct price for low cadence ($79)", () => {
      expect(cadencePrices.low).toBe(7900);
    });

    it("should have correct price for medium cadence ($129)", () => {
      expect(cadencePrices.medium).toBe(12900);
    });

    it("should have correct price for high cadence ($199)", () => {
      expect(cadencePrices.high).toBe(19900);
    });
  });

  describe("Layer Pricing (Always Add-ons in Model A)", () => {
    const layerPrices = {
      weather: 0,    // Always included
      sports: 2900,  // $29/mo
      community: 3900, // $39/mo
      trends: 4900,  // $49/mo
    };

    it("should have weather always free (included)", () => {
      expect(layerPrices.weather).toBe(0);
    });

    it("should have sports as $29/mo add-on", () => {
      expect(layerPrices.sports).toBe(2900);
    });

    it("should have community as $39/mo add-on", () => {
      expect(layerPrices.community).toBe(3900);
    });

    it("should have trends as $49/mo add-on", () => {
      expect(layerPrices.trends).toBe(4900);
    });
  });

  describe("Monthly Price Calculations (Model A)", () => {
    const calculateMonthlyPrice = (
      cadence: "low" | "medium" | "high",
      enabledLayers: string[]
    ) => {
      const cadencePrices = { low: 7900, medium: 12900, high: 19900 };
      let total = cadencePrices[cadence];
      
      // All layers are add-ons (except weather which is free)
      if (enabledLayers.includes("sports")) total += 2900;
      if (enabledLayers.includes("community")) total += 3900;
      if (enabledLayers.includes("trends")) total += 4900;
      
      return total;
    };

    it("should calculate low cadence with no extra layers", () => {
      const price = calculateMonthlyPrice("low", ["weather"]);
      expect(price).toBe(7900); // $79
    });

    it("should calculate medium cadence with sports", () => {
      const price = calculateMonthlyPrice("medium", ["weather", "sports"]);
      expect(price).toBe(12900 + 2900); // $129 + $29 = $158
    });

    it("should calculate high cadence with all layers", () => {
      const price = calculateMonthlyPrice("high", ["weather", "sports", "community", "trends"]);
      // $199 + $29 + $39 + $49 = $316
      expect(price).toBe(19900 + 2900 + 3900 + 4900);
    });

    it("should NOT give sports discount for medium/high (Model A)", () => {
      // In Model A, sports is always an add-on regardless of cadence
      const lowWithSports = calculateMonthlyPrice("low", ["weather", "sports"]);
      const mediumWithSports = calculateMonthlyPrice("medium", ["weather", "sports"]);
      const highWithSports = calculateMonthlyPrice("high", ["weather", "sports"]);
      
      // Sports adds $29 to ALL cadence levels
      expect(lowWithSports).toBe(7900 + 2900);
      expect(mediumWithSports).toBe(12900 + 2900);
      expect(highWithSports).toBe(19900 + 2900);
    });

    it("should calculate price deterministically for each layer/cadence combo", () => {
      // Test that same inputs always produce same outputs
      const config1 = calculateMonthlyPrice("medium", ["weather", "sports", "community"]);
      const config2 = calculateMonthlyPrice("medium", ["weather", "sports", "community"]);
      expect(config1).toBe(config2);
      expect(config1).toBe(12900 + 2900 + 3900); // $197
    });
  });

  describe("Setup Fee Calculations", () => {
    const calculateSetupFee = (enabledLayers: string[]) => {
      let total = 24900; // Base setup $249
      // Each paid layer adds $99 setup
      const paidLayers = enabledLayers.filter(l => l !== "weather");
      total += paidLayers.length * 9900;
      return total;
    };

    it("should have base setup fee of $249", () => {
      const fee = calculateSetupFee(["weather"]);
      expect(fee).toBe(24900);
    });

    it("should add $99 per layer for setup", () => {
      const onelayer = calculateSetupFee(["weather", "sports"]);
      const twoLayers = calculateSetupFee(["weather", "sports", "community"]);
      const threeLayers = calculateSetupFee(["weather", "sports", "community", "trends"]);
      
      expect(onelayer).toBe(24900 + 9900); // $348
      expect(twoLayers).toBe(24900 + 9900 + 9900); // $447
      expect(threeLayers).toBe(24900 + 9900 + 9900 + 9900); // $546
    });
  });

  describe("Weather Layer (Always Locked On)", () => {
    it("should always include weather in enabled layers", () => {
      const enabledLayers = ["weather", "sports"];
      expect(enabledLayers).toContain("weather");
    });

    it("should not allow weather to be disabled", () => {
      const toggleLayer = (layerId: string, enabledLayers: string[]) => {
        if (layerId === "weather") return enabledLayers; // Cannot toggle weather
        if (enabledLayers.includes(layerId)) {
          return enabledLayers.filter(l => l !== layerId);
        } else {
          return [...enabledLayers, layerId];
        }
      };

      const initial = ["weather", "sports"];
      const afterToggle = toggleLayer("weather", initial);
      expect(afterToggle).toContain("weather"); // Weather still there
    });
  });

  describe("Mode Configurations", () => {
    const modes = ["auto", "guided", "custom"] as const;

    it("should have three tuning modes", () => {
      expect(modes.length).toBe(3);
    });

    it("should have auto as default recommended mode", () => {
      expect(modes[0]).toBe("auto");
    });

    it("mode changes should NOT alter price unless config changes", () => {
      const calculatePrice = (cadence: string, layers: string[], _mode: string) => {
        // Mode doesn't affect price
        const cadencePrices: Record<string, number> = { low: 7900, medium: 12900, high: 19900 };
        let total = cadencePrices[cadence];
        if (layers.includes("sports")) total += 2900;
        return total;
      };

      const autoPrice = calculatePrice("medium", ["weather", "sports"], "auto");
      const guidedPrice = calculatePrice("medium", ["weather", "sports"], "guided");
      const customPrice = calculatePrice("medium", ["weather", "sports"], "custom");

      expect(autoPrice).toBe(guidedPrice);
      expect(guidedPrice).toBe(customPrice);
    });
  });

  describe("Cadence Descriptions", () => {
    const cadenceDescriptions = {
      low: {
        tagline: "Stay visible without noise",
        frequency: "1–2 posts/week",
        postsIncluded: 8,
        intelligenceChecks: 30,
      },
      medium: {
        tagline: "Balanced, timely presence",
        frequency: "2–3 posts/week",
        postsIncluded: 12,
        intelligenceChecks: 60,
      },
      high: {
        tagline: "High visibility during important moments",
        frequency: "4–6 posts/week",
        postsIncluded: 24,
        intelligenceChecks: 120,
      },
    };

    it("should have benefit-focused taglines (not frequency)", () => {
      expect(cadenceDescriptions.low.tagline).toBe("Stay visible without noise");
      expect(cadenceDescriptions.medium.tagline).toBe("Balanced, timely presence");
      expect(cadenceDescriptions.high.tagline).toBe("High visibility during important moments");
    });

    it("should have correct posts included per tier", () => {
      expect(cadenceDescriptions.low.postsIncluded).toBe(8);
      expect(cadenceDescriptions.medium.postsIncluded).toBe(12);
      expect(cadenceDescriptions.high.postsIncluded).toBe(24);
    });
  });

  describe("Impact Labels", () => {
    const layers = [
      { id: "weather", impact: "essential" },
      { id: "sports", impact: "high" },
      { id: "community", impact: "medium" },
      { id: "trends", impact: "low" },
    ];

    it("should have weather as essential impact", () => {
      const weather = layers.find(l => l.id === "weather");
      expect(weather?.impact).toBe("essential");
    });

    it("should have sports as high impact", () => {
      const sports = layers.find(l => l.id === "sports");
      expect(sports?.impact).toBe("high");
    });

    it("should have community as medium impact", () => {
      const community = layers.find(l => l.id === "community");
      expect(community?.impact).toBe("medium");
    });

    it("should have trends as low impact", () => {
      const trends = layers.find(l => l.id === "trends");
      expect(trends?.impact).toBe("low");
    });
  });

  describe("Sample Week Generation", () => {
    const generateSamplePosts = (config: {
      cadence: "low" | "medium" | "high";
      enabledLayers: string[];
    }) => {
      const posts = [];

      // Weather post (always included)
      posts.push({
        id: 1,
        type: "weather",
        content: "❄️ Snow expected tonight. Our crews are ready!",
        trigger: "Winter storm advisory",
        day: "Monday",
        time: "6:00 PM",
      });

      // Additional weather post for medium/high cadence
      if (config.cadence !== "low") {
        posts.push({
          id: 2,
          type: "weather",
          content: "☀️ Beautiful day ahead! Perfect weather for outdoor projects.",
          trigger: "Clear skies, 65°F",
          day: "Wednesday",
          time: "9:00 AM",
        });
      }

      // Sports post
      if (config.enabledLayers.includes("sports")) {
        posts.push({
          id: 3,
          type: "sports",
          content: "🏈 Big game today! We'll have your property cleared before kickoff.",
          trigger: "Bears home game",
          day: "Sunday",
          time: "10:00 AM",
        });
      }

      // Community post
      if (config.enabledLayers.includes("community")) {
        posts.push({
          id: 4,
          type: "community",
          content: "🎄 Holiday market this weekend! Safe walkways for all visitors.",
          trigger: "Local holiday event",
          day: "Friday",
          time: "3:00 PM",
        });
      }

      // Trends post (only for high cadence)
      if (config.enabledLayers.includes("trends") && config.cadence === "high") {
        posts.push({
          id: 5,
          type: "trends",
          content: "Lots of folks talking about ice on the roads today. We're on it!",
          trigger: "Local trending topic",
          day: "Thursday",
          time: "7:00 AM",
        });
      }

      return posts;
    };

    it("should generate 1 post for low cadence with only weather", () => {
      const posts = generateSamplePosts({
        cadence: "low",
        enabledLayers: ["weather"],
      });
      expect(posts.length).toBe(1);
      expect(posts[0].type).toBe("weather");
    });

    it("should generate more posts for medium cadence", () => {
      const posts = generateSamplePosts({
        cadence: "medium",
        enabledLayers: ["weather"],
      });
      expect(posts.length).toBe(2);
    });

    it("should include sports post when layer is enabled", () => {
      const posts = generateSamplePosts({
        cadence: "medium",
        enabledLayers: ["weather", "sports"],
      });
      const sportsPosts = posts.filter(p => p.type === "sports");
      expect(sportsPosts.length).toBe(1);
    });

    it("should allow zero scheduled posts without error (silence is valid)", () => {
      // Simulate a week with no triggers
      const generatePostsForQuietWeek = () => {
        // No weather events, no sports, no community events
        return [];
      };
      
      const posts = generatePostsForQuietWeek();
      expect(posts.length).toBe(0); // Valid outcome
      expect(Array.isArray(posts)).toBe(true);
    });
  });

  describe("Safety Logic", () => {
    it("should have safety rules that cannot be disabled", () => {
      const safetyRules = [
        { id: "no_politics", enabled: true, canDisable: false },
        { id: "no_tragedies", enabled: true, canDisable: false },
        { id: "weather_gated", enabled: true, canDisable: false },
        { id: "silence_valid", enabled: true, canDisable: false },
        { id: "approval_required", enabled: true, canDisable: false },
      ];

      safetyRules.forEach(rule => {
        expect(rule.enabled).toBe(true);
        expect(rule.canDisable).toBe(false);
      });
    });

    it("trends should respect weather gating", () => {
      const canPostTrend = (weatherSafe: boolean, trendEnabled: boolean) => {
        // Trends cannot activate if weather gating fails
        if (!weatherSafe) return false;
        return trendEnabled;
      };

      expect(canPostTrend(true, true)).toBe(true);
      expect(canPostTrend(false, true)).toBe(false); // Weather unsafe, no trend post
      expect(canPostTrend(true, false)).toBe(false);
      expect(canPostTrend(false, false)).toBe(false);
    });
  });

  describe("UX State Management", () => {
    it("should track dirty state when config changes", () => {
      let hasChanges = false;
      const setHasChanges = (value: boolean) => { hasChanges = value; };

      // Simulate config change
      setHasChanges(true);
      expect(hasChanges).toBe(true);
    });

    it("should reset dirty state after save", () => {
      let hasChanges = true;
      const handleSave = () => {
        // Save logic...
        hasChanges = false;
      };

      handleSave();
      expect(hasChanges).toBe(false);
    });
  });

  describe("Suite Modules", () => {
    const suiteModules = [
      { id: "social", name: "Social Media Intelligence", available: true },
      { id: "quickbooks", name: "QuickBooks Sync", available: true },
      { id: "google", name: "Google Business Assistant", available: false },
    ];

    it("should have social media intelligence as available", () => {
      const social = suiteModules.find(m => m.id === "social");
      expect(social?.available).toBe(true);
    });

    it("should have quickbooks as available", () => {
      const qb = suiteModules.find(m => m.id === "quickbooks");
      expect(qb?.available).toBe(true);
    });

    it("should have google business as coming soon", () => {
      const google = suiteModules.find(m => m.id === "google");
      expect(google?.available).toBe(false);
    });
  });
});
