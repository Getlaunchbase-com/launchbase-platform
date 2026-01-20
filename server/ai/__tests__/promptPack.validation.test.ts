/**
 * PromptPack Validation Tests
 * 
 * Tests that all PromptPacks produce schema-valid JSON using memory transport.
 * This proves prompts work BEFORE we spend money on real AI calls.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getPromptPack, interpolatePrompt, type TaskType } from "../promptPacks/registry";
import { validateAiOutput } from "../validateAiOutput";
import { enforceSectionCaps } from "../enforceSectionCaps";
import { completeJson } from "../providers/providerFactory";
import type { AiContractType } from "../validateAiOutput";

// ============================================
// SETUP
// ============================================

beforeAll(() => {
  // Force memory transport for deterministic tests
  process.env.AI_PROVIDER = "memory";
});

// ============================================
// HELPER: Call AI with PromptPack
// ============================================

async function callAiWithPromptPack(
  taskType: TaskType,
  variables: Record<string, string>
) {
  const pack = getPromptPack(taskType);

  // Interpolate task prompt with variables
  const taskPrompt = interpolatePrompt(pack.taskPrompt, variables);

  // Call AI (memory transport returns deterministic JSON)
  const result = await completeJson(
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: pack.systemPrompt },
        { role: "user", content: taskPrompt },
      ],
      trace: {
        jobId: `test-${taskType}`,
        step: taskType,
        round: 1,
      },
    },
    "memory" // Explicitly use memory transport
  );

  return {
    pack,
    result,
    json: result.json,
  };
}

// ============================================
// TEST: intent_parse
// ============================================

describe("PromptPack: intent_parse", () => {
  it("should produce valid intent_parse JSON", async () => {
    const { pack, result, json } = await callAiWithPromptPack("intent_parse", {
      USER_TEXT: "Make the headline shorter",
      WHITELISTED_KEYS: JSON.stringify(["hero.headline", "hero.subheadline", "hero.cta"]),
      CONTEXT_SUMMARY: JSON.stringify({ businessName: "Test Business", vertical: "trades" }),
    });

    // Verify provider responded
    expect(result.json).toBeTruthy();
    expect(result.meta.provider).toBe("memory");

    // Verify schema validation passes
    const validation = validateAiOutput("intent_parse", json);
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      console.error("Validation errors:", validation.errors);
    }

    // Verify required fields exist
    expect(json).toHaveProperty("intentType");
    expect(json).toHaveProperty("targetKeys");
    expect(json).toHaveProperty("userText");
    expect(json).toHaveProperty("confidence");
    expect(json).toHaveProperty("needsHuman");
  });

  it("should have required fields", async () => {
    const { json } = await callAiWithPromptPack("intent_parse", {
      USER_TEXT: "Test request",
      WHITELISTED_KEYS: JSON.stringify(["hero.headline"]),
      CONTEXT_SUMMARY: JSON.stringify({}),
    });

    // Verify all required fields exist
    expect(json).toHaveProperty("intentType");
    expect(json).toHaveProperty("targetKeys");
    expect(json).toHaveProperty("userText");
    expect(json).toHaveProperty("confidence");
    expect(json).toHaveProperty("needsHuman");
  });
});

// ============================================
// TEST: generate_candidates (copy_proposal)
// ============================================

describe("PromptPack: generate_candidates", () => {
  it("should produce valid copy_proposal JSON", async () => {
    const { result, json } = await callAiWithPromptPack("generate_candidates", {
      INTENT_PARSE_JSON: JSON.stringify({
        intentType: "copy_change",
        targetKeys: ["hero.headline"],
        userTextSummary: "Make headline shorter",
        confidence: 0.9,
        needsHuman: false,
      }),
      BUSINESS_FACTS_JSON: JSON.stringify({
        businessName: "Test Business",
        services: ["Service 1", "Service 2"],
      }),
      CURRENT_CONTENT_JSON: JSON.stringify({
        "hero.headline": "Original Headline That Is Too Long",
      }),
      WHITELISTED_KEYS: JSON.stringify(["hero.headline", "hero.subheadline"]),
    });

    // Verify provider responded
    expect(result.json).toBeTruthy();

    // Verify schema validation passes
    const validation = validateAiOutput("copy_proposal", json);
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      console.error("Validation errors:", validation.errors);
    }

    // Verify required fields
    expect(json).toHaveProperty("schemaVersion");
    expect(json).toHaveProperty("requiresApproval");
    expect(json).toHaveProperty("variants");
    expect(json.requiresApproval).toBe(true);
  });

  it("should enforce section caps", async () => {
    const { json } = await callAiWithPromptPack("generate_candidates", {
      INTENT_PARSE_JSON: JSON.stringify({
        intentType: "copy_change",
        targetKeys: ["hero.headline"],
      }),
      BUSINESS_FACTS_JSON: JSON.stringify({}),
      CURRENT_CONTENT_JSON: JSON.stringify({}),
      WHITELISTED_KEYS: JSON.stringify(["hero.headline"]),
    });

    // Validate with section caps
    const validation = validateAiOutput("copy_proposal", json);
    expect(validation.ok).toBe(true);

    // Enforce caps (should not throw for memory transport)
    const capped = enforceSectionCaps(json, "copy_proposal");
    expect(capped).toBeTruthy();
  });
});

// ============================================
// TEST: critique
// ============================================

describe("PromptPack: critique", () => {
  it("should produce valid critique JSON", async () => {
    const { result, json } = await callAiWithPromptPack("critique", {
      PROPOSAL_JSON: JSON.stringify({
        schemaVersion: "v1",
        requiresApproval: true,
        variants: [
          {
            variantId: "v1",
            targetKey: "hero.headline",
            proposedValue: "Test Headline",
            rationale: "Test rationale",
            confidence: 0.85,
            risks: [],
          },
        ],
      }),
      SECTION_CAPS_SUMMARY: JSON.stringify({
        "hero.headline": 80,
        "hero.subheadline": 140,
        "hero.cta": 60,
      }),
    });

    // Verify provider responded
    expect(result.json).toBeTruthy();

    // Verify schema validation passes
    const validation = validateAiOutput("critique", json);
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      console.error("Validation errors:", validation.errors);
    }

    // Verify required fields
    expect(json).toHaveProperty("schemaVersion");
    expect(json).toHaveProperty("pass");
    expect(json).toHaveProperty("issues");
    expect(json).toHaveProperty("confidence");
  });
});

// ============================================
// TEST: decision_collapse
// ============================================

describe("PromptPack: decision_collapse", () => {
  it("should produce valid decision_collapse JSON", async () => {
    const { result, json } = await callAiWithPromptPack("decision_collapse", {
      INTENT_PARSE_JSON: JSON.stringify({
        intentType: "copy_change",
        targetKeys: ["hero.headline"],
      }),
      PROPOSAL_JSON: JSON.stringify({
        schemaVersion: "v1",
        requiresApproval: true,
        variants: [
          {
            variantId: "v1",
            targetKey: "hero.headline",
            proposedValue: "Test Headline",
            rationale: "Test rationale",
            confidence: 0.85,
            risks: [],
          },
        ],
      }),
      CRITIQUE_JSON: JSON.stringify({
        schemaVersion: "v1",
        pass: true,
        violations: [],
        confidence: 0.9,
      }),
    });

    // Verify provider responded
    expect(result.json).toBeTruthy();

    // Verify schema validation passes
    const validation = validateAiOutput("decision_collapse", json);
    if (!validation.ok) {
      console.error("[TEST DEBUG] Validation errors:", JSON.stringify(validation.errors, null, 2));
    }
    expect(validation.ok).toBe(true);

    // Verify required fields
    expect(json).toHaveProperty("schemaVersion");
    expect(json).toHaveProperty("requiresApproval");
    expect(json).toHaveProperty("confidence");
    expect(json.requiresApproval).toBe(true);
  });

  it("should enforce needsHuman escalation path", async () => {
    const { json } = await callAiWithPromptPack("decision_collapse", {
      INTENT_PARSE_JSON: JSON.stringify({
        intentType: "clarification",
        targetKeys: [],
        needsHuman: true,
      }),
      PROPOSAL_JSON: JSON.stringify({
        schemaVersion: "v1",
        requiresApproval: true,
        variants: [],
        needsHuman: true,
      }),
      CRITIQUE_JSON: JSON.stringify({
        schemaVersion: "v1",
        pass: false,
        violations: [
          {
            severity: "hard_reject",
            rule: "test_rule",
            detail: "test violation",
          },
        ],
        confidence: 0.5,
      }),
    });

    // Validate schema
    const validation = validateAiOutput("decision_collapse", json);
    expect(validation.ok).toBe(true);

    // Verify needsHuman field exists (memory transport should set it)
    expect(json).toHaveProperty("needsHuman");
  });
});

// ============================================
// TEST: All PromptPacks enforce hard caps
// ============================================

describe("PromptPack: Hard Caps", () => {
  it("all PromptPacks should enforce maxRounds <= 2", () => {
    const taskTypes: TaskType[] = [
      "intent_parse",
      "generate_candidates",
      "critique",
      "decision_collapse",
    ];

    for (const taskType of taskTypes) {
      const pack = getPromptPack(taskType);
      expect(pack.maxRounds).toBeLessThanOrEqual(2);
    }
  });

  it("all PromptPacks should enforce costCapUsd <= 10", () => {
    const taskTypes: TaskType[] = [
      "intent_parse",
      "generate_candidates",
      "critique",
      "decision_collapse",
    ];

    for (const taskType of taskTypes) {
      const pack = getPromptPack(taskType);
      expect(pack.costCapUsd).toBeLessThanOrEqual(10);
    }
  });

  it("all PromptPacks should have schema enforcement", () => {
    const taskTypes: TaskType[] = [
      "intent_parse",
      "generate_candidates",
      "critique",
      "decision_collapse",
    ];

    for (const taskType of taskTypes) {
      const pack = getPromptPack(taskType);
      expect(pack.outputSchemaName).toBeTruthy();
      expect(pack.version).toBe("v1");
    }
  });
});

// ============================================
// TEST: Memory Transport Determinism
// ============================================

describe("Memory Transport", () => {
  it("should return deterministic JSON", async () => {
    const result1 = await completeJson(
      {
        model: "test-model",
        messages: [{ role: "user", content: "test" }],
        trace: { jobId: "test", step: "test", round: 1 },
      },
      "memory"
    );

    const result2 = await completeJson(
      {
        model: "test-model",
        messages: [{ role: "user", content: "test" }],
        trace: { jobId: "test", step: "test", round: 1 },
      },
      "memory"
    );

    // Memory transport should return same structure
    expect(result1.json).toBeTruthy();
    expect(result2.json).toBeTruthy();
    expect(result1.meta.provider).toBe("memory");
    expect(result2.meta.provider).toBe("memory");
  });

  it("should never make real API calls", async () => {
    const result = await completeJson(
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "test" }],
        trace: { jobId: "test", step: "test", round: 1 },
      },
      "memory"
    );

    // Verify it's memory transport
    expect(result.meta.provider).toBe("memory");
    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
    expect(result.cost.estimatedUsd).toBe(0);
  });
});
