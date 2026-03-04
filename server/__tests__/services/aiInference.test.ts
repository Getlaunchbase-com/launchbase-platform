/**
 * Unit tests for AI Inference Engine
 *
 * Tests: model config, callLLM interface, cost tracker integration,
 * tool execution paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

  it("all model IDs contain provider prefix", async () => {
    const { AVAILABLE_MODELS } = await import("../../services/aiInference");
    for (const [key, modelId] of Object.entries(AVAILABLE_MODELS)) {
      expect(modelId).toContain("/");
    }
  });
});

describe("callLLM", () => {
  let origKey: string | undefined;
  let origOAI: string | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    origKey = process.env.AIML_API_KEY;
    origOAI = process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (origKey) process.env.AIML_API_KEY = origKey;
    else delete process.env.AIML_API_KEY;
    if (origOAI) process.env.OPENAI_API_KEY = origOAI;
    else delete process.env.OPENAI_API_KEY;
  });

  it("returns error when API key is not set", async () => {
    delete process.env.AIML_API_KEY;
    delete process.env.OPENAI_API_KEY;

    vi.resetModules();
    const { callLLM } = await import("../../services/aiInference");
    const result = await callLLM(
      [{ role: "user", content: "test" }],
      "anthropic/claude-sonnet-4-6",
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No API key");
  });

  it("returns InferenceResult shape on error", async () => {
    delete process.env.AIML_API_KEY;
    delete process.env.OPENAI_API_KEY;

    vi.resetModules();
    const { callLLM } = await import("../../services/aiInference");
    const result = await callLLM(
      [{ role: "user", content: "hello" }],
      "some-model",
    );

    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("error");
    expect(typeof result.ok).toBe("boolean");
  });

  it("handles network errors gracefully", async () => {
    process.env.AIML_API_KEY = "test-key";
    process.env.AIML_API_BASE_URL = "http://localhost:1"; // unreachable

    vi.resetModules();
    const { callLLM } = await import("../../services/aiInference");
    const result = await callLLM(
      [{ role: "user", content: "test" }],
      "test-model",
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("Cost Tracker", () => {
  it("estimates costs for known models", async () => {
    // Import costTracker directly (doesn't need DB for estimation)
    vi.resetModules();
    vi.mock("../../db", () => ({
      getDb: vi.fn().mockResolvedValue(null),
    }));

    const { logUsage, checkRateLimit, getUserUsageSummary } = await import("../../services/costTracker");

    // logUsage should not throw even with null DB
    await expect(
      logUsage(1, "anthropic/claude-sonnet-4-6", { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }),
    ).resolves.toBeUndefined();
  });

  it("checkRateLimit returns allowed when DB is unavailable", async () => {
    vi.resetModules();
    vi.mock("../../db", () => ({
      getDb: vi.fn().mockResolvedValue(null),
    }));

    const { checkRateLimit } = await import("../../services/costTracker");
    const result = await checkRateLimit(1);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBeGreaterThan(0);
  });

  it("getUserUsageSummary returns zeros when DB is unavailable", async () => {
    vi.resetModules();
    vi.mock("../../db", () => ({
      getDb: vi.fn().mockResolvedValue(null),
    }));

    const { getUserUsageSummary } = await import("../../services/costTracker");
    const result = await getUserUsageSummary(1);
    expect(result.today.messages).toBe(0);
    expect(result.allTime.messages).toBe(0);
  });
});

describe("Shadow Inference", () => {
  it("exports runShadow function", async () => {
    const shadow = await import("../../services/shadowInference");
    expect(typeof shadow.runShadow).toBe("function");
  });

  it("exports getAvailableShadowModels function", async () => {
    const shadow = await import("../../services/shadowInference");
    expect(typeof shadow.getAvailableShadowModels).toBe("function");
  });

  it("getAvailableShadowModels returns array on network error", async () => {
    const shadow = await import("../../services/shadowInference");
    const models = await shadow.getAvailableShadowModels();
    expect(Array.isArray(models)).toBe(true);
  });
});

describe("Learning Profile", () => {
  it("exports getProfile function", async () => {
    const lp = await import("../../services/learningProfile");
    expect(typeof lp.getProfile).toBe("function");
  });

  it("exports maybeUpdateProfile function", async () => {
    const lp = await import("../../services/learningProfile");
    expect(typeof lp.maybeUpdateProfile).toBe("function");
  });

  it("getProfile returns null when DB is unavailable", async () => {
    vi.resetModules();
    vi.mock("../../db", () => ({
      getDb: vi.fn().mockResolvedValue(null),
    }));

    const { getProfile } = await import("../../services/learningProfile");
    const profile = await getProfile(999);
    expect(profile).toBeNull();
  });
});
