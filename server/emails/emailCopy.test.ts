import { describe, it, expect } from "vitest";
import { getEmailCopy } from "./emailCopy";

describe("Email Copy Variant Selection (FOREVER TEST)", () => {
  describe("intake_confirmation variants by websiteStatus", () => {
    it("should return 'none' variant when websiteStatus is 'none'", () => {
      const copy = getEmailCopy({
        language: "en",
        audience: "biz",
        emailType: "intake_confirmation",
        websiteStatus: "none",
      });
      
      expect(copy.subject).toContain("from scratch");
      expect(copy.body).toContain("don't currently have a website");
    });

    it("should return 'existing' variant when websiteStatus is 'existing'", () => {
      const copy = getEmailCopy({
        language: "en",
        audience: "biz",
        emailType: "intake_confirmation",
        websiteStatus: "existing",
      });
      
      expect(copy.subject).toContain("refreshing");
      expect(copy.body).toContain("already have a website");
    });

    it("should return 'systems_only' variant when websiteStatus is 'systems_only'", () => {
      const copy = getEmailCopy({
        language: "en",
        audience: "biz",
        emailType: "intake_confirmation",
        websiteStatus: "systems_only",
      });
      
      expect(copy.subject).toContain("integrate");
      expect(copy.body).toContain("website you want to keep");
    });

    it("should default to 'none' variant when websiteStatus is undefined", () => {
      const copy = getEmailCopy({
        language: "en",
        audience: "biz",
        emailType: "intake_confirmation",
        websiteStatus: undefined,
      });
      
      expect(copy.subject).toContain("from scratch");
    });
  });

  describe("Non-variant emails should work without websiteStatus", () => {
    it("should return in_progress email without websiteStatus", () => {
      const copy = getEmailCopy({
        language: "en",
        audience: "biz",
        emailType: "in_progress",
      });
      
      expect(copy.subject).toBeDefined();
      expect(copy.body).toBeDefined();
    });
  });

  describe("Multilingual variant support", () => {
    it("should return Spanish 'existing' variant", () => {
      const copy = getEmailCopy({
        language: "es",
        audience: "biz",
        emailType: "intake_confirmation",
        websiteStatus: "existing",
      });
      
      expect(copy.subject).toContain("Actualizamos");
      expect(copy.body).toContain("Ya tienes un sitio web");
    });

    it("should return Polish 'systems_only' variant", () => {
      const copy = getEmailCopy({
        language: "pl",
        audience: "biz",
        emailType: "intake_confirmation",
        websiteStatus: "systems_only",
      });
      
      expect(copy.subject).toContain("Zintegrujemy");
      expect(copy.body).toContain("Masz stronę, którą chcesz zachować");
    });
  });

  describe("Audience variants (biz vs org)", () => {
    it("should return org-tone copy for audience=org", () => {
      const copy = getEmailCopy({
        language: "en",
        audience: "org",
        emailType: "intake_confirmation",
        websiteStatus: "none",
      });
      
      // Org copy should be present (exact wording may vary)
      expect(copy.subject).toBeDefined();
      expect(copy.body).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should throw on missing email type", () => {
      expect(() => {
        getEmailCopy({
          language: "en",
          audience: "biz",
          emailType: "nonexistent_email" as any,
        });
      }).toThrow();
    });
  });
});
