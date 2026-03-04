/**
 * Unit tests for Training Collector
 *
 * Tests the training data export format and stats aggregation.
 * Uses mocked database.
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

  it("exportTrainingData returns empty array when DB is unavailable", async () => {
    const { exportTrainingData } = await import("../../services/trainingCollector");
    const result = await exportTrainingData();
    expect(result).toEqual([]);
  });

  it("getTrainingStats returns zeros when DB is unavailable", async () => {
    const { getTrainingStats } = await import("../../services/trainingCollector");
    const stats = await getTrainingStats();
    expect(stats).toEqual({
      totalPairs: 0,
      votedPairs: 0,
      shadowPreferred: 0,
      primaryPreferred: 0,
    });
  });

  it("enrichTrainingInput passes through when DB is unavailable", async () => {
    const { enrichTrainingInput } = await import("../../services/trainingCollector");
    const examples = [{
      instruction: "test",
      input: "",
      output: "response",
      metadata: {
        userId: 1,
        runId: 1,
        primaryModel: "claude",
        shadowModel: "llama",
        preference: "primary",
        createdAt: "2026-03-03",
      },
    }];
    const result = await enrichTrainingInput(examples);
    expect(result).toEqual(examples);
  });
});
