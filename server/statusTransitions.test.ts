import { describe, it, expect } from "vitest";
import { isValidTransition, validateTransitionRequirements, VALID_TRANSITIONS } from "./statusTransitions";

describe("Status Transitions", () => {
  describe("isValidTransition", () => {
    it("should allow new → review transition", () => {
      const result = isValidTransition("new", "review", "admin");
      expect(result.valid).toBe(true);
    });

    it("should allow review → ready_for_review transition", () => {
      const result = isValidTransition("review", "ready_for_review", "admin");
      expect(result.valid).toBe(true);
    });

    it("should allow ready_for_review → approved transition (customer approval)", () => {
      const result = isValidTransition("ready_for_review", "approved", "customer");
      expect(result.valid).toBe(true);
    });

    it("should BLOCK approved → paid transition from system (only stripe allowed)", () => {
      const result = isValidTransition("approved", "paid", "system");
      expect(result.valid).toBe(false);
    });

    it("should allow approved → paid transition from stripe", () => {
      const result = isValidTransition("approved", "paid", "stripe");
      expect(result.valid).toBe(true);
    });

    it("should allow paid → deployed transition", () => {
      const result = isValidTransition("paid", "deployed", "admin");
      expect(result.valid).toBe(true);
    });

    it("should BLOCK new → approved transition (skips preview)", () => {
      const result = isValidTransition("new", "approved", "admin");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });

    it("should BLOCK new → deployed transition (skips everything)", () => {
      const result = isValidTransition("new", "deployed", "admin");
      expect(result.valid).toBe(false);
    });

    it("should BLOCK review → deployed transition (skips payment)", () => {
      const result = isValidTransition("review", "deployed", "admin");
      expect(result.valid).toBe(false);
    });

    it("should BLOCK ready_for_review → deployed transition (skips payment)", () => {
      const result = isValidTransition("ready_for_review", "deployed", "admin");
      expect(result.valid).toBe(false);
    });

    it("should BLOCK approved → deployed transition (skips payment)", () => {
      const result = isValidTransition("approved", "deployed", "admin");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });

    it("should allow needs_info → ready_for_review transition", () => {
      const result = isValidTransition("needs_info", "ready_for_review", "admin");
      expect(result.valid).toBe(true);
    });

    it("should BLOCK same status transition (no-op not allowed)", () => {
      const result = isValidTransition("review", "review", "admin");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateTransitionRequirements", () => {
    const baseIntake = {
      previewToken: null as string | null,
      paidAt: null as Date | null,
      stripePaymentIntentId: null as string | null,
    };

    it("should allow review → ready_for_review transition", () => {
      const result = validateTransitionRequirements(baseIntake, "review", "ready_for_review");
      expect(result.valid).toBe(true);
    });

    it("should require preview token for approved transition", () => {
      const result = validateTransitionRequirements(baseIntake, "ready_for_review", "approved");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("preview");
    });

    it("should allow approved transition with preview token", () => {
      const intakeWithPreview = { ...baseIntake, previewToken: "preview_123" };
      const result = validateTransitionRequirements(intakeWithPreview, "ready_for_review", "approved");
      expect(result.valid).toBe(true);
    });
  });

  describe("VALID_TRANSITIONS map", () => {
    it("should define transitions for all intake statuses", () => {
      const expectedStatuses = ["new", "review", "needs_info", "ready_for_review", "approved", "paid", "deployed"];
      for (const status of expectedStatuses) {
        expect(VALID_TRANSITIONS[status as keyof typeof VALID_TRANSITIONS]).toBeDefined();
      }
    });

    it("should have ready_for_review as the only path to approved", () => {
      // Only ready_for_review should be able to transition to approved
      expect(VALID_TRANSITIONS["ready_for_review"]).toContain("approved");
      expect(VALID_TRANSITIONS["new"]).not.toContain("approved");
      expect(VALID_TRANSITIONS["review"]).not.toContain("approved");
    });

    it("should have paid as the only path to deployed", () => {
      // Only paid should be able to transition to deployed
      expect(VALID_TRANSITIONS["paid"]).toContain("deployed");
      expect(VALID_TRANSITIONS["approved"]).not.toContain("deployed");
      expect(VALID_TRANSITIONS["ready_for_review"]).not.toContain("deployed");
    });
  });
});
