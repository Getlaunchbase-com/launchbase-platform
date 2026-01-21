/**
 * Model Health Cache - Exponential backoff cooldown for unhealthy models
 * 
 * Tracks model failures and applies cooldown periods to prevent
 * repeated attempts to unhealthy models.
 */

interface HealthRecord {
  fails: number;
  unhealthyUntil: number; // timestamp in ms
  lastError?: string;
}

const healthCache = new Map<string, HealthRecord>();

// Cooldown formula: min(2min * 2^(fails-1), 30min)
const MIN_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const MAX_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check if a model is healthy (not in cooldown)
 */
export function isHealthy(modelId: string): boolean {
  const record = healthCache.get(modelId);
  if (!record) return true;
  
  const now = Date.now();
  if (now >= record.unhealthyUntil) {
    // Cooldown expired
    return true;
  }
  
  return false;
}

/**
 * Mark a model as failed and apply exponential backoff cooldown
 */
export function markFailure(modelId: string, errorMsg?: string): void {
  const now = Date.now();
  const record = healthCache.get(modelId) || { fails: 0, unhealthyUntil: 0 };
  
  record.fails += 1;
  record.lastError = errorMsg;
  
  // Calculate cooldown: 2min * 2^(fails-1), capped at 30min
  const cooldownMs = Math.min(
    MIN_COOLDOWN_MS * Math.pow(2, record.fails - 1),
    MAX_COOLDOWN_MS
  );
  
  record.unhealthyUntil = now + cooldownMs;
  healthCache.set(modelId, record);
  
  console.log(`[ModelHealth] ${modelId} marked unhealthy for ${Math.round(cooldownMs / 1000 / 60)}min (failure #${record.fails})`);
}

/**
 * Mark a model as successful (decay failure count)
 */
export function markSuccess(modelId: string): void {
  const record = healthCache.get(modelId);
  if (!record) return;
  
  // Decay failures on success
  record.fails = Math.max(0, record.fails - 1);
  
  if (record.fails === 0) {
    healthCache.delete(modelId);
  } else {
    healthCache.set(modelId, record);
  }
}

/**
 * Clear health status for a specific model (manual recovery)
 */
export function clearHealth(modelId: string): void {
  healthCache.delete(modelId);
  console.log(`[ModelHealth] ${modelId} health cleared`);
}

/**
 * Clear all health status (testing utility)
 */
export function clearAllHealth(): void {
  healthCache.clear();
  console.log(`[ModelHealth] All health records cleared`);
}

/**
 * Get health snapshot for all models (debugging/monitoring)
 */
export function getHealthSnapshot(): Record<string, HealthRecord> {
  const snapshot: Record<string, HealthRecord> = {};
  for (const [modelId, record] of Array.from(healthCache.entries())) {
    snapshot[modelId] = { ...record };
  }
  return snapshot;
}
