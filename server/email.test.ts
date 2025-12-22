import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve({
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  })),
}));

// Mock the notification service
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(() => Promise.resolve(true)),
}));

import { getEmailTemplate, sendEmail } from "./email";

describe("Email Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEmailTemplate", () => {
    const baseData = {
      firstName: "John",
      businessName: "Smith Plumbing",
      email: "john@smithplumbing.com",
    };

    it("should generate intake confirmation email", () => {
      const template = getEmailTemplate("intake_confirmation", baseData);
      
      expect(template.subject).toBe("✅ We're building your website");
      expect(template.previewText).toContain("LaunchBase");
      expect(template.body).toContain("John");
      expect(template.body).toContain("24–72 hours");
    });

    it("should generate in-progress email", () => {
      const template = getEmailTemplate("in_progress", baseData);
      
      expect(template.subject).toBe("👷 Your site is in progress");
      expect(template.body).toContain("John");
      expect(template.body).toContain("being built");
    });

    it("should generate ready for review email with preview URL", () => {
      const template = getEmailTemplate("ready_for_review", {
        ...baseData,
        previewUrl: "https://preview.launchbase.com/abc123",
      });
      
      expect(template.subject).toBe("Your site preview is ready");
      expect(template.body).toContain("preview.launchbase.com/abc123");
      expect(template.body).toContain("Nothing is published yet");
    });

    it("should generate review nudge email", () => {
      const template = getEmailTemplate("review_nudge", {
        ...baseData,
        previewUrl: "https://preview.launchbase.com/abc123",
      });
      
      expect(template.subject).toBe("Just checking in — your site is ready");
      expect(template.body).toContain("no rush");
    });

    it("should generate launch confirmation email with live URL", () => {
      const template = getEmailTemplate("launch_confirmation", {
        ...baseData,
        liveUrl: "https://smithplumbing.com",
      });
      
      expect(template.subject).toBe("🎉 Your site is live!");
      expect(template.body).toContain("smithplumbing.com");
      expect(template.body).toContain("live");
    });

    it("should generate testimonial request email", () => {
      const template = getEmailTemplate("testimonial_request", baseData);
      
      expect(template.subject).toBe("Quick question (2 minutes)");
      expect(template.body).toContain("testimonial");
      expect(template.body).toContain("sentence or two");
    });

    it("should generate founding client lock-in email", () => {
      const template = getEmailTemplate("founding_client_lockin", baseData);
      
      expect(template.subject).toContain("founding client");
      expect(template.body).toContain("pricing never changes");
      expect(template.body).toContain("priority support");
    });

    it("should generate day 7 check-in email", () => {
      const template = getEmailTemplate("day7_checkin", baseData);
      
      expect(template.subject).toBe("Everything looking good?");
      expect(template.body).toContain("checking in");
    });

    it("should generate day 30 value email", () => {
      const template = getEmailTemplate("day30_value", baseData);
      
      expect(template.subject).toBe("Quick note from LaunchBase");
      expect(template.body).toContain("hosting");
      expect(template.body).toContain("updates");
      expect(template.body).toContain("support");
    });

    it("should return default template for unknown type", () => {
      const template = getEmailTemplate("unknown_type" as any, baseData);
      
      expect(template.subject).toBe("Update from LaunchBase");
      expect(template.body).toContain("John");
    });
  });

  describe("sendEmail", () => {
    it("should send email and return true on success", async () => {
      const result = await sendEmail(1, "intake_confirmation", {
        firstName: "John",
        businessName: "Smith Plumbing",
        email: "john@smithplumbing.com",
      });
      
      expect(result).toBe(true);
    });

    it("should log email to database", async () => {
      const { getDb } = await import("./db");
      
      await sendEmail(1, "ready_for_review", {
        firstName: "John",
        businessName: "Smith Plumbing",
        email: "john@smithplumbing.com",
        previewUrl: "https://preview.launchbase.com/abc123",
      });
      
      expect(getDb).toHaveBeenCalled();
    });
  });

  describe("Email Template Content Quality", () => {
    const baseData = {
      firstName: "Sarah",
      businessName: "Bright Smile Dental",
      email: "sarah@brightsmile.com",
    };

    it("should personalize all emails with first name", () => {
      const emailTypes = [
        "intake_confirmation",
        "in_progress",
        "ready_for_review",
        "review_nudge",
        "launch_confirmation",
        "testimonial_request",
        "founding_client_lockin",
        "day7_checkin",
        "day30_value",
      ] as const;

      for (const type of emailTypes) {
        const template = getEmailTemplate(type, baseData);
        expect(template.body).toContain("Sarah");
      }
    });

    it("should include LaunchBase signature in all emails", () => {
      const emailTypes = [
        "intake_confirmation",
        "in_progress",
        "ready_for_review",
      ] as const;

      for (const type of emailTypes) {
        const template = getEmailTemplate(type, baseData);
        expect(template.body).toContain("LaunchBase");
      }
    });

    it("should have appropriate tone for each email type", () => {
      // Confirmation should be reassuring
      const confirmation = getEmailTemplate("intake_confirmation", baseData);
      expect(confirmation.body).toContain("Thanks");
      
      // Nudge should be gentle
      const nudge = getEmailTemplate("review_nudge", baseData);
      expect(nudge.body).toContain("no rush");
      
      // Launch should be celebratory
      const launch = getEmailTemplate("launch_confirmation", {
        ...baseData,
        liveUrl: "https://example.com",
      });
      expect(launch.subject).toContain("🎉");
    });
  });
});
