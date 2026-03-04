/**
 * Unit tests for Training Collector
 *
 * Tests: export format, stats aggregation, enrichment, edge cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb
vi.mock("../../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("Training Collector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("exportTrainingData", () => {
    it("returns empty array when DB is unavailable", async () => {
      const { exportTrainingData } = await import("../../services/trainingCollector");
      const result = await exportTrainingData();
      expect(result).toEqual([]);
    });

    it("accepts limit and sinceDate parameters", async () => {
      const { exportTrainingData } = await import("../../services/trainingCollector");
      const result = await exportTrainingData(10, "2026-01-01");
      expect(result).toEqual([]);
    });

    it("returns array type", async () => {
      const { exportTrainingData } = await import("../../services/trainingCollector");
      const result = await exportTrainingData();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getTrainingStats", () => {
    it("returns zeros when DB is unavailable", async () => {
      const { getTrainingStats } = await import("../../services/trainingCollector");
      const stats = await getTrainingStats();
      expect(stats).toEqual({
        totalPairs: 0,
        votedPairs: 0,
        shadowPreferred: 0,
        primaryPreferred: 0,
      });
    });

    it("returns correct shape", async () => {
      const { getTrainingStats } = await import("../../services/trainingCollector");
      const stats = await getTrainingStats();
      expect(stats).toHaveProperty("totalPairs");
      expect(stats).toHaveProperty("votedPairs");
      expect(stats).toHaveProperty("shadowPreferred");
      expect(stats).toHaveProperty("primaryPreferred");
      expect(typeof stats.totalPairs).toBe("number");
      expect(typeof stats.votedPairs).toBe("number");
    });
  });

  describe("enrichTrainingInput", () => {
    it("passes through when DB is unavailable", async () => {
      const { enrichTrainingInput } = await import("../../services/trainingCollector");
      const examples = [{
        instruction: "You are a helpful assistant.",
        input: "What is 2+2?",
        output: "4",
        metadata: {
          userId: 1,
          runId: 1,
          primaryModel: "claude",
          shadowModel: "llama",
          preference: "primary" as const,
          createdAt: "2026-03-03",
        },
      }];
      const result = await enrichTrainingInput(examples);
      expect(result).toEqual(examples);
    });

    it("handles empty array", async () => {
      const { enrichTrainingInput } = await import("../../services/trainingCollector");
      const result = await enrichTrainingInput([]);
      expect(result).toEqual([]);
    });

    it("preserves metadata through enrichment", async () => {
      const { enrichTrainingInput } = await import("../../services/trainingCollector");
      const examples = [{
        instruction: "System prompt",
        input: "User message",
        output: "Response",
        metadata: {
          userId: 42,
          runId: 100,
          primaryModel: "claude-sonnet",
          shadowModel: "launchbase-main",
          preference: "shadow" as const,
          createdAt: "2026-03-04",
        },
      }];
      const result = await enrichTrainingInput(examples);
      expect(result[0].metadata.userId).toBe(42);
      expect(result[0].metadata.preference).toBe("shadow");
    });
  });
});

describe("Ollama Health Monitor", () => {
  it("exports getOllamaHealth function", async () => {
    const { getOllamaHealth } = await import("../../services/ollamaHealthMonitor");
    expect(typeof getOllamaHealth).toBe("function");
  });

  it("returns health status shape", async () => {
    const { getOllamaHealth } = await import("../../services/ollamaHealthMonitor");
    const status = await getOllamaHealth();
    expect(status).toHaveProperty("healthy");
    expect(status).toHaveProperty("url");
    expect(status).toHaveProperty("models");
    expect(status).toHaveProperty("responseTimeMs");
    expect(status).toHaveProperty("lastCheckedAt");
    expect(typeof status.healthy).toBe("boolean");
    expect(Array.isArray(status.models)).toBe(true);
  });

  it("reports unhealthy when Ollama is not running", async () => {
    const { getOllamaHealth } = await import("../../services/ollamaHealthMonitor");
    const status = await getOllamaHealth();
    // In test environment, Ollama is not running
    expect(status.healthy).toBe(false);
  });
});
