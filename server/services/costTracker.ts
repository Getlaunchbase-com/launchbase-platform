/**
 * Cost Tracking & Rate Limiting Service
 *
 * Logs every LLM API call with token counts and estimated cost.
 * Enforces per-user daily rate limits for beta.
 */

import { getDb } from "../db";
import { apiUsageLog } from "../db/schema";
import { eq, and, gte, count, sql } from "drizzle-orm";

// ── Cost per 1M tokens (approximate, based on AIMLAPI/provider pricing) ──

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "anthropic/claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "meta-llama/Llama-3.1-8B-Instruct": { input: 0.05, output: 0.08 },
  "deepseek/deepseek-chat-v3.1": { input: 0.14, output: 0.28 },
  "google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

const DEFAULT_COST = { input: 1.0, output: 3.0 }; // conservative fallback

const DAILY_MESSAGE_LIMIT = parseInt(process.env.DAILY_MESSAGE_LIMIT || "50", 10);

// ── Helpers ──────────────────────────────────────────────────────────

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = COST_PER_MILLION[model] || DEFAULT_COST;
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Log an API call's token usage and estimated cost.
 */
export async function logUsage(
  userId: number,
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
  endpoint: string = "chat",
): Promise<void> {
  const db = await getDb();
  if (!db || !usage) return;

  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
  const cost = estimateCost(model, inputTokens, outputTokens);

  try {
    await db.insert(apiUsageLog).values({
      userId,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd: cost.toFixed(6),
      endpoint,
    });
  } catch (err) {
    console.warn("[costTracker] Failed to log usage:", err);
  }
}

/**
 * Check if a user has exceeded their daily message limit.
 * Returns { allowed, remaining, limit }.
 */
export async function checkRateLimit(
  userId: number,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const db = await getDb();
  if (!db) return { allowed: true, remaining: DAILY_MESSAGE_LIMIT, limit: DAILY_MESSAGE_LIMIT };

  try {
    const todayStart = startOfDay();
    const [result] = await db
      .select({ total: count() })
      .from(apiUsageLog)
      .where(
        and(
          eq(apiUsageLog.userId, userId),
          gte(apiUsageLog.createdAt, todayStart),
        ),
      );

    const used = result?.total ?? 0;
    const remaining = Math.max(0, DAILY_MESSAGE_LIMIT - used);

    return {
      allowed: used < DAILY_MESSAGE_LIMIT,
      remaining,
      limit: DAILY_MESSAGE_LIMIT,
    };
  } catch {
    return { allowed: true, remaining: DAILY_MESSAGE_LIMIT, limit: DAILY_MESSAGE_LIMIT };
  }
}

/**
 * Get usage summary for a user (today + all-time).
 */
export async function getUserUsageSummary(
  userId: number,
): Promise<{
  today: { messages: number; totalTokens: number; estimatedCostUsd: number };
  allTime: { messages: number; totalTokens: number; estimatedCostUsd: number };
}> {
  const db = await getDb();
  const empty = { messages: 0, totalTokens: 0, estimatedCostUsd: 0 };
  if (!db) return { today: empty, allTime: empty };

  try {
    const todayStart = startOfDay();

    const [todayResult] = await db
      .select({
        messages: count(),
        totalTokens: sql<number>`COALESCE(SUM(${apiUsageLog.totalTokens}), 0)`,
        totalCost: sql<string>`COALESCE(SUM(${apiUsageLog.estimatedCostUsd}), 0)`,
      })
      .from(apiUsageLog)
      .where(and(eq(apiUsageLog.userId, userId), gte(apiUsageLog.createdAt, todayStart)));

    const [allTimeResult] = await db
      .select({
        messages: count(),
        totalTokens: sql<number>`COALESCE(SUM(${apiUsageLog.totalTokens}), 0)`,
        totalCost: sql<string>`COALESCE(SUM(${apiUsageLog.estimatedCostUsd}), 0)`,
      })
      .from(apiUsageLog)
      .where(eq(apiUsageLog.userId, userId));

    return {
      today: {
        messages: todayResult?.messages ?? 0,
        totalTokens: todayResult?.totalTokens ?? 0,
        estimatedCostUsd: parseFloat(todayResult?.totalCost ?? "0"),
      },
      allTime: {
        messages: allTimeResult?.messages ?? 0,
        totalTokens: allTimeResult?.totalTokens ?? 0,
        estimatedCostUsd: parseFloat(allTimeResult?.totalCost ?? "0"),
      },
    };
  } catch {
    return { today: empty, allTime: empty };
  }
}
