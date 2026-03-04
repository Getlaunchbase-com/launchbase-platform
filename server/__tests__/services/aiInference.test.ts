/**
 * Unit tests for AI Inference Engine — model routing & config
 *
 * Tests the AVAILABLE_MODELS config, model resolution logic,
 * and callLLM interface without hitting real APIs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the exported config/types, not the full inference (needs DB)
describe("AVAILABLE_MODELS config", () => {
  it("maps claude-sonnet to AIMLAPI model ID", async () => {
    const { AVAILABLE_MODELS } = await import("../../services/aiInference");
    expect(AVAILABLE_MODELS["claude-sonnet"]).toBe("anthropic/claude-sonnet-4-6");
  });

  it("maps gpt-5 to AIMLAPI model ID", async () => {
    const { AVAILABLE_MODELS } = await import("../../services/aiInference");
    expect(AVAILABLE_MODELS["gpt-5"]).toBe("openai/gpt-5.2-chat");
  });

  it("maps deepseek to AIMLAPI model ID", async () => {
    const { AVAILABLE_MODELS } = await import("../../services/aiInference");
    expect(AVAILABLE_MODELS["deepseek"]).toBe("deepseek/deepseek-chat-v3.1");
  });

  it("has exactly 3 models for beta", async () => {
    const { AVAILABLE_MODELS } = await import("../../services/aiInference");
    expect(Object.keys(AVAILABLE_MODELS)).toHaveLength(3);
  });
});

describe("callLLM", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when API key is not set", async () => {
    // Save and clear API key
    const origKey = process.env.AIML_API_KEY;
    const origOAI = process.env.OPENAI_API_KEY;
    delete process.env.AIML_API_KEY;
    delete process.env.OPENAI_API_KEY;

    // Re-import to pick up empty key
    vi.resetModules();
    const { callLLM } = await import("../../services/aiInference");
    const result = await callLLM(
      [{ role: "user", content: "test" }],
      "anthropic/claude-sonnet-4-6",
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No API key");

    // Restore
    if (origKey) process.env.AIML_API_KEY = origKey;
    if (origOAI) process.env.OPENAI_API_KEY = origOAI;
  });
});
