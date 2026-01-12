import { describe, it, expect } from "vitest";
import { validateAiOutput } from "../validateAiOutput";

describe("critique fixture validation", () => {
  it("validates minimal critique fixture", () => {
    const fixture = {
      schemaVersion: "v1",
      pass: true,
      issues: [],
      suggestedFixes: [],
      confidence: 0.8,
      requiresApproval: true,
      evaluationCriteria: {
        clarity: 0.8,
        trust: 0.8,
        scanability: 0.8,
        mobileFold: 0.8,
        sectionContractCompliance: 1.0,
      },
    };

    const result = validateAiOutput("critique", fixture);
    
    if (!result.ok) {
      console.error("❌ Critique fixture validation FAILED:");
      console.error("Errors:", JSON.stringify(result.errors, null, 2));
      throw new Error(`Critique fixture invalid: ${result.errors.join(" | ")}`);
    }
    
    expect(result.ok).toBe(true);
  });

  it("validates decision_collapse fixture", () => {
    const fixture = {
      schemaVersion: "v1",
      selectedProposal: {
        type: "copy",
        targetKey: "hero.headline",
        value: "Launch faster with LaunchBase",
      },
      reason: "Best clarity and strongest value proposition.",
      approvalText: "Approve this copy change for hero.headline.",
      previewRecommended: true,
      needsHuman: false,
      confidence: 0.85,
      requiresApproval: true,
      roundLimit: 2,
      costCapUsd: 2,
    };

    const result = validateAiOutput("decision_collapse", fixture);
    
    if (!result.ok) {
      console.error("❌ Decision collapse fixture validation FAILED:");
      console.error("Errors:", JSON.stringify(result.errors, null, 2));
      throw new Error(`Decision collapse fixture invalid: ${result.errors.join(" | ")}`);
    }
    
    expect(result.ok).toBe(true);
  });
});
