/**
 * ScoreCardV1 Contract
 * 
 * Trust ranking for AI agents based on repair success/failure history.
 * Used to select the best agent for future repair attempts.
 * 
 * Constitutional Rules:
 * - Every repair attempt updates the scorecard
 * - Scores decay over time (recent performance matters more)
 * - Track both success rate and quality metrics
 * - No agent can have 100% trust (always allow human override)
 */

export type ScoreCardV1 = {
  version: "scorecard.v1";
  
  agent: {
    id: string; // Agent identifier (e.g., "coder_gpt5", "reviewer_claude4")
    role: "coder" | "reviewer" | "arbiter"; // Agent role in repair swarm
    model: string; // Model name (e.g., "openai/gpt-5-2")
  };
  
  metrics: {
    totalRepairs: number; // Total repair attempts
    successfulRepairs: number; // Repairs that passed tests
    failedRepairs: number; // Repairs that failed tests
    successRate: number; // 0.0-1.0 success rate
    avgQualityScore: number; // 0.0-1.0 average quality score
    avgLatencyMs: number; // Average repair latency
    avgCostUsd: number; // Average repair cost
  };
  
  recentHistory: Array<{
    repairId: string; // Repair packet ID
    timestamp: string; // ISO 8601 timestamp
    success: boolean; // Whether repair succeeded
    qualityScore: number; // 0.0-1.0 quality score
    latencyMs: number; // Repair latency
    costUsd: number; // Repair cost
  }>;
  
  trustScore: {
    current: number; // 0.0-1.0 current trust score
    trend: "improving" | "stable" | "declining"; // Trust trend
    lastUpdated: string; // ISO 8601 timestamp
    decayFactor: number; // 0.0-1.0 decay factor (recent performance weight)
  };
  
  specializations: {
    failureTypes: Record<string, number>; // Success rate by failure type
    fileTypes: Record<string, number>; // Success rate by file type
    complexity: Record<string, number>; // Success rate by complexity level
  };
};

/**
 * Validate ScoreCardV1 structure
 */
export function validateScoreCard(card: any): card is ScoreCardV1 {
  if (card.version !== "scorecard.v1") return false;
  if (!card.agent?.id || !card.agent?.role || !card.agent?.model) return false;
  if (typeof card.metrics?.totalRepairs !== "number") return false;
  if (typeof card.metrics?.successRate !== "number") return false;
  if (!Array.isArray(card.recentHistory)) return false;
  if (typeof card.trustScore?.current !== "number") return false;
  if (!card.specializations) return false;
  
  return true;
}

/**
 * Calculate trust score from metrics
 */
export function calculateTrustScore(metrics: ScoreCardV1["metrics"], decayFactor: number = 0.8): number {
  // Base score from success rate
  let score = metrics.successRate;
  
  // Adjust for quality
  score = score * 0.7 + metrics.avgQualityScore * 0.3;
  
  // Penalize if too few repairs (need more data)
  if (metrics.totalRepairs < 10) {
    score *= (metrics.totalRepairs / 10);
  }
  
  // Apply decay factor (recent performance matters more)
  score *= decayFactor;
  
  // Cap at 0.95 (never 100% trust)
  return Math.min(score, 0.95);
}

/**
 * Determine trust trend
 */
export function determineTrend(recentHistory: ScoreCardV1["recentHistory"]): ScoreCardV1["trustScore"]["trend"] {
  if (recentHistory.length < 3) return "stable";
  
  const recent = recentHistory.slice(-5);
  const recentSuccessRate = recent.filter(r => r.success).length / recent.length;
  const older = recentHistory.slice(-10, -5);
  const olderSuccessRate = older.length > 0 ? older.filter(r => r.success).length / older.length : recentSuccessRate;
  
  if (recentSuccessRate > olderSuccessRate + 0.1) return "improving";
  if (recentSuccessRate < olderSuccessRate - 0.1) return "declining";
  return "stable";
}

/**
 * Update scorecard with new repair result
 */
export function updateScoreCard(
  card: ScoreCardV1,
  repair: {
    repairId: string;
    success: boolean;
    qualityScore: number;
    latencyMs: number;
    costUsd: number;
    failureType: string;
    fileType: string;
    complexity: string;
  }
): ScoreCardV1 {
  // Update metrics
  const totalRepairs = card.metrics.totalRepairs + 1;
  const successfulRepairs = card.metrics.successfulRepairs + (repair.success ? 1 : 0);
  const failedRepairs = card.metrics.failedRepairs + (repair.success ? 0 : 1);
  const successRate = successfulRepairs / totalRepairs;
  
  const avgQualityScore = (card.metrics.avgQualityScore * card.metrics.totalRepairs + repair.qualityScore) / totalRepairs;
  const avgLatencyMs = (card.metrics.avgLatencyMs * card.metrics.totalRepairs + repair.latencyMs) / totalRepairs;
  const avgCostUsd = (card.metrics.avgCostUsd * card.metrics.totalRepairs + repair.costUsd) / totalRepairs;
  
  // Update recent history (keep last 20)
  const recentHistory = [
    ...card.recentHistory,
    {
      repairId: repair.repairId,
      timestamp: new Date().toISOString(),
      success: repair.success,
      qualityScore: repair.qualityScore,
      latencyMs: repair.latencyMs,
      costUsd: repair.costUsd,
    },
  ].slice(-20);
  
  // Update specializations
  const failureTypes = { ...card.specializations.failureTypes };
  failureTypes[repair.failureType] = (failureTypes[repair.failureType] || 0) + (repair.success ? 1 : 0);
  
  const fileTypes = { ...card.specializations.fileTypes };
  fileTypes[repair.fileType] = (fileTypes[repair.fileType] || 0) + (repair.success ? 1 : 0);
  
  const complexity = { ...card.specializations.complexity };
  complexity[repair.complexity] = (complexity[repair.complexity] || 0) + (repair.success ? 1 : 0);
  
  // Calculate new trust score
  const metrics = { totalRepairs, successfulRepairs, failedRepairs, successRate, avgQualityScore, avgLatencyMs, avgCostUsd };
  const current = calculateTrustScore(metrics, card.trustScore.decayFactor);
  const trend = determineTrend(recentHistory);
  
  return {
    ...card,
    metrics,
    recentHistory,
    trustScore: {
      current,
      trend,
      lastUpdated: new Date().toISOString(),
      decayFactor: card.trustScore.decayFactor,
    },
    specializations: {
      failureTypes,
      fileTypes,
      complexity,
    },
  };
}

/**
 * Example ScoreCard for reference
 */
export const EXAMPLE_SCORE_CARD: ScoreCardV1 = {
  version: "scorecard.v1",
  agent: {
    id: "coder_gpt5",
    role: "coder",
    model: "openai/gpt-5-2",
  },
  metrics: {
    totalRepairs: 15,
    successfulRepairs: 13,
    failedRepairs: 2,
    successRate: 0.87,
    avgQualityScore: 0.92,
    avgLatencyMs: 42000,
    avgCostUsd: 0.15,
  },
  recentHistory: [
    {
      repairId: "repair_1768716900000",
      timestamp: "2026-01-18T06:15:00.000Z",
      success: true,
      qualityScore: 0.95,
      latencyMs: 45000,
      costUsd: 0.12,
    },
  ],
  trustScore: {
    current: 0.85,
    trend: "improving",
    lastUpdated: "2026-01-18T06:15:00.000Z",
    decayFactor: 0.8,
  },
  specializations: {
    failureTypes: {
      smoke_test: 0.90,
      swarm_execution: 0.85,
      builder_gate: 0.80,
    },
    fileTypes: {
      ".ts": 0.88,
      ".tsx": 0.85,
      ".json": 0.95,
    },
    complexity: {
      low: 0.95,
      medium: 0.85,
      high: 0.75,
    },
  },
};

/**
 * Create a new ScoreCard from repair results
 */
export function createScoreCard(opts: {
  repairId: string;
  failurePacket: any;
  repairPacket: any;
  testResults: {
    passed: boolean;
    regressions: string[];
    newFailures: string[];
  };
  humanReview: {
    coderAccuracy: number;
    reviewerUseful: number;
    arbiterCorrect: number;
  };
}): ScoreCardV1 {
  const agentId = "coder_gpt5"; // Default for now
  const agentRole = "coder";
  const agentModel = "openai/gpt-5-2";

  // Calculate overall score from human review
  const overallScore = (
    opts.humanReview.coderAccuracy * 0.4 +
    opts.humanReview.reviewerUseful * 0.3 +
    opts.humanReview.arbiterCorrect * 0.3
  );

  return {
    version: "scorecard.v1",
    agent: {
      id: agentId,
      role: agentRole,
      model: agentModel,
    },
    metrics: {
      totalRepairs: 1,
      successfulRepairs: opts.testResults.passed ? 1 : 0,
      failedRepairs: opts.testResults.passed ? 0 : 1,
      successRate: opts.testResults.passed ? 1.0 : 0.0,
      avgQualityScore: overallScore,
      avgLatencyMs: 0, // Not tracked in manual repair
      avgCostUsd: 0, // Not tracked in manual repair
    },
    recentHistory: [
      {
        repairId: opts.repairId,
        timestamp: new Date().toISOString(),
        success: opts.testResults.passed,
        qualityScore: overallScore,
        latencyMs: 0,
        costUsd: 0,
      },
    ],
    trustScore: {
      current: overallScore,
      trend: "stable",
      lastUpdated: new Date().toISOString(),
      decayFactor: 0.8,
    },
    specializations: {
      failureTypes: {},
      fileTypes: {},
      complexity: {},
    },
  };
}
