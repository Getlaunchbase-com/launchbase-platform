/**
 * Facebook Webhook Tests
 * Tests webhook verification and signature validation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  verifyWebhookSignature,
  handleWebhookVerification,
} from "../services/facebookWebhook";
import crypto from "crypto";

describe("Facebook Webhook", () => {
  describe("handleWebhookVerification", () => {
    it("should verify webhook with correct token", () => {
      const result = handleWebhookVerification({
        "hub.mode": "subscribe",
        "hub.verify_token": "launchbase_fb_webhook_2026",
        "hub.challenge": "test_challenge_123",
      });

      expect(result.success).toBe(true);
      expect(result.challenge).toBe("test_challenge_123");
    });

    it("should reject webhook with incorrect token", () => {
      const result = handleWebhookVerification({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong_token",
        "hub.challenge": "test_challenge_123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Verification failed");
    });

    it("should reject webhook with incorrect mode", () => {
      const result = handleWebhookVerification({
        "hub.mode": "unsubscribe",
        "hub.verify_token": "launchbase_fb_webhook_2026",
        "hub.challenge": "test_challenge_123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Verification failed");
    });
  });

  describe("verifyWebhookSignature", () => {
    it("should verify valid signature", () => {
      // Use the actual FB_APP_SECRET from environment (set by test setup or default "")
      const FB_APP_SECRET = process.env.FB_APP_SECRET || "";
      const payload = JSON.stringify({ test: "data" });
      const hmac = crypto.createHmac("sha256", FB_APP_SECRET);
      hmac.update(payload);
      const signature = "sha256=" + hmac.digest("hex");

      const result = verifyWebhookSignature(payload, signature);
      expect(result).toBe(true);
    });

    it("should reject invalid signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const signature = "sha256=invalid_signature";

      const result = verifyWebhookSignature(payload, signature);
      expect(result).toBe(false);
    });

    it("should reject missing signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const signature = "";

      const result = verifyWebhookSignature(payload, signature);
      expect(result).toBe(false);
    });

    it("should reject signature without sha256 prefix", () => {
      const FB_APP_SECRET = process.env.FB_APP_SECRET || "";
      const payload = JSON.stringify({ test: "data" });
      const hmac = crypto.createHmac("sha256", FB_APP_SECRET);
      hmac.update(payload);
      const signature = hmac.digest("hex"); // Missing "sha256=" prefix

      const result = verifyWebhookSignature(payload, signature);
      expect(result).toBe(false);
    });
  });
});
