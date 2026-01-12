/**
 * Tests for AI Output Validation
 * 
 * Ensures all contract schemas are enforced correctly
 */

import { describe, it, expect } from "vitest";
import { validateAiOutput } from "./validateAiOutput";
import type {
  CopyProposal,
  DesignTokensProposal,
  IntentParse,
  Critique,
  DecisionCollapse,
} from "./contracts/types";

describe("validateAiOutput", () => {
  // ============================================
  // COPY PROPOSAL TESTS
  // ============================================

  describe("copy_proposal", () => {
    it("should accept valid copy proposal", () => {
      const valid: CopyProposal = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.headline",
            value: "Stop carrying the system in your head",
            rationale: "Direct, outcome-focused",
            confidence: 0.85,
            risks: ["May be too direct"],
          },
        ],
        requiresApproval: true,
        confidence: 0.87,
        risks: ["Customer may prefer different tone"],
        assumptions: ["Customer wants outcome-focused copy"],
      };

      const result = validateAiOutput<CopyProposal>("copy_proposal", valid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.schemaVersion).toBe("v1");
        expect(result.data.variants).toHaveLength(1);
      }
    });

    it("should reject extra fields (additionalProperties)", () => {
      const invalid = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.headline",
            value: "Test",
            rationale: "Test",
            confidence: 0.8,
            extraField: "not allowed", // ❌ Extra field
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<CopyProposal>("copy_proposal", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("schema_violation");
        expect(result.errors.some((e) => e.includes("additionalProperty"))).toBe(true);
      }
    });

    it("should reject wrong targetKey", () => {
      const invalid = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "invalid.key", // ❌ Not whitelisted
            value: "Test",
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<CopyProposal>("copy_proposal", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("enum") || e.includes("one of"))).toBe(true);
      }
    });

    it("should reject over-length headline", () => {
      const invalid = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.headline",
            value: "A".repeat(121), // ❌ Max 120 chars
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<CopyProposal>("copy_proposal", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("120 chars"))).toBe(true);
      }
    });

    it("should reject services with < 3 items", () => {
      const invalid = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "services.items",
            value: [
              { name: "Service 1", line: "Description 1" },
              { name: "Service 2", line: "Description 2" },
            ], // ❌ Min 3 items
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<CopyProposal>("copy_proposal", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("3 items"))).toBe(true);
      }
    });

    it("should accept socialProof with reviews only", () => {
      const valid = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "socialProof.reviews",
            value: {
              reviews: [
                { text: "Great service!", author: "John Doe" },
                { text: "Highly recommend", author: "Jane Smith" },
                { text: "Excellent work", author: "Bob Johnson" },
              ],
            },
            rationale: "Customer testimonials",
            confidence: 0.9,
          },
        ],
        requiresApproval: true,
        confidence: 0.9,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<CopyProposal>("copy_proposal", valid);
      expect(result.ok).toBe(true);
    });

    it("should accept socialProof with outcomes only", () => {
      const valid = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "socialProof.outcomes",
            value: {
              outcomes: [
                { metric: "500+", label: "Projects Completed" },
                { metric: "98%", label: "Customer Satisfaction" },
                { metric: "10 years", label: "In Business" },
              ],
            },
            rationale: "Quantifiable results",
            confidence: 0.85,
          },
        ],
        requiresApproval: true,
        confidence: 0.85,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<CopyProposal>("copy_proposal", valid);
      expect(result.ok).toBe(true);
    });

    it("should reject socialProof with both reviews AND outcomes", () => {
      const invalid = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "socialProof.reviews",
            value: {
              reviews: [
                { text: "Great!", author: "John" },
                { text: "Amazing!", author: "Jane" },
                { text: "Perfect!", author: "Bob" },
              ],
              outcomes: [
                // ❌ Cannot have both
                { metric: "500+", label: "Projects" },
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

      const result = validateAiOutput<CopyProposal>("copy_proposal", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("oneOf") || e.includes("exactly one"))).toBe(true);
      }
    });

    it("should reject missing schemaVersion", () => {
      const invalid = {
        // ❌ Missing schemaVersion
        variants: [
          {
            targetKey: "hero.headline",
            value: "Test",
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<CopyProposal>("copy_proposal", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("schemaVersion"))).toBe(true);
      }
    });
  });

  // ============================================
  // DESIGN TOKENS TESTS
  // ============================================

  describe("design_tokens", () => {
    it("should accept valid design tokens", () => {
      const valid: DesignTokensProposal = {
        schemaVersion: "v1",
        tokens: {
          maxWidth: "1200px",
          sectionGap: "4rem",
          radius: "md",
          cardStyle: "elevated",
        },
        rationale: "Comfortable spacing improves trust",
        requiresApproval: true,
        confidence: 0.82,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<DesignTokensProposal>("design_tokens", valid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens.maxWidth).toBe("1200px");
      }
    });

    it("should reject invalid radius value", () => {
      const invalid = {
        schemaVersion: "v1",
        tokens: {
          radius: "invalid", // ❌ Must be none|sm|md|lg|xl
        },
        rationale: "Test",
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<DesignTokensProposal>("design_tokens", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("one of"))).toBe(true);
      }
    });

    it("should reject extra token fields", () => {
      const invalid = {
        schemaVersion: "v1",
        tokens: {
          maxWidth: "1200px",
          customField: "not allowed", // ❌ Not in schema
        },
        rationale: "Test",
        requiresApproval: true,
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<DesignTokensProposal>("design_tokens", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("additionalProperty"))).toBe(true);
      }
    });
  });

  // ============================================
  // INTENT PARSE TESTS
  // ============================================

  describe("intent_parse", () => {
    it("should accept valid intent parse", () => {
      const valid: IntentParse = {
        schemaVersion: "v1",
        intentType: "COPY_CHANGE",
        targetKeys: ["hero.headline"],
        userText: "Can we make the headline more direct?",
        proposedDirection: "Rewrite headline to be more direct",
        needsHuman: false,
        confidence: 0.88,
        requiresApproval: true,
        assumptions: ["Customer wants shorter headline"],
      };

      const result = validateAiOutput<IntentParse>("intent_parse", valid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.intentType).toBe("COPY_CHANGE");
      }
    });

    it("should reject invalid intentType", () => {
      const invalid = {
        schemaVersion: "v1",
        intentType: "INVALID_TYPE", // ❌ Not in enum
        targetKeys: [],
        userText: "Test",
        proposedDirection: "Test",
        needsHuman: false,
        confidence: 0.8,
        requiresApproval: true,
      };

      const result = validateAiOutput<IntentParse>("intent_parse", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("one of"))).toBe(true);
      }
    });

    it("should reject > 5 targetKeys", () => {
      const invalid = {
        schemaVersion: "v1",
        intentType: "COPY_CHANGE",
        targetKeys: [
          "hero.headline",
          "hero.subheadline",
          "hero.cta",
          "trust.items",
          "services.items",
          "socialProof.reviews", // ❌ Max 5
        ],
        userText: "Test",
        proposedDirection: "Test",
        needsHuman: false,
        confidence: 0.8,
        requiresApproval: true,
      };

      const result = validateAiOutput<IntentParse>("intent_parse", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("5 items"))).toBe(true);
      }
    });
  });

  // ============================================
  // CRITIQUE TESTS
  // ============================================

  describe("critique", () => {
    it("should accept valid critique", () => {
      const valid: Critique = {
        schemaVersion: "v1",
        pass: false,
        issues: [
          {
            severity: "major",
            description: "Headline too long",
            affectedKey: "hero.headline",
          },
        ],
        suggestedFixes: [
          {
            targetKey: "hero.headline",
            fix: "Trim to 80 chars",
            rationale: "Meets constraint",
          },
        ],
        confidence: 0.91,
        requiresApproval: true,
      };

      const result = validateAiOutput<Critique>("critique", valid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.pass).toBe(false);
        expect(result.data.issues).toHaveLength(1);
      }
    });

    it("should reject > 3 issues", () => {
      const invalid = {
        schemaVersion: "v1",
        pass: false,
        issues: [
          { severity: "major", description: "Issue 1", affectedKey: "key1" },
          { severity: "major", description: "Issue 2", affectedKey: "key2" },
          { severity: "major", description: "Issue 3", affectedKey: "key3" },
          { severity: "major", description: "Issue 4", affectedKey: "key4" }, // ❌ Max 3
        ],
        suggestedFixes: [],
        confidence: 0.8,
        requiresApproval: true,
      };

      const result = validateAiOutput<Critique>("critique", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("3 items"))).toBe(true);
      }
    });
  });

  // ============================================
  // DECISION COLLAPSE TESTS
  // ============================================

  describe("decision_collapse", () => {
    it("should accept valid decision with copy proposal", () => {
      const valid: DecisionCollapse = {
        schemaVersion: "v1",
        selectedProposal: {
          type: "copy",
          targetKey: "hero.headline",
          value: "Stop carrying the system",
        },
        reason: "Best clarity score",
        approvalText: "Updated headline",
        previewRecommended: true,
        needsHuman: false,
        confidence: 0.89,
        requiresApproval: true,
        roundLimit: 2,
        costCapUsd: 10,
        actualRounds: 1,
        estimatedCostUsd: 0.42,
      };

      const result = validateAiOutput<DecisionCollapse>("decision_collapse", valid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.selectedProposal).not.toBeNull();
        if (result.data.selectedProposal?.type === "copy") {
          expect(result.data.selectedProposal.targetKey).toBe("hero.headline");
        }
      }
    });

    it("should accept null selectedProposal when needsHuman=true", () => {
      const valid: DecisionCollapse = {
        schemaVersion: "v1",
        selectedProposal: null,
        reason: "Request out of scope",
        approvalText: "Needs human review",
        previewRecommended: false,
        needsHuman: true,
        needsHumanReason: "Custom design requested",
        confidence: 0.95,
        requiresApproval: true,
        roundLimit: 2,
        costCapUsd: 10,
      };

      const result = validateAiOutput<DecisionCollapse>("decision_collapse", valid);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.selectedProposal).toBeNull();
        expect(result.data.needsHuman).toBe(true);
      }
    });

    it("should reject roundLimit > 2", () => {
      const invalid = {
        schemaVersion: "v1",
        selectedProposal: null,
        reason: "Test",
        approvalText: "Test",
        previewRecommended: false,
        needsHuman: true,
        confidence: 0.8,
        requiresApproval: true,
        roundLimit: 3, // ❌ Max 2
        costCapUsd: 10,
      };

      const result = validateAiOutput<DecisionCollapse>("decision_collapse", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("2"))).toBe(true);
      }
    });

    it("should reject costCapUsd > 10", () => {
      const invalid = {
        schemaVersion: "v1",
        selectedProposal: null,
        reason: "Test",
        approvalText: "Test",
        previewRecommended: false,
        needsHuman: true,
        confidence: 0.8,
        requiresApproval: true,
        roundLimit: 2,
        costCapUsd: 11, // ❌ Max 10
      };

      const result = validateAiOutput<DecisionCollapse>("decision_collapse", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("10"))).toBe(true);
      }
    });
  });

  // ============================================
  // GENERAL TESTS
  // ============================================

  describe("general validation", () => {
    it("should reject non-object payload", () => {
      const result = validateAiOutput<CopyProposal>("copy_proposal", "not an object");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("invalid_json");
      }
    });

    it("should reject null payload", () => {
      const result = validateAiOutput<CopyProposal>("copy_proposal", null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("invalid_json");
      }
    });

    it("should reject requiresApproval=false", () => {
      const invalid = {
        schemaVersion: "v1",
        variants: [
          {
            targetKey: "hero.headline",
            value: "Test",
            rationale: "Test",
            confidence: 0.8,
          },
        ],
        requiresApproval: false, // ❌ Must be true
        confidence: 0.8,
        risks: [],
        assumptions: [],
      };

      const result = validateAiOutput<CopyProposal>("copy_proposal", invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes("requiresApproval") || e.includes("true"))).toBe(true);
      }
    });
  });
});
