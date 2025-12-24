import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

describe("Setup Packet Generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSetupPacket", () => {
    it("should generate a Google Business packet with correct structure", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          businessName: "Test Business",
          vertical: "trades",
          phone: "555-1234",
          services: ["Plumbing", "HVAC"],
          serviceArea: ["Chicago", "Suburbs"],
          primaryCTA: "Call Now",
        }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { generateSetupPacket } = await import("./services/setupPacketGenerator");
      const packet = await generateSetupPacket(1, "google_business");

      expect(packet).not.toBeNull();
      expect(packet?.integration).toBe("google_business");
      expect(packet?.business.name).toBe("Test Business");
      expect(packet?.business.phone).toBe("555-1234");
      expect(packet?.services).toHaveLength(2);
      expect(packet?.setupSteps.length).toBeGreaterThan(0);
      
      // Check Google-specific fields
      if (packet?.integration === "google_business") {
        expect(packet.specific.primaryCategory).toBeDefined();
        expect(packet.specific.description).toBeDefined();
        expect(packet.specific.reviewResponseTemplates).toBeDefined();
      }
    });

    it("should generate a Meta packet with correct structure", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          businessName: "Test Salon",
          vertical: "beauty",
          phone: "555-5678",
          services: ["Haircuts", "Coloring"],
          serviceArea: ["Downtown"],
          primaryCTA: "Book Now",
        }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { generateSetupPacket } = await import("./services/setupPacketGenerator");
      const packet = await generateSetupPacket(1, "meta");

      expect(packet).not.toBeNull();
      expect(packet?.integration).toBe("meta");
      expect(packet?.business.name).toBe("Test Salon");
      
      // Check Meta-specific fields
      if (packet?.integration === "meta") {
        expect(packet.specific.pageBio).toBeDefined();
        expect(packet.specific.pageBio.length).toBeLessThanOrEqual(255);
        expect(packet.specific.pinnedPostDraft).toBeDefined();
        expect(packet.specific.hashtagStrategy).toBeInstanceOf(Array);
      }
    });

    it("should generate a QuickBooks packet with correct structure", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          businessName: "Test Contractor",
          vertical: "trades",
          phone: "555-9999",
          services: ["Roofing", "Siding", "Gutters"],
          serviceArea: ["Metro Area"],
          primaryCTA: "Get Quote",
        }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { generateSetupPacket } = await import("./services/setupPacketGenerator");
      const packet = await generateSetupPacket(1, "quickbooks");

      expect(packet).not.toBeNull();
      expect(packet?.integration).toBe("quickbooks");
      
      // Check QuickBooks-specific fields
      if (packet?.integration === "quickbooks") {
        expect(packet.specific.customerTypes).toBeInstanceOf(Array);
        expect(packet.specific.customerTypes.length).toBeGreaterThan(0);
        expect(packet.specific.serviceItems).toHaveLength(3); // Roofing, Siding, Gutters
        expect(packet.specific.invoiceTemplate).toBeDefined();
        expect(packet.specific.chartOfAccountsStarter).toBeInstanceOf(Array);
      }
    });

    it("should return null for non-existent intake", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { generateSetupPacket } = await import("./services/setupPacketGenerator");
      const packet = await generateSetupPacket(999, "google_business");

      expect(packet).toBeNull();
    });

    it("should handle missing optional fields gracefully", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          businessName: "Minimal Business",
          vertical: "professional",
          // No phone, services, serviceArea, etc.
        }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { generateSetupPacket } = await import("./services/setupPacketGenerator");
      const packet = await generateSetupPacket(1, "google_business");

      expect(packet).not.toBeNull();
      expect(packet?.business.name).toBe("Minimal Business");
      expect(packet?.business.phone).toBe("");
      expect(packet?.services).toHaveLength(0);
      expect(packet?.assetsNeeded.length).toBeGreaterThan(0); // Should still have asset requirements
    });
  });

  describe("generateAllPackets", () => {
    it("should generate all three packets for an intake", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          businessName: "Full Business",
          vertical: "trades",
          phone: "555-0000",
          services: ["Service A"],
          serviceArea: ["Area 1"],
          primaryCTA: "Call Now",
        }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { generateAllPackets } = await import("./services/setupPacketGenerator");
      const packets = await generateAllPackets(1);

      expect(packets.google).not.toBeNull();
      expect(packets.meta).not.toBeNull();
      expect(packets.quickbooks).not.toBeNull();
      
      expect(packets.google?.integration).toBe("google_business");
      expect(packets.meta?.integration).toBe("meta");
      expect(packets.quickbooks?.integration).toBe("quickbooks");
    });
  });

  describe("Packet Content Quality", () => {
    it("should generate Google description under 750 characters", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          businessName: "A Very Long Business Name That Could Potentially Cause Issues",
          vertical: "professional",
          phone: "555-1111",
          services: Array(20).fill("Service"),
          serviceArea: Array(10).fill("Area"),
          primaryCTA: "Contact Us",
        }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { generateSetupPacket } = await import("./services/setupPacketGenerator");
      const packet = await generateSetupPacket(1, "google_business");

      if (packet?.integration === "google_business") {
        expect(packet.specific.description.length).toBeLessThanOrEqual(750);
      }
    });

    it("should generate Meta bio under 255 characters", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          businessName: "Another Very Long Business Name For Testing Purposes",
          vertical: "beauty",
          phone: "555-2222",
          services: ["Service"],
          serviceArea: ["Area"],
          primaryCTA: "Book Now",
        }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { generateSetupPacket } = await import("./services/setupPacketGenerator");
      const packet = await generateSetupPacket(1, "meta");

      if (packet?.integration === "meta") {
        expect(packet.specific.pageBio.length).toBeLessThanOrEqual(255);
      }
    });

    it("should include proper setup steps with deep links where applicable", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: 1,
          businessName: "Test Business",
          vertical: "trades",
          phone: "555-3333",
          services: ["Service"],
          serviceArea: ["Area"],
          primaryCTA: "Call Now",
        }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { generateSetupPacket } = await import("./services/setupPacketGenerator");
      const packet = await generateSetupPacket(1, "google_business");

      expect(packet?.setupSteps.length).toBeGreaterThan(0);
      
      // First step should have a deep link
      const firstStep = packet?.setupSteps[0];
      expect(firstStep?.deepLink).toBeDefined();
      expect(firstStep?.deepLink).toContain("google.com");
    });
  });
});
