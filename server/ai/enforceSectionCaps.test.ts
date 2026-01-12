/**
 * Tests for Section-Specific Cap Enforcement
 */

import { describe, it, expect } from "vitest";
import { enforceSectionCaps } from "./enforceSectionCaps";
import type { CopyProposal } from "./contracts/types";

describe("enforceSectionCaps", () => {
  // ============================================
  // HERO SECTION TESTS
  // ============================================

  describe("hero section", () => {
    it("should accept headline <= 80 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.headline",
            value: "A".repeat(80), // Exactly 80
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(true);
    });

    it("should reject headline > 80 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.headline",
            value: "A".repeat(81), // ❌ Over 80
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("cap_violation");
        expect(result.errors.some((e) => e.includes("80 chars"))).toBe(true);
      }
    });

    it("should accept subheadline <= 140 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.subheadline",
            value: "A".repeat(140), // Exactly 140
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(true);
    });

    it("should reject subheadline > 140 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.subheadline",
            value: "A".repeat(141), // ❌ Over 140
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("cap_violation");
        expect(result.errors.some((e) => e.includes("140 chars"))).toBe(true);
      }
    });

    it("should accept CTA <= 60 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.cta",
            value: "A".repeat(60), // Exactly 60
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(true);
    });

    it("should reject CTA > 60 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.cta",
            value: "A".repeat(61), // ❌ Over 60
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("cap_violation");
        expect(result.errors.some((e) => e.includes("60 chars"))).toBe(true);
      }
    });
  });

  // ============================================
  // SERVICES SECTION TESTS
  // ============================================

  describe("services section", () => {
    it("should accept 3-5 services", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "services.items",
            value: [
              { name: "Service 1", line: "Description 1" },
              { name: "Service 2", line: "Description 2" },
              { name: "Service 3", line: "Description 3" },
            ],
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(true);
    });

    it("should reject > 5 services", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "services.items",
            value: [
              { name: "Service 1", line: "Description 1" },
              { name: "Service 2", line: "Description 2" },
              { name: "Service 3", line: "Description 3" },
              { name: "Service 4", line: "Description 4" },
              { name: "Service 5", line: "Description 5" },
              { name: "Service 6", line: "Description 6" }, // ❌ Over 5
            ],
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("cap_violation");
        expect(result.errors.some((e) => e.includes("at most 5 items"))).toBe(true);
      }
    });

    it("should reject service name > 60 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "services.items",
            value: [
              { name: "A".repeat(61), line: "Description 1" }, // ❌ Name over 60
              { name: "Service 2", line: "Description 2" },
              { name: "Service 3", line: "Description 3" },
            ],
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("cap_violation");
        expect(result.errors.some((e) => e.includes("60 chars"))).toBe(true);
      }
    });

    it("should reject service line > 120 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "services.items",
            value: [
              { name: "Service 1", line: "A".repeat(121) }, // ❌ Line over 120
              { name: "Service 2", line: "Description 2" },
              { name: "Service 3", line: "Description 3" },
            ],
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("cap_violation");
        expect(result.errors.some((e) => e.includes("120 chars"))).toBe(true);
      }
    });
  });

  // ============================================
  // SOCIAL PROOF TESTS
  // ============================================

  describe("socialProof section", () => {
    it("should accept reviews with valid lengths", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "socialProof.reviews",
            value: {
              reviews: [
                { text: "A".repeat(240), author: "A".repeat(60) }, // Max lengths
                { text: "Great service!", author: "John Doe" },
                { text: "Highly recommend", author: "Jane Smith" },
              ],
            },
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(true);
    });

    it("should reject review text > 240 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "socialProof.reviews",
            value: {
              reviews: [
                { text: "A".repeat(241), author: "John Doe" }, // ❌ Over 240
                { text: "Great!", author: "Jane Smith" },
                { text: "Amazing!", author: "Bob Johnson" },
              ],
            },
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("cap_violation");
        expect(result.errors.some((e) => e.includes("240 chars"))).toBe(true);
      }
    });

    it("should accept outcomes with valid lengths", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "socialProof.outcomes",
            value: {
              outcomes: [
                { metric: "A".repeat(20), label: "A".repeat(120) }, // Max lengths
                { metric: "98%", label: "Customer Satisfaction" },
                { metric: "10 years", label: "In Business" },
              ],
            },
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(true);
    });

    it("should reject outcome metric > 20 chars", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "socialProof.outcomes",
            value: {
              outcomes: [
                { metric: "A".repeat(21), label: "Projects" }, // ❌ Over 20
                { metric: "98%", label: "Satisfaction" },
                { metric: "10 years", label: "Experience" },
              ],
            },
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("cap_violation");
        expect(result.errors.some((e) => e.includes("20 chars"))).toBe(true);
      }
    });
  });

  // ============================================
  // MULTIPLE ERRORS TEST
  // ============================================

  describe("multiple violations", () => {
    it("should report all cap violations", () => {
      const proposal: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.headline",
            value: "A".repeat(81), // ❌ Over 80
            rationale: "Test",
            confidence: 0.8,
          },
          {
            targetKey: "hero.cta",
            value: "A".repeat(61), // ❌ Over 60
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = enforceSectionCaps(proposal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(2);
        expect(result.errors.some((e) => e.includes("80 chars"))).toBe(true);
        expect(result.errors.some((e) => e.includes("60 chars"))).toBe(true);
      }
    });
  });
});
