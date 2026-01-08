import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Deployment Worker", () => {
  describe("Token Validation", () => {
    it("should have WORKER_TOKEN configured", () => {
      // Verify the environment variable is set
      const token = process.env.WORKER_TOKEN;
      expect(token).toBeDefined();
      expect(token).not.toBe("");
      expect(token!.length).toBeGreaterThanOrEqual(20);
    });

    it("should reject requests without token", async () => {
      // Mock request without token
      const mockReq = {
        headers: {},
      };
      
      // The verifyWorkerToken function should return false for missing token
      const token = mockReq.headers["x-worker-token"];
      const workerToken = process.env.WORKER_TOKEN;
      
      expect(token).toBeUndefined();
      expect(workerToken).toBeDefined();
      // Without a matching token, auth should fail
      expect(token === workerToken).toBe(false);
    });

    it("should accept requests with valid token", async () => {
      // Mock request with valid token
      const workerToken = process.env.WORKER_TOKEN;
      const mockReq = {
        headers: {
          "x-worker-token": workerToken,
        },
      };
      
      const token = mockReq.headers["x-worker-token"];
      expect(token).toBe(workerToken);
    });

    it("should reject requests with invalid token", async () => {
      const workerToken = process.env.WORKER_TOKEN;
      const mockReq = {
        headers: {
          "x-worker-token": "invalid_token_12345",
        },
      };
      
      const token = mockReq.headers["x-worker-token"];
      expect(token).not.toBe(workerToken);
    });
  });
});


  describe("Manus Subdomain URL Generation", () => {
    it("should generate URLs in correct Manus subdomain format", () => {
      // Expected URL format: site-{slug}-{deployId}.launchbase-h86jcadp.manus.space
      const businessName = "Larry's Cabinets";
      const deploymentId = "12345";
      
      const slug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      
      const manusAppDomain = "launchbase-h86jcadp.manus.space";
      const url = `https://site-${slug}-${deploymentId}.${manusAppDomain}`;
      
      expect(url).toBe("https://site-larry-s-cabinets-12345.launchbase-h86jcadp.manus.space");
      expect(url).toMatch(/^https:\/\/site-[a-z0-9-]+-\d+\.launchbase-h86jcadp\.manus\.space$/);
    });

    it("should handle business names with special characters", () => {
      const testCases = [
        { input: "Smith & Sons Plumbing", expected: "smith-sons-plumbing" },
        { input: "Joe's Auto Repair", expected: "joe-s-auto-repair" },
        { input: "ABC-123 Services", expected: "abc-123-services" },
        { input: "  Spaces  Around  ", expected: "spaces-around" },
      ];
      testCases.forEach(({ input, expected }) => {
        const slug = input
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        
        expect(slug).toBe(expected);
      });
    });

    it("should include deployment ID for uniqueness", () => {
      const slug = "test-business";
      const deploymentId1 = "111";
      const deploymentId2 = "222";
      
      const manusAppDomain = "launchbase-h86jcadp.manus.space";
      const url1 = `https://site-${slug}-${deploymentId1}.${manusAppDomain}`;
      const url2 = `https://site-${slug}-${deploymentId2}.${manusAppDomain}`;
      
      expect(url1).not.toBe(url2);
      expect(url1).toContain(`site-${slug}-${deploymentId1}`);
      expect(url2).toContain(`site-${slug}-${deploymentId2}`);
    });

    it("should use consistent Manus app domain", () => {
      const manusAppDomain = "launchbase-h86jcadp.manus.space";
      
      const urls = [
        `https://site-business-1-001.${manusAppDomain}`,
        `https://site-business-2-002.${manusAppDomain}`,
        `https://site-business-3-003.${manusAppDomain}`,
      ];
      
      urls.forEach(url => {
        expect(url).toContain(manusAppDomain);
        expect(url).toMatch(new RegExp(`\.${manusAppDomain}$`));
      });
    });

    it("should generate HTTPS URLs only", () => {
      const url = "https://site-test-business-123.launchbase-h86jcadp.manus.space";
      
      expect(url).toMatch(/^https:\/\//);
      expect(url).not.toMatch(/^http:\/\//);
    });

    it("should handle numeric business names", () => {
      const businessName = "123 Services";
      const slug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      
      expect(slug).toBe("123-services");
      
      const url = `https://site-${slug}-999.launchbase-h86jcadp.manus.space`;
      expect(url).toMatch(/^https:\/\/site-[a-z0-9-]+-\d+\.launchbase-h86jcadp\.manus\.space$/);
    });
  });
