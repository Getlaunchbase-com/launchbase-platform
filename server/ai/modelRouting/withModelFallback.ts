/**
 * withModelFallback - Health-aware model fallback wrapper
 * 
 * Wraps AI provider calls with automatic fallback retry:
 * - Filters candidates by health status
 * - Retries on transient errors (timeout, 5xx, network)
 * - Stops on non-transient errors (4xx, schema, auth)
 * - Tracks attempted models and failure reasons
 */

import { isHealthy, markFailure, markSuccess } from './modelHealth';

export interface FallbackOptions {
  primary: string;
  fallbacks: string[];
  call: (modelId: string) => Promise<any>;
  maxAttempts?: number;
  timeoutMs?: number;
  context?: string;
  isTransientError?: (err: any) => boolean;
}

export interface FallbackResult<T = any> {
  response: T;
  selectedModel: string;
  attemptedModels: string[];
  failureReasons: Record<string, string>;
}

/**
 * Default transient error classifier
 */
function defaultIsTransientError(err: any): boolean {
  const msg = err?.message || String(err);
  const msgLower = msg.toLowerCase();
  
  // Retryable errors
  if (msgLower.includes('timeout')) return true;
  if (msgLower.includes('abort')) return true;
  if (msgLower.includes('no response')) return true;
  if (msgLower.includes('econnreset')) return true;
  if (msgLower.includes('etimedout')) return true;
  if (msgLower.includes('gateway')) return true;
  if (msgLower.includes('cloudflare')) return true;
  if (msgLower.includes('upstream error')) return true;
  if (msg.match(/5\d{2}/)) return true; // 5xx errors
  
  // Non-retryable errors
  if (msgLower.includes('invalid_request')) return false;
  if (msgLower.includes('schema')) return false;
  if (msgLower.includes('validation')) return false;
  if (msgLower.includes('not_in_registry')) return false;
  if (msgLower.includes('invalid api key')) return false;
  if (msgLower.includes('unauthorized')) return false;
  if (msg.match(/4\d{2}/)) return false; // 4xx errors (except maybe 429)
  
  // Default: treat as transient
  return true;
}

/**
 * Wrap a model call with health-aware fallback retry
 */
export async function withModelFallback<T = any>(
  options: FallbackOptions
): Promise<FallbackResult<T>> {
  const {
    primary,
    fallbacks,
    call,
    maxAttempts = 3,
    timeoutMs = 120000,
    context = 'unknown',
    isTransientError = defaultIsTransientError,
  } = options;
  
  // Build candidate list
  const allCandidates = [primary, ...fallbacks];
  
  // Filter by health status
  const healthyCandidates = allCandidates.filter(isHealthy);
  
  if (healthyCandidates.length === 0) {
    console.warn(`[withModelFallback] No healthy models available (context: ${context})`);
    // Fall back to all candidates if none are healthy
    healthyCandidates.push(...allCandidates);
  }
  
  // Limit to maxAttempts
  const candidates = healthyCandidates.slice(0, maxAttempts);
  
  const attemptedModels: string[] = [];
  const failureReasons: Record<string, string> = {};
  
  console.log(`[withModelFallback] Trying ${candidates.length} models (context: ${context})`, {
    candidates,
    maxAttempts,
    timeoutMs,
  });
  
  for (const modelId of candidates) {
    attemptedModels.push(modelId);
    
    try {
      // Wrap call with timeout
      const response = await Promise.race([
        call(modelId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      
      // Success!
      markSuccess(modelId);
      console.log(`[withModelFallback] Success with ${modelId} (context: ${context})`);
      
      return {
        response,
        selectedModel: modelId,
        attemptedModels,
        failureReasons,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      failureReasons[modelId] = errMsg;
      
      console.warn(`[withModelFallback] ${modelId} failed: ${errMsg} (context: ${context})`);
      
      // Classify error
      const isTransient = isTransientError(err);
      
      if (!isTransient) {
        // Non-transient error: stop immediately
        console.error(`[withModelFallback] Non-transient error, stopping (context: ${context})`);
        throw err;
      }
      
      // Transient error: mark unhealthy and try next
      markFailure(modelId, errMsg);
      
      // If this was the last candidate, throw
      if (attemptedModels.length >= candidates.length) {
        console.error(`[withModelFallback] All ${candidates.length} models failed (context: ${context})`);
        throw new Error(`All models failed: ${Object.entries(failureReasons).map(([m, r]) => `${m}: ${r}`).join('; ')}`);
      }
    }
  }
  
  // Should never reach here
  throw new Error(`withModelFallback: unexpected exit (context: ${context})`);
}
