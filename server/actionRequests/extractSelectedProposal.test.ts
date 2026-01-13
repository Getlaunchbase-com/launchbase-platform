/**
 * Unit Tests for Proposal Extraction Helpers
 * 
 * Tests for:
 * - extractSelectedProposal() handles both DecisionCollapse and CopyProposal shapes
 * - validateSelectedProposal() enforces required fields correctly
 * - Malformed inputs are handled safely
 */

import { describe, it, expect } from "vitest";
import { extractSelectedProposal, validateSelectedProposal } from "./aiTennisCopyRefine";

describe("extractSelectedProposal", () => {
  it("extracts from DecisionCollapse.selectedProposal (direct path)", () => {
    const decisionCollapse = {
      schemaVersion: "v1",
      selectedProposal: {
        type: "copy",
        targetKey: "hero.headline",
        value: "Transform Your Business",
        rationale: "Clear value prop",
        confidence: 0.9,
        risks: [],
      },
      reason: "Approved",
      needsHuman: false,
    };

    const result = extractSelectedProposal(decisionCollapse);

    expect(result).toBeDefined();
    expect(result.targetKey).toBe("hero.headline");
    expect(result.value).toBe("Transform Your Business");
    expect(result.confidence).toBe(0.9);
  });

  it("extracts from CopyProposal.variants[0] (wrapped path)", () => {
    const copyProposal = {
      schemaVersion: "v1",
      variants: [
        {
          targetKey: "hero.cta",
          value: "Get Started Today",
          rationale: "Action-oriented",
          confidence: 0.95,
          risks: [],
        },
      ],
      requiresApproval: true,
      confidence: 0.95,
      risks: [],
      assumptions: [],
    };

    const result = extractSelectedProposal(copyProposal);

    expect(result).toBeDefined();
    expect(result.targetKey).toBe("hero.cta");
    expect(result.value).toBe("Get Started Today");
    expect(result.confidence).toBe(0.95);
  });

  it("returns null when selectedProposal is null", () => {
    const decisionCollapse = {
      schemaVersion: "v1",
      selectedProposal: null,
      reason: "Needs human review",
      needsHuman: true,
    };

    const result = extractSelectedProposal(decisionCollapse);
    expect(result).toBeNull();
  });

  it("returns null when variants array is empty", () => {
    const copyProposal = {
      schemaVersion: "v1",
      variants: [],
      requiresApproval: true,
    };

    const result = extractSelectedProposal(copyProposal);
    expect(result).toBeNull();
  });

  it("returns null when both selectedProposal and variants are missing", () => {
    const malformed = {
      schemaVersion: "v1",
      someOtherField: "value",
    };

    const result = extractSelectedProposal(malformed);
    expect(result).toBeNull();
  });

  it("returns null for null input", () => {
    const result = extractSelectedProposal(null);
    expect(result).toBeNull();
  });

  it("returns null for undefined input", () => {
    const result = extractSelectedProposal(undefined);
    expect(result).toBeNull();
  });

  it("prioritizes selectedProposal over variants when both exist", () => {
    const hybrid = {
      selectedProposal: {
        targetKey: "from.selectedProposal",
        value: "Priority Value",
      },
      variants: [
        {
          targetKey: "from.variants",
          value: "Fallback Value",
        },
      ],
    };

    const result = extractSelectedProposal(hybrid);
    expect(result.targetKey).toBe("from.selectedProposal");
    expect(result.value).toBe("Priority Value");
  });
});

describe("validateSelectedProposal", () => {
  it("accepts valid proposal with targetKey and value", () => {
    const valid = {
      targetKey: "hero.headline",
      value: "Transform Your Business",
      confidence: 0.9,
    };

    expect(validateSelectedProposal(valid)).toBe(true);
  });

  it("accepts falsy-but-valid values (empty string, zero, false)", () => {
    const emptyString = {
      targetKey: "hero.headline",
      value: "",
    };
    expect(validateSelectedProposal(emptyString)).toBe(true);

    const zero = {
      targetKey: "hero.headline",
      value: 0,
    };
    expect(validateSelectedProposal(zero)).toBe(true);

    const falseBool = {
      targetKey: "hero.headline",
      value: false,
    };
    expect(validateSelectedProposal(falseBool)).toBe(true);
  });

  it("rejects proposal with null value", () => {
    const nullValue = {
      targetKey: "hero.headline",
      value: null,
    };

    expect(validateSelectedProposal(nullValue)).toBe(false);
  });

  it("rejects proposal with undefined value", () => {
    const undefinedValue = {
      targetKey: "hero.headline",
      value: undefined,
    };

    expect(validateSelectedProposal(undefinedValue)).toBe(false);
  });

  it("rejects proposal with missing targetKey", () => {
    const missingKey = {
      value: "Transform Your Business",
    };

    expect(validateSelectedProposal(missingKey)).toBe(false);
  });

  it("rejects proposal with empty targetKey", () => {
    const emptyKey = {
      targetKey: "",
      value: "Transform Your Business",
    };

    expect(validateSelectedProposal(emptyKey)).toBe(false);
  });

  it("rejects proposal with whitespace-only targetKey", () => {
    const whitespaceKey = {
      targetKey: "   ",
      value: "Transform Your Business",
    };

    expect(validateSelectedProposal(whitespaceKey)).toBe(false);
  });

  it("rejects proposal with non-string targetKey", () => {
    const numberKey = {
      targetKey: 123,
      value: "Transform Your Business",
    };

    expect(validateSelectedProposal(numberKey)).toBe(false);
  });

  it("rejects null input", () => {
    expect(validateSelectedProposal(null)).toBe(false);
  });

  it("rejects undefined input", () => {
    expect(validateSelectedProposal(undefined)).toBe(false);
  });

  it("rejects empty object", () => {
    expect(validateSelectedProposal({})).toBe(false);
  });
});
