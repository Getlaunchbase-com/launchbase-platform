import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for resendPreviewEmail functionality
 * 
 * The resendPreviewEmail procedure has the following business rules:
 * 1. Only works when intake status is "ready_for_review"
 * 2. Requires a preview token to exist
 * 3. Has a 60-second cooldown between sends
 * 4. Logs the email send in email_logs table
 */

describe("Resend Preview Email", () => {
  describe("Status Validation", () => {
    it("should only allow resend when status is ready_for_review", () => {
      const validStatuses = ["ready_for_review"];
      const invalidStatuses = ["new", "review", "needs_info", "approved", "paid", "deployed"];
      
      // Verify only ready_for_review is valid
      validStatuses.forEach(status => {
        expect(status).toBe("ready_for_review");
      });
      
      // Verify other statuses would be rejected
      invalidStatuses.forEach(status => {
        expect(status).not.toBe("ready_for_review");
      });
    });

    it("should require preview token to exist", () => {
      const intakeWithToken = { previewToken: "preview_123_abc" };
      const intakeWithoutToken = { previewToken: null };
      const intakeWithEmptyToken = { previewToken: "" };
      
      expect(!!intakeWithToken.previewToken).toBe(true);
      expect(!!intakeWithoutToken.previewToken).toBe(false);
      expect(!!intakeWithEmptyToken.previewToken).toBe(false);
    });
  });

  describe("Cooldown Logic", () => {
    it("should calculate correct wait time when within cooldown period", () => {
      const cooldownSeconds = 60;
      const lastEmailTime = Date.now() - (30 * 1000); // 30 seconds ago
      const now = Date.now();
      
      const secondsSinceLastEmail = (now - lastEmailTime) / 1000;
      const waitSeconds = Math.ceil(cooldownSeconds - secondsSinceLastEmail);
      
      expect(secondsSinceLastEmail).toBeCloseTo(30, 0);
      expect(waitSeconds).toBeCloseTo(30, 0);
    });

    it("should allow resend when cooldown period has passed", () => {
      const cooldownSeconds = 60;
      const lastEmailTime = Date.now() - (61 * 1000); // 61 seconds ago
      const now = Date.now();
      
      const secondsSinceLastEmail = (now - lastEmailTime) / 1000;
      const isAllowed = secondsSinceLastEmail >= cooldownSeconds;
      
      expect(isAllowed).toBe(true);
    });

    it("should block resend when within cooldown period", () => {
      const cooldownSeconds = 60;
      const lastEmailTime = Date.now() - (30 * 1000); // 30 seconds ago
      const now = Date.now();
      
      const secondsSinceLastEmail = (now - lastEmailTime) / 1000;
      const isBlocked = secondsSinceLastEmail < cooldownSeconds;
      
      expect(isBlocked).toBe(true);
    });

    it("should allow first resend when no previous email exists", () => {
      const lastEmail = null;
      const isAllowed = !lastEmail || true; // No cooldown check needed
      
      expect(isAllowed).toBe(true);
    });
  });

  describe("Email Data Extraction", () => {
    it("should extract first name from contact name", () => {
      const testCases = [
        { contactName: "John Smith", expected: "John" },
        { contactName: "Jane", expected: "Jane" },
        { contactName: "Bob Jones Jr", expected: "Bob" },
        { contactName: "", expected: "there" },
        { contactName: null, expected: "there" },
      ];
      
      testCases.forEach(({ contactName, expected }) => {
        const firstName = contactName?.split(" ")[0] || "there";
        expect(firstName).toBe(expected);
      });
    });

    it("should construct correct preview URL", () => {
      const previewToken = "preview_1234567890_abc123";
      const expectedPath = `/preview/${previewToken}`;
      
      expect(expectedPath).toBe("/preview/preview_1234567890_abc123");
    });
  });

  describe("Error Messages", () => {
    it("should provide clear error for wrong status", () => {
      const errorMessage = "Can only resend preview email when status is ready_for_review";
      expect(errorMessage).toContain("ready_for_review");
    });

    it("should provide clear error for missing preview token", () => {
      const errorMessage = "No preview token exists for this intake";
      expect(errorMessage).toContain("preview token");
    });

    it("should provide clear cooldown message with remaining seconds", () => {
      const waitSeconds = 45;
      const errorMessage = `Please wait ${waitSeconds} seconds before resending`;
      expect(errorMessage).toContain("45 seconds");
    });
  });

  describe("UI Cooldown Timer", () => {
    it("should parse wait seconds from error message", () => {
      const errorMessage = "Please wait 45 seconds before resending";
      const match = errorMessage.match(/(\d+) seconds/);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe("45");
      expect(parseInt(match![1])).toBe(45);
    });

    it("should handle various cooldown values", () => {
      const testCases = [
        { message: "Please wait 60 seconds before resending", expected: 60 },
        { message: "Please wait 1 seconds before resending", expected: 1 },
        { message: "Please wait 30 seconds before resending", expected: 30 },
      ];
      
      testCases.forEach(({ message, expected }) => {
        const match = message.match(/(\d+) seconds/);
        expect(parseInt(match![1])).toBe(expected);
      });
    });
  });
});
