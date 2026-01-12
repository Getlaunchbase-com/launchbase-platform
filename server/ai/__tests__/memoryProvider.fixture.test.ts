import { describe, it, expect, beforeEach } from "vitest";
import { completeJson } from "../providers/providerFactory";

describe("memory provider copy_proposal fixture", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "memory";
  });

  it("returns at least 1 variant for copy_proposal", async () => {
    const res = await completeJson(
      {
        model: "memory-model",
        messages: [
          { role: "system", content: "test" },
          { role: "user", content: "Generate copy for targetKey hero.headline" },
        ],
        trace: { jobId: "t", step: "generate", schema: "copy_proposal", round: 0 },
      },
      "memory",
      { useRouter: false }
    );

    expect(res.json).toBeTruthy();
    expect(Array.isArray(res.json.variants)).toBe(true);
    expect(res.json.variants.length).toBeGreaterThan(0);
    
    // Verify variant structure
    const variant = res.json.variants[0];
    expect(variant.targetKey).toBeTruthy();
    expect(variant.value).toBeTruthy();
    expect(variant.rationale).toBeTruthy();
    expect(typeof variant.confidence).toBe('number');
  });

  it("returns critique fixture", async () => {
    const res = await completeJson(
      {
        model: "memory-model",
        messages: [
          { role: "system", content: "test" },
          { role: "user", content: "Critique this copy" },
        ],
        trace: { jobId: "t", step: "critique", schema: "critique", round: 0 },
      },
      "memory",
      { useRouter: false }
    );

    expect(res.json).toBeTruthy();
    expect(typeof res.json.pass).toBe('boolean');
    expect(Array.isArray(res.json.issues)).toBe(true);
  });

  it("returns decision_collapse fixture", async () => {
    const res = await completeJson(
      {
        model: "memory-model",
        messages: [
          { role: "system", content: "test" },
          { role: "user", content: "Choose best variant" },
        ],
        trace: { jobId: "t", step: "collapse", schema: "decision_collapse", round: 0 },
      },
      "memory",
      { useRouter: false }
    );

    expect(res.json).toBeTruthy();
    expect(res.json.selectedProposal).toBeTruthy();
    expect(res.json.reason).toBeTruthy();
  });
});
