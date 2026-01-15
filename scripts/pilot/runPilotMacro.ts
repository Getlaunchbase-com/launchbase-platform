/**
 * Pilot Macro Runner
 * 
 * Executes one complete pilot run: systems → brand → critic → validate → score
 * 
 * Key contracts:
 * 1. Schema routing: validate with _fast/_ruthless keys, not base roles
 * 2. JSON cleaning BEFORE validation
 * 3. Retry ladder: timeout, provider_failed, invalid_json (NOT schema_failed for critic)
 */

import { callSpecialistWithRetry, type SpecialistInput, type SpecialistOutput, type SpecialistStopReason } from '../../server/ai/pilotRuntime';
import { calculateDesignerTruthPenalty, calculateCriticTruthPenalty } from '../../server/ai/pilotRuntime';
import { validateDesignSwarmPayloadOrThrow, type DesignSwarmSchemaKey } from '../../server/ai/engine/validation/designSwarmValidate';
import { toRoleConfig } from './adapters';
import type { RunMode, ValidationPolicy, NormalizationTracking, UsageTracking } from './types';
import { createValidationPolicy, createNormalizationTracking, createUsageTracking } from './types';
import { normalizeCraftFastPayload, logNormalizationEvent } from './normalizer';
import { normalizeCriticRisks } from './normalizeCriticRisks';

type Lane = 'web' | 'marketing' | 'app' | 'artwork';
type StepKind = 'craft' | 'critic';

type PilotStack = {
  designer_systems_fast: { modelId: string; provider: string; maxTokens: number; temperature: number; timeoutMs?: number };
  designer_brand_fast: { modelId: string; provider: string; maxTokens: number; temperature: number; timeoutMs?: number };
  design_critic_ruthless: { modelId: string; provider: string; maxTokens: number; temperature: number; timeoutMs?: number };
};

export interface PilotRun {
  lane: Lane;
  rep: number;
  runId: string;
  timestamp: string;
  runMode: RunMode;
  status: 'VALID' | 'RETRIED' | 'FAILED';
  systems: {
    changes: any[];
    anchorCount: number;
  };
  brand: {
    changes: any[];
    anchorCount: number;
  };
  critic: {
    issues: any[];
    suggestedFixes: any[];
    pass: boolean;
  };
  finalScore: number;
  truthPenalty: number;
  qualityPenalty: number;
  meta: {
    totalCostUsd: number;
    totalLatencyMs: number;
    attempts: number;
    models: { systems: string; brand: string; critic: string };
    stopReasons: { systems: string; brand: string; critic: string };
    requestIds: { systems: string; brand: string; critic: string };
    normalization: NormalizationTracking;
    usage: UsageTracking;
  };
}

type RetryableStopReason = 'timeout' | 'provider_failed' | 'json_parse_failed' | 'schema_failed' | 'content_noncompliance';

function isRetryable(stopReason: SpecialistStopReason): boolean {
  // Always retryable
  if (stopReason === 'timeout' || stopReason === 'provider_failed' || stopReason === 'invalid_json') {
    return true;
  }
  
  // Craft-specific retryable (schema_failed, content_noncompliance)
  // For now, allow retries on schema_failed since we're in craft-heavy pilot
  // TODO: Make this step-aware when critic validation is added
  if (stopReason === 'schema_failed' || stopReason === 'content_noncompliance') {
    return true;
  }
  
  return false;
}

/**
 * Parse and clean artifact payload (bulletproof parsing)
 * Returns ONLY the unwrapped payload object
 */
function cleanParseArtifactPayload(artifact: any): any {
  if (!artifact || !artifact.payload) {
    throw new Error('[PARSE] Missing artifact payload');
  }
  
  // If payload is already parsed, return it
  if (typeof artifact.payload === 'object' && !artifact.payload.raw) {
    return artifact.payload;
  }
  
  // If payload has raw field, parse it
  let raw = artifact.payload.raw || artifact.payload;
  if (typeof raw !== 'string') {
    return raw; // Already parsed
  }
  
  // Strip markdown fences, BOM, wrappers
  raw = raw.trim();
  raw = raw.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  raw = raw.replace(/^\uFEFF/, ''); // BOM
  
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`[PARSE] JSON parse failed: ${(err as Error).message}`);
  }
}

/**
 * Parse and clean artifact, returning full ArtifactV1 envelope
 * Returns { ...artifact, payload: parsedPayload }
 */
function cleanParseArtifactV1(artifact: any): any {
  const parsedPayload = cleanParseArtifactPayload(artifact);
  return {
    ...artifact,
    payload: parsedPayload,
  };
}

/**
 * @deprecated Use cleanParseArtifactPayload or cleanParseArtifactV1 instead
 */
function cleanParseJsonArtifact(artifact: any): any {
  return cleanParseArtifactPayload(artifact);
}

// Validation is now handled by validateDesignSwarmPayloadOrThrow from designSwarmValidate.ts

/**
 * Retry wrapper for craft steps: retries on schema_failed
 * Critic steps don't retry on schema_failed (prompt contract drift)
 */
async function callWithCraftRetry(
  kind: StepKind,
  callFn: () => Promise<SpecialistOutput>,
  maxAttempts: number = 3
): Promise<SpecialistOutput> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await callFn();
      return result;
    } catch (err: any) {
      lastError = err;
      const stopReason = err.stopReason || 'unknown';
      
      // Determine if retryable based on kind
      const isRetryable =
        stopReason === 'timeout' ||
        stopReason === 'provider_failed' ||
        stopReason === 'invalid_json' ||
        (kind === 'craft' && stopReason === 'schema_failed') ||
        (kind === 'craft' && stopReason === 'content_noncompliance');
      
      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }
      
      console.log(`[CRAFT_RETRY] Attempt ${attempt} failed with ${stopReason}, retrying...`);
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Make SpecialistInput from parameters
 */
function makeInput(args: {
  role: 'designer_systems' | 'designer_brand' | 'design_critic_ruthless';
  lane: string;
  jobId: string;
  runId: string;
  plan: any;
  context: any;
  roleConfig: SpecialistInput['roleConfig'];
}): SpecialistInput {
  return {
    role: args.role as any, // Type assertion for role compatibility
    trace: { jobId: args.jobId, runId: args.runId },
    input: { plan: args.plan, context: args.context },
    roleConfig: args.roleConfig,
  };
}

/**
 * Extract stop reason from error
 */
function extractStopReason(err: any): SpecialistStopReason | null {
  return err?.stopReason ?? err?.code ?? null;
}

/**
 * Normalize stop reason from SpecialistOutput
 */
function normalizeStopReason(out: SpecialistOutput): string {
  return out.stopReason;
}

/**
 * Assert content quality AFTER schema validation (policy-driven)
 * 
 * Minimal checks since schema already enforces EXACTLY 8/10:
 * - Payload shape (object root, not array)
 * - Rationale quality (not empty)
 * - Critic pass=false
 */
function assertContentAfterSchema(opts: {
  schemaKey: 'designer_systems_fast' | 'designer_brand_fast' | 'design_critic_ruthless';
  lane: string;
  payload: any;
}): void {
  const { schemaKey, lane, payload } = opts;

  if (schemaKey !== 'design_critic_ruthless') {
    // Designer checks
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw Object.assign(new Error('content_noncompliance: payload must be an object'), {
        stopReason: 'content_noncompliance',
      });
    }

    const proposedChanges = payload.proposedChanges;
    if (!Array.isArray(proposedChanges)) {
      throw Object.assign(new Error('content_noncompliance: proposedChanges must be an array'), {
        stopReason: 'content_noncompliance',
      });
    }

    // Schema should enforce EXACTLY 8, but double-check for schema routing mistakes
    if (proposedChanges.length !== 8) {
      throw Object.assign(
        new Error(`content_noncompliance: expected exactly 8 changes, got ${proposedChanges.length}`),
        { stopReason: 'content_noncompliance' }
      );
    }

    // Quality check: rationale must not be empty
    for (const c of proposedChanges) {
      if (!c?.rationale || String(c.rationale).trim().length < 8) {
        throw Object.assign(new Error('content_noncompliance: rationale too short'), {
          stopReason: 'content_noncompliance',
        });
      }
    }
  } else {
    // Critic checks
    if (payload?.pass !== false) {
      throw Object.assign(new Error('content_noncompliance: critic pass must be false'), {
        stopReason: 'content_noncompliance',
      });
    }
  }
}

/**
 * Run one complete pilot macro: systems → brand → critic → validate → score
 */
export async function runPilotMacro(params: {
  lane: Lane;
  rep: number;
  runId: string;
  jobId: string;
  plan: any;
  context: any;
  stack: PilotStack;
  maxAttempts?: number;
  runMode?: RunMode;
}): Promise<PilotRun> {
  const { lane, rep, runId, jobId, plan, context, stack } = params;
  const maxAttempts = params.maxAttempts ?? 3;
  const runMode = params.runMode ?? 'tournament';

  // Create validation policy and tracking objects
  const policy = createValidationPolicy(runMode);
  const normalizationTracking = createNormalizationTracking(policy.allowNormalization);
  const usageTracking = createUsageTracking();

  let attempts = 0;
  let lastErr: unknown = null;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      // 1) SYSTEMS (fast = exactly 8)
      console.log(`[${runId}] Calling designer_systems_fast...`);
      const systemsOut = await callSpecialistWithRetry(
        makeInput({
          role: 'designer_systems',
          lane,
          jobId,
          runId,
          plan,
          context: {
            ...context,
            lane,
            mode: 'fast',
            maxTokens: stack.designer_systems_fast.maxTokens,
            temperature: stack.designer_systems_fast.temperature,
            validation: {
              mode: 'schema_first',
              enableContentValidator: true,
              contentValidatorPhase: 'after_schema',
              treatWrongCountAs: 'content_noncompliance',
            },
          },
          roleConfig: toRoleConfig(
            stack.designer_systems_fast.modelId,
            stack.designer_systems_fast.provider,
            lane,
            {
              timeoutMs: stack.designer_systems_fast.maxTokens >= 2000 ? 45_000 : 30_000,
            }
          ),
        }),
        false // enableLadder
      );

      // Capture usage immediately (before validation, so it's tracked even if validation fails)
      usageTracking.systems = {
        inputTokens: systemsOut.meta.inputTokens || 0,
        outputTokens: systemsOut.meta.outputTokens || 0,
        latencyMs: systemsOut.meta.latencyMs || 0,
        costUsd: systemsOut.meta.costUsd || 0,
      };

      // 1) Parse and unwrap payload
      let systemsPayload = cleanParseArtifactPayload(systemsOut.artifact);
      
      // 2) Apply normalization if enabled (AFTER parse, BEFORE schema validation)
      if (policy.allowNormalization) {
        const result = normalizeCraftFastPayload(systemsPayload);
        systemsPayload = result.payload;
        normalizationTracking.events.systems = {
      kind: 'truncate',
      applied: result.event.truncated,
      from: result.event.from,
      to: result.event.to,
    };
        if (result.event.truncated) {
          normalizationTracking.applied = true;
          logNormalizationEvent('systems', result.event);
        }
      }
      
      // 3) Schema validate payload (Zod strict validation)
      validateDesignSwarmPayloadOrThrow('designer_systems_fast', systemsPayload);
      
      // 4) Content validation (after schema)
      assertContentAfterSchema({ schemaKey: 'designer_systems_fast', lane, payload: systemsPayload });

      // 2) BRAND (fast = exactly 8)
      console.log(`[${runId}] Calling designer_brand_fast...`);
      const brandOut = await callSpecialistWithRetry(
        makeInput({
          role: 'designer_brand',
          lane,
          jobId,
          runId,
          plan,
          context: {
            ...context,
            lane,
            mode: 'fast',
            systemsArtifact: systemsPayload, // Let brand see systems decisions
            maxTokens: stack.designer_brand_fast.maxTokens,
            temperature: stack.designer_brand_fast.temperature,
            validation: {
              mode: 'schema_first',
              enableContentValidator: true,
              contentValidatorPhase: 'after_schema',
              treatWrongCountAs: 'content_noncompliance',
            },
          },
          roleConfig: toRoleConfig(
            stack.designer_brand_fast.modelId,
            stack.designer_brand_fast.provider,
            lane,
            {
              timeoutMs: stack.designer_brand_fast.maxTokens >= 2000 ? 45_000 : 30_000,
            }
          ),
        }),
        false // enableLadder
      );

      // Capture usage immediately (before validation, so it's tracked even if validation fails)
      usageTracking.brand = {
        inputTokens: brandOut.meta.inputTokens || 0,
        outputTokens: brandOut.meta.outputTokens || 0,
        latencyMs: brandOut.meta.latencyMs || 0,
        costUsd: brandOut.meta.costUsd || 0,
      };

      // 1) Parse and unwrap payload
      let brandPayload = cleanParseArtifactPayload(brandOut.artifact);
      
      // 2) Apply normalization if enabled (AFTER parse, BEFORE schema validation)
      if (policy.allowNormalization) {
        const result = normalizeCraftFastPayload(brandPayload);
        brandPayload = result.payload;
        normalizationTracking.events.brand = {
          kind: 'truncate',
          applied: result.event.truncated,
          from: result.event.from,
          to: result.event.to,
        };
        if (result.event.truncated) {
          normalizationTracking.applied = true;
          logNormalizationEvent('brand', result.event);
        }
      }
      
      // 3) Schema validate payload (Zod strict validation)
      validateDesignSwarmPayloadOrThrow('designer_brand_fast', brandPayload);
      
      // 4) Content validation (after schema)
      assertContentAfterSchema({ schemaKey: 'designer_brand_fast', lane, payload: brandPayload });

      // 3) CRITIC (ruthless = 10 issues + 10 fixes + pass:false)
      console.log(`[${runId}] Calling design_critic_ruthless...`);
      const criticOut = await callSpecialistWithRetry(
        makeInput({
          role: 'design_critic_ruthless',
          lane,
          jobId,
          runId,
          plan,
          context: {
            ...context,
            lane,
            systemsArtifact: systemsPayload,
            brandArtifact: brandPayload,
            maxTokens: stack.design_critic_ruthless.maxTokens,
            temperature: stack.design_critic_ruthless.temperature,
            validation: {
              mode: 'schema_first',
              enableContentValidator: true,
              contentValidatorPhase: 'after_schema',
              treatWrongCountAs: 'content_noncompliance',
            },
          },
          roleConfig: toRoleConfig(
            stack.design_critic_ruthless.modelId,
            stack.design_critic_ruthless.provider,
            lane,
            {
              timeoutMs: stack.design_critic_ruthless.timeoutMs || 90_000, // Use stack timeout or default
            }
          ),
        }),
        false // enableLadder
      );

      // Capture usage immediately (before validation, so it's tracked even if validation fails)
      usageTracking.critic = {
        inputTokens: criticOut.meta.inputTokens || 0,
        outputTokens: criticOut.meta.outputTokens || 0,
        latencyMs: criticOut.meta.latencyMs || 0,
        costUsd: criticOut.meta.costUsd || 0,
      };

      // 1) Parse and unwrap payload
      let criticPayload = cleanParseArtifactPayload(criticOut.artifact);
      
      // 2) Apply critic risks normalization if enabled (AFTER parse, BEFORE schema validation)
      if (policy.allowNormalization) {
        const { payload: fixed, coercedCount } = normalizeCriticRisks(criticPayload);
        criticPayload = fixed;
        
        if (coercedCount > 0) {
          normalizationTracking.applied = true;
          normalizationTracking.events.critic = {
            kind: 'coerce_risks',
            applied: true,
            coercedCount,
            fromType: 'object',
            toType: 'string',
          };
          console.log(`[NORMALIZE_CRITIC] risks coerced ${coercedCount} objects → strings`);
        }
      }
      
      // 3) Schema validate payload (Zod strict validation: EXACTLY 10 issues/fixes, pass=false)
      validateDesignSwarmPayloadOrThrow('design_critic_ruthless', criticPayload);
      
      // 3) Content validation (after schema)
      assertContentAfterSchema({ schemaKey: 'design_critic_ruthless', lane, payload: criticPayload });

      // 4) Score
      const systemsTruthPenalty = calculateDesignerTruthPenalty(
        systemsPayload.proposedChanges || [],
        systemsPayload.proposedChanges?.length || 0
      );
      const brandTruthPenalty = calculateDesignerTruthPenalty(
        brandPayload.proposedChanges || [],
        brandPayload.proposedChanges?.length || 0
      );
      const criticTruthPenalty = calculateCriticTruthPenalty(
        criticPayload.issues || [],
        criticPayload.suggestedFixes || []
      );

      // Aggregate truth penalty (average across roles)
      const truthPenalty = (
        systemsTruthPenalty.truthPenalty +
        brandTruthPenalty.truthPenalty +
        criticTruthPenalty.truthPenalty
      ) / 3;

      // Simple scoring (baseScore - penalties)
      const baseScore = 100;
      const qualityPenalty = 0.01; // Placeholder
      const finalScore = Math.max(0, baseScore - (truthPenalty * 100) - qualityPenalty);

      // 5) Return PilotRun
      const totalCostUsd =
        systemsOut.meta.costUsd + brandOut.meta.costUsd + criticOut.meta.costUsd;
      const totalLatencyMs =
        systemsOut.meta.latencyMs + brandOut.meta.latencyMs + criticOut.meta.latencyMs;

      // Calculate usage totals (individual role usage already captured above)
      usageTracking.totals = {
        inputTokens: usageTracking.systems.inputTokens + usageTracking.brand.inputTokens + usageTracking.critic.inputTokens,
        outputTokens: usageTracking.systems.outputTokens + usageTracking.brand.outputTokens + usageTracking.critic.outputTokens,
        latencyMs: usageTracking.systems.latencyMs + usageTracking.brand.latencyMs + usageTracking.critic.latencyMs,
        costUsd: usageTracking.systems.costUsd + usageTracking.brand.costUsd + usageTracking.critic.costUsd,
      };

      return {
        lane,
        rep,
        runId,
        timestamp: new Date().toISOString(),
        runMode,
        status: attempts === 1 ? 'VALID' : 'RETRIED',
        systems: {
          changes: systemsPayload.proposedChanges || [],
          anchorCount: systemsPayload.proposedChanges?.length || 0,
        },
        brand: {
          changes: brandPayload.proposedChanges || [],
          anchorCount: brandPayload.proposedChanges?.length || 0,
        },
        critic: {
          issues: criticPayload.issues || [],
          suggestedFixes: criticPayload.suggestedFixes || [],
          pass: criticPayload.pass ?? false,
        },
        finalScore,
        truthPenalty,
        qualityPenalty,
        meta: {
          totalCostUsd,
          totalLatencyMs,
          attempts,
          models: {
            systems: systemsOut.meta.model,
            brand: brandOut.meta.model,
            critic: criticOut.meta.model,
          },
          stopReasons: {
            systems: normalizeStopReason(systemsOut),
            brand: normalizeStopReason(brandOut),
            critic: normalizeStopReason(criticOut),
          },
          requestIds: {
            systems: systemsOut.meta.requestId,
            brand: brandOut.meta.requestId,
            critic: criticOut.meta.requestId,
          },
          normalization: normalizationTracking,
          usage: usageTracking,
        },
      };
    } catch (err) {
      lastErr = err;
      console.error(`[${runId}] Attempt ${attempts} failed:`, (err as Error).message);

      // Make retry decision based on stopReason
      const stopReason = extractStopReason(err);
      if (!stopReason || !isRetryable(stopReason)) {
        console.error(`[${runId}] Non-retryable error, aborting`);
        break;
      }

      // Retry ladder continues
      console.log(`[${runId}] Retrying (attempt ${attempts + 1}/${maxAttempts})...`);
      continue;
    }
  }

  // Failed after retries - calculate usage totals from accumulated usage
  usageTracking.totals = {
    inputTokens: usageTracking.systems.inputTokens + usageTracking.brand.inputTokens + usageTracking.critic.inputTokens,
    outputTokens: usageTracking.systems.outputTokens + usageTracking.brand.outputTokens + usageTracking.critic.outputTokens,
    latencyMs: usageTracking.systems.latencyMs + usageTracking.brand.latencyMs + usageTracking.critic.latencyMs,
    costUsd: usageTracking.systems.costUsd + usageTracking.brand.costUsd + usageTracking.critic.costUsd,
  };
  
  console.error(`[${runId}] FAILED after ${attempts} attempts`);
  return {
    lane,
    rep,
    runId,
    timestamp: new Date().toISOString(),
    runMode,
    status: 'FAILED',
    systems: { changes: [], anchorCount: 0 },
    brand: { changes: [], anchorCount: 0 },
    critic: { issues: [], suggestedFixes: [], pass: false },
    finalScore: 0,
    truthPenalty: 1,
    qualityPenalty: 1,
    meta: {
      totalCostUsd: 0,
      totalLatencyMs: 0,
      attempts,
      models: {
        systems: stack.designer_systems_fast.modelId,
        brand: stack.designer_brand_fast.modelId,
        critic: stack.design_critic_ruthless.modelId,
      },
      stopReasons: { systems: 'unknown', brand: 'unknown', critic: 'unknown' },
      requestIds: { systems: '', brand: '', critic: '' },
      normalization: normalizationTracking,
      usage: usageTracking,
    },
  };
}
