/**
 * FOREVER CONTRACT: Email Localization Smoke Test
 * 
 * This test proves the email localization system works end-to-end:
 * ✅ getEmailCopy() returns correct language × audience combination
 * ✅ interpolateEmail() replaces template variables correctly
 * ✅ getEmailTemplate() integrates both helpers correctly
 * ✅ All 3 languages (EN, ES, PL) × 2 audiences (biz, org) = 6 combinations work
 */

import { describe, it, expect } from "vitest";
import { getEmailCopy, interpolateEmail, type Language, type Audience } from "../emails/emailCopy";
import { getEmailTemplate } from "../email";

describe("Email Localization System", () => {
  describe("getEmailCopy", () => {
    it("returns English business copy by default", () => {
      const copy = getEmailCopy({ language: "en", audience: "biz", emailType: "intake_confirmation" });
      expect(copy.subject).toContain("We're building");
      expect(copy.body).toContain("Thanks for completing");
    });

    it("returns Spanish business copy", () => {
      const copy = getEmailCopy({ language: "es", audience: "biz", emailType: "intake_confirmation" });
      expect(copy.subject).toContain("Estamos construyendo");
      expect(copy.body).toContain("Gracias por completar");
    });

    it("returns Polish business copy", () => {
      const copy = getEmailCopy({ language: "pl", audience: "biz", emailType: "intake_confirmation" });
      expect(copy.subject).toContain("Budujemy");
      expect(copy.body).toContain("Dziękujemy");
    });

    it("returns English organization copy", () => {
      const copy = getEmailCopy({ language: "en", audience: "org", emailType: "intake_confirmation" });
      expect(copy.subject).toContain("system build");
      expect(copy.body).toContain("assembling the system");
    });

    it("returns Spanish organization copy", () => {
      const copy = getEmailCopy({ language: "es", audience: "org", emailType: "intake_confirmation" });
      expect(copy.subject).toContain("sistema");
      expect(copy.body).toContain("ensamblando");
    });

    it("returns Polish organization copy", () => {
      const copy = getEmailCopy({ language: "pl", audience: "org", emailType: "intake_confirmation" });
      expect(copy.subject).toContain("system");
      expect(copy.body).toContain("Montujemy");
    });

    it("falls back to English business for invalid language", () => {
      const copy = getEmailCopy({ language: "invalid" as Language, audience: "biz", emailType: "intake_confirmation" });
      expect(copy.subject).toContain("We're building");
    });

    it("falls back to English business for invalid audience", () => {
      const copy = getEmailCopy({ language: "en", audience: "invalid" as Audience, emailType: "intake_confirmation" });
      expect(copy.subject).toContain("We're building");
    });
  });

  describe("interpolateEmail", () => {
    it("replaces firstName variable", () => {
      const result = interpolateEmail("Hi {{firstName}}, welcome!", {
        firstName: "John",
        businessName: "Test Co",
      });
      expect(result).toBe("Hi John, welcome!");
    });

    it("replaces businessName variable", () => {
      const result = interpolateEmail("Welcome to {{businessName}}", {
        firstName: "John",
        businessName: "Test Co",
      });
      expect(result).toBe("Welcome to Test Co");
    });

    it("replaces previewUrl variable", () => {
      const result = interpolateEmail("View: {{previewUrl}}", {
        firstName: "John",
        businessName: "Test Co",
        previewUrl: "https://example.com/preview",
      });
      expect(result).toBe("View: https://example.com/preview");
    });

    it("replaces liveUrl variable", () => {
      const result = interpolateEmail("Site: {{liveUrl}}", {
        firstName: "John",
        businessName: "Test Co",
        liveUrl: "https://example.com",
      });
      expect(result).toBe("Site: https://example.com");
    });

    it("uses fallback for missing previewUrl", () => {
      const result = interpolateEmail("View: {{previewUrl}}", {
        firstName: "John",
        businessName: "Test Co",
      });
      expect(result).toBe("View: [Preview URL]");
    });

    it("replaces multiple variables in one template", () => {
      const result = interpolateEmail(
        "Hi {{firstName}}, {{businessName}} preview: {{previewUrl}}",
        {
          firstName: "John",
          businessName: "Test Co",
          previewUrl: "https://example.com/preview",
        }
      );
      expect(result).toBe("Hi John, Test Co preview: https://example.com/preview");
    });
  });

  describe("getEmailTemplate integration", () => {
    it("generates English business email correctly", () => {
      const template = getEmailTemplate("intake_confirmation", {
        firstName: "John",
        businessName: "Smith Plumbing",
        email: "john@smithplumbing.com",
        language: "en",
        audience: "biz",
      });

      expect(template.subject).toContain("We're building");
      expect(template.body).toContain("Hi John,");
      expect(template.body).not.toContain("{{firstName}}");
    });

    it("generates Spanish business email correctly", () => {
      const template = getEmailTemplate("intake_confirmation", {
        firstName: "Juan",
        businessName: "Plomería López",
        email: "juan@plomerialopez.com",
        language: "es",
        audience: "biz",
      });

      expect(template.subject).toContain("Estamos construyendo");
      expect(template.body).toContain("Hola Juan,");
      expect(template.body).not.toContain("{{firstName}}");
    });

    it("generates Polish business email correctly", () => {
      const template = getEmailTemplate("intake_confirmation", {
        firstName: "Jan",
        businessName: "Hydraulika Kowalski",
        email: "jan@hydraulika.pl",
        language: "pl",
        audience: "biz",
      });

      expect(template.subject).toContain("Budujemy");
      expect(template.body).toContain("Cześć Jan,");
      expect(template.body).not.toContain("{{firstName}}");
    });

    it("generates English organization email correctly", () => {
      const template = getEmailTemplate("intake_confirmation", {
        firstName: "Sarah",
        businessName: "Acme Corp",
        email: "sarah@acme.com",
        language: "en",
        audience: "org",
      });

      expect(template.subject).toContain("system build");
      expect(template.body).toContain("Hi Sarah,");
      expect(template.body).toContain("assembling the system");
    });

    it("generates Spanish organization email correctly", () => {
      const template = getEmailTemplate("intake_confirmation", {
        firstName: "María",
        businessName: "Corporación Global",
        email: "maria@global.com",
        language: "es",
        audience: "org",
      });

      expect(template.subject).toContain("sistema");
      expect(template.body).toContain("Hola María,");
      expect(template.body).toContain("ensamblando");
    });

    it("generates Polish organization email correctly", () => {
      const template = getEmailTemplate("intake_confirmation", {
        firstName: "Anna",
        businessName: "Korporacja Tech",
        email: "anna@tech.pl",
        language: "pl",
        audience: "org",
      });

      expect(template.subject).toContain("system");
      expect(template.body).toContain("Cześć Anna,");
      expect(template.body).toContain("Montujemy");
    });

    it("defaults to English business when language not provided", () => {
      const template = getEmailTemplate("intake_confirmation", {
        firstName: "John",
        businessName: "Test Co",
        email: "john@test.com",
      });

      expect(template.subject).toContain("We're building");
      expect(template.body).toContain("Hi John,");
    });

    it("interpolates previewUrl correctly in Spanish", () => {
      const template = getEmailTemplate("ready_for_review", {
        firstName: "Juan",
        businessName: "Test Co",
        email: "juan@test.com",
        previewUrl: "https://example.com/preview/abc123",
        language: "es",
        audience: "biz",
      });

      expect(template.body).toContain("https://example.com/preview/abc123");
      expect(template.body).not.toContain("{{previewUrl}}");
    });

    it("interpolates liveUrl correctly in Polish", () => {
      const template = getEmailTemplate("site_live", {
        firstName: "Jan",
        businessName: "Test Co",
        email: "jan@test.com",
        liveUrl: "https://test.com",
        language: "pl",
        audience: "biz",
      });

      expect(template.body).toContain("https://test.com");
      expect(template.body).not.toContain("{{liveUrl}}");
    });
  });

  describe("All email types × languages × audiences", () => {
    const emailTypes = [
      "intake_confirmation",
      "in_progress",
      "ready_for_review",
      "review_nudge",
      "deployment_started",
      "site_live",
    ] as const;

    const languages: Language[] = ["en", "es", "pl"];
    const audiences: Audience[] = ["biz", "org"];

    emailTypes.forEach((emailType) => {
      languages.forEach((language) => {
        audiences.forEach((audience) => {
          it(`${emailType} works for ${language} ${audience}`, () => {
            const copy = getEmailCopy({ language, audience, emailType });
            
            // All emails must have these fields
            expect(copy.subject).toBeTruthy();
            expect(copy.subject.length).toBeGreaterThan(0);
            expect(copy.previewText).toBeTruthy();
            expect(copy.body).toBeTruthy();
            expect(copy.body.length).toBeGreaterThan(10);
            
            // Body should contain template variables or be ready for interpolation
            // (some emails don't have URLs, so we just check it's not empty)
            expect(copy.body).not.toBe("");
          });
        });
      });
    });
  });
});
