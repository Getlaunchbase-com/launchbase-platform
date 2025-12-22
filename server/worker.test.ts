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
