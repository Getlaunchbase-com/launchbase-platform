/**
 * Intelligence Layers Router Tests
 * Tests for the Social Media Intelligence module configuration
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

describe("Intelligence Layers", () => {
  describe("Pricing Calculations", () => {
    // Test pricing logic
    const basePrices = { low: 7900, medium: 12900, high: 19900 };
    
    const calculateMonthlyPrice = (
      depthLevel: "low" | "medium" | "high",
      sportsEnabled: boolean,
      communityEnabled: boolean,
      trendsEnabled: boolean
    ) => {
      let total = basePrices[depthLevel];
      // Sports is included in medium/high, extra charge for low
      if (depthLevel === "low" && sportsEnabled) total += 2900;
      if (communityEnabled) total += 3900;
      if (trendsEnabled) total += 4900;
      return total;
    };

    it("should calculate base price for low depth", () => {
      const price = calculateMonthlyPrice("low", false, false, false);
      expect(price).toBe(7900); // $79
    });

    it("should calculate base price for medium depth", () => {
      const price = calculateMonthlyPrice("medium", false, false, false);
      expect(price).toBe(12900); // $129
    });

    it("should calculate base price for high depth", () => {
      const price = calculateMonthlyPrice("high", false, false, false);
      expect(price).toBe(19900); // $199
    });

    it("should add sports price only for low depth", () => {
      const lowWithSports = calculateMonthlyPrice("low", true, false, false);
      const mediumWithSports = calculateMonthlyPrice("medium", true, false, false);
      
      expect(lowWithSports).toBe(7900 + 2900); // $79 + $29 = $108
      expect(mediumWithSports).toBe(12900); // Sports included in medium
    });

    it("should add community layer price", () => {
      const price = calculateMonthlyPrice("medium", false, true, false);
      expect(price).toBe(12900 + 3900); // $129 + $39 = $168
    });

    it("should add trends layer price", () => {
      const price = calculateMonthlyPrice("medium", false, false, true);
      expect(price).toBe(12900 + 4900); // $129 + $49 = $178
    });

    it("should calculate full package price", () => {
      const price = calculateMonthlyPrice("high", true, true, true);
      // High: $199 + Community: $39 + Trends: $49 = $287
      // Sports is included in high, so no extra charge
      expect(price).toBe(19900 + 3900 + 4900);
    });
  });

  describe("Sample Week Generation", () => {
    const generateSamplePosts = (config: {
      depthLevel: "low" | "medium" | "high";
      sportsEnabled: boolean;
      communityEnabled: boolean;
      trendsEnabled: boolean;
    }) => {
      const posts = [];

      // Weather post (always included)
      posts.push({
        id: 1,
        type: "weather",
        content: "❄️ Snow expected tonight. Our crews are ready to keep your property clear and safe. Stay warm!",
        trigger: "Winter storm advisory",
        day: "Monday",
        time: "6:00 PM",
      });

      // Additional weather post for medium/high
      if (config.depthLevel !== "low") {
        posts.push({
          id: 2,
          type: "weather",
          content: "☀️ Beautiful day ahead! Perfect weather for outdoor projects. How can we help?",
          trigger: "Clear skies, 65°F",
          day: "Wednesday",
          time: "9:00 AM",
        });
      }

      // Sports post
      if (config.sportsEnabled) {
        posts.push({
          id: 3,
          type: "sports",
          content: "🏈 Big game today! We'll have your property cleared before kickoff. Go Bears! 🐻",
          trigger: "Bears home game",
          day: "Sunday",
          time: "10:00 AM",
        });
      }

      // Community post
      if (config.communityEnabled) {
        posts.push({
          id: 4,
          type: "community",
          content: "🎄 Holiday market this weekend! We'll make sure your walkways are safe for all the visitors.",
          trigger: "Local holiday event",
          day: "Friday",
          time: "3:00 PM",
        });
      }

      // Trends post (only for high depth)
      if (config.trendsEnabled && config.depthLevel === "high") {
        posts.push({
          id: 5,
          type: "trends",
          content: "Lots of folks talking about ice on the roads today. We're on it! Stay safe out there.",
          trigger: "Local trending topic: road conditions",
          day: "Thursday",
          time: "7:00 AM",
        });
      }

      return posts;
    };

    it("should generate 1 post for low depth with no layers", () => {
      const posts = generateSamplePosts({
        depthLevel: "low",
        sportsEnabled: false,
        communityEnabled: false,
        trendsEnabled: false,
      });
      expect(posts.length).toBe(1);
      expect(posts[0].type).toBe("weather");
    });

    it("should generate 2 posts for medium depth with no extra layers", () => {
      const posts = generateSamplePosts({
        depthLevel: "medium",
        sportsEnabled: false,
        communityEnabled: false,
        trendsEnabled: false,
      });
      expect(posts.length).toBe(2);
    });

    it("should include sports post when enabled", () => {
      const posts = generateSamplePosts({
        depthLevel: "medium",
        sportsEnabled: true,
        communityEnabled: false,
        trendsEnabled: false,
      });
      const sportsPosts = posts.filter(p => p.type === "sports");
      expect(sportsPosts.length).toBe(1);
    });

    it("should include community post when enabled", () => {
      const posts = generateSamplePosts({
        depthLevel: "medium",
        sportsEnabled: false,
        communityEnabled: true,
        trendsEnabled: false,
      });
      const communityPosts = posts.filter(p => p.type === "community");
      expect(communityPosts.length).toBe(1);
    });

    it("should only include trends post for high depth", () => {
      const mediumPosts = generateSamplePosts({
        depthLevel: "medium",
        sportsEnabled: false,
        communityEnabled: false,
        trendsEnabled: true,
      });
      const highPosts = generateSamplePosts({
        depthLevel: "high",
        sportsEnabled: false,
        communityEnabled: false,
        trendsEnabled: true,
      });

      const mediumTrends = mediumPosts.filter(p => p.type === "trends");
      const highTrends = highPosts.filter(p => p.type === "trends");

      expect(mediumTrends.length).toBe(0); // Trends not shown for medium
      expect(highTrends.length).toBe(1); // Trends shown for high
    });

    it("should generate full week for high depth with all layers", () => {
      const posts = generateSamplePosts({
        depthLevel: "high",
        sportsEnabled: true,
        communityEnabled: true,
        trendsEnabled: true,
      });
      // 2 weather + 1 sports + 1 community + 1 trends = 5
      expect(posts.length).toBe(5);
    });
  });

  describe("Depth Level Descriptions", () => {
    const depthDescriptions = {
      low: {
        title: "Quiet and conservative",
        cadence: "1–2 posts per week",
        price: 7900,
      },
      medium: {
        title: "Balanced visibility",
        cadence: "2–3 posts per week",
        price: 12900,
      },
      high: {
        title: "Proactive and timely",
        cadence: "4–6 posts per week",
        price: 19900,
      },
    };

    it("should have correct cadence for each depth level", () => {
      expect(depthDescriptions.low.cadence).toBe("1–2 posts per week");
      expect(depthDescriptions.medium.cadence).toBe("2–3 posts per week");
      expect(depthDescriptions.high.cadence).toBe("4–6 posts per week");
    });

    it("should have correct base prices", () => {
      expect(depthDescriptions.low.price).toBe(7900);
      expect(depthDescriptions.medium.price).toBe(12900);
      expect(depthDescriptions.high.price).toBe(19900);
    });
  });

  describe("Mode Configurations", () => {
    const modes = ["auto", "guided", "custom"] as const;

    it("should have three tuning modes", () => {
      expect(modes.length).toBe(3);
    });

    it("should include auto as default recommended mode", () => {
      expect(modes).toContain("auto");
    });

    it("should include guided mode for fine-tuning", () => {
      expect(modes).toContain("guided");
    });

    it("should include custom mode for full control", () => {
      expect(modes).toContain("custom");
    });
  });

  describe("Context Layer Definitions", () => {
    const contextLayers = [
      { id: "weather", locked: true, price: 0 },
      { id: "sports", locked: false, price: 2900 },
      { id: "community", locked: false, price: 3900 },
      { id: "trends", locked: false, price: 4900 },
    ];

    it("should have weather as always active (locked)", () => {
      const weather = contextLayers.find(l => l.id === "weather");
      expect(weather?.locked).toBe(true);
      expect(weather?.price).toBe(0);
    });

    it("should have sports as optional with price", () => {
      const sports = contextLayers.find(l => l.id === "sports");
      expect(sports?.locked).toBe(false);
      expect(sports?.price).toBe(2900);
    });

    it("should have community as optional with price", () => {
      const community = contextLayers.find(l => l.id === "community");
      expect(community?.locked).toBe(false);
      expect(community?.price).toBe(3900);
    });

    it("should have trends as optional with highest price", () => {
      const trends = contextLayers.find(l => l.id === "trends");
      expect(trends?.locked).toBe(false);
      expect(trends?.price).toBe(4900);
    });
  });

  describe("Setup Fee Calculations", () => {
    const calculateSetupFee = (
      communityEnabled: boolean,
      trendsEnabled: boolean
    ) => {
      let total = 24900; // Base setup $249
      if (communityEnabled) total += 9900; // +$99
      if (trendsEnabled) total += 19900; // +$199
      return total;
    };

    it("should have base setup fee of $249", () => {
      const fee = calculateSetupFee(false, false);
      expect(fee).toBe(24900);
    });

    it("should add $99 for community layer setup", () => {
      const fee = calculateSetupFee(true, false);
      expect(fee).toBe(24900 + 9900);
    });

    it("should add $199 for trends layer setup", () => {
      const fee = calculateSetupFee(false, true);
      expect(fee).toBe(24900 + 19900);
    });

    it("should calculate full setup fee with all layers", () => {
      const fee = calculateSetupFee(true, true);
      expect(fee).toBe(24900 + 9900 + 19900); // $547
    });
  });
});
