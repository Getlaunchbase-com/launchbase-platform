import { describe, it, expect } from "vitest";
import { getEmailCopy } from "../emails/emailCopy";

describe("emailCopy: websiteStatus variants (FOREVER)", () => {
  it("defaults to none when websiteStatus missing", () => {
    const a = getEmailCopy({
      language: "en",
      audience: "biz",
      emailType: "intake_confirmation",
      websiteStatus: undefined,
    });

    const b = getEmailCopy({
      language: "en",
      audience: "biz",
      emailType: "intake_confirmation",
      websiteStatus: "none",
    });

    expect(a.subject).toBe(b.subject);
  });

  it("selects different variants for intake_confirmation", () => {
    const none = getEmailCopy({
      language: "en",
      audience: "biz",
      emailType: "intake_confirmation",
      websiteStatus: "none",
    });

    const existing = getEmailCopy({
      language: "en",
      audience: "biz",
      emailType: "intake_confirmation",
      websiteStatus: "existing",
    });

    const systems = getEmailCopy({
      language: "en",
      audience: "biz",
      emailType: "intake_confirmation",
      websiteStatus: "systems_only",
    });

    // Hard requirement: variants should not be identical
    expect(new Set([none.subject, existing.subject, systems.subject]).size).toBe(3);
    
    // Distinctiveness check: each variant has unique keyword
    expect(none.subject).toContain("from scratch");
    expect(existing.subject).toContain("refreshing");
    expect(systems.subject).toContain("integrate");
  });

  it("non-variant email types still return EmailBlock (compat shim)", () => {
    const copy = getEmailCopy({
      language: "en",
      audience: "biz",
      emailType: "deployment_started",
      websiteStatus: "systems_only",
    });

    expect(copy).toBeTruthy();
    expect(typeof copy.subject).toBe("string");
    expect(typeof copy.body).toBe("string");
  });
});
