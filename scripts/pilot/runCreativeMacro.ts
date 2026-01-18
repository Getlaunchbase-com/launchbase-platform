/**
 * Creative Production Macro Runner
 * 
 * Executes Creator → Selector → Critic pipeline:
 * 1. Creator (GPT-5.2) generates 8-24 ideas
 * 2. Cap at 24 (prevent token bombs)
 * 3. Selector (Llama 8B) picks best 8
 * 4. Validate selected 8
 * 5. Critic validates final 8+8
 * 
 * Key differences from runPilotMacro:
 * - Adds selector step between creator and validation
 * - Tracks candidatesCount, selectedCount, selectorModel
 * - Caps creator output at 24 before selector
 * - Fallback: deterministic top-8 if selector fails
 */

import { callSpecialistWithRetry, type SpecialistInput, type SpecialistOutput } from '../../server/ai/pilotRuntime';
import { calculateDesignerTruthPenalty, calculateCriticTruthPenalty } from '../../server/ai/pilotRuntime';
import { validateDesignSwarmPayloadOrThrow } from '../../server/ai/engine/validation/designSwarmValidate';
import { toRoleConfig } from './adapters';
import type { RunMode, ValidationPolicy, NormalizationTracking, UsageTracking, SelectionTracking, PilotRun } from './types';
import { createValidationPolicy, createNormalizationTracking, createUsageTracking } from './types';
import { normalizeCriticRisks } from './normalizeCriticRisks';

type Lane = 'web' | 'marketing' | 'app' | 'artwork';

type CreativeStack = {
  systemsCreator: { modelId: string; provider: string; maxTokens: number; temperature: number; timeoutMs?: number };
  brandCreator: { modelId: string; provider: string; maxTokens: number; temperature: number; timeoutMs?: number };
  selector: { modelId: string; provider: string; maxTokens: number; temperature: number; timeoutMs?: number };
  critic: { modelId: string; provider: string; maxTokens: number; temperature: number; timeoutMs?: number };
};

/**
 * Parse and clean artifact payload (bulletproof parsing)
 */
function cleanParseArtifactPayload(artifact: any): any {
  if (!artifact || !artifact.payload) {
    throw new Error('[PARSE] Missing artifact payload');
  }
  
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
 * Cap candidate changes to maxCount (prevent token bombs)
 * Returns capped array + original count
 */
function capCandidates(changes: any[], maxCount: number): { capped: any[]; originalCount: number } {
  const originalCount = changes.length;
  const capped = changes.slice(0, maxCount);
  if (originalCount > maxCount) {
    console.log(`[CAP] Capped ${originalCount} → ${maxCount} candidates`);
  }
  return { capped, originalCount };
}

/**
 * Deterministic fallback selector: top 8 by confidence/specificity
 * Used when selector model fails
 */
function deterministicTop8(candidates: any[]): any[] {
  console.log('[FALLBACK] Using deterministic top-8 selector');
  
  // Score each candidate by:
  // 1. Has anchor? +10
  // 2. Rationale length > 20 chars? +5
  // 3. Has proposedValue? +5
  const scored = candidates.map((c, idx) => {
    let score = 0;
    if (c.anchor) score += 10;
    if (c.rationale && c.rationale.length > 20) score += 5;
    if (c.proposedValue) score += 5;
    return { change: c, score, originalIndex: idx };
  });
  
  // Sort by score desc, then by original index (stable)
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.originalIndex - b.originalIndex;
  });
  
  // Take top 8
  return scored.slice(0, 8).map(s => s.change);
}

/**
 * Assert content quality AFTER schema validation
 */
function assertContentAfterSchema(opts: {
  schemaKey: 'designer_systems_fast' | 'designer_brand_fast' | 'change_selector_fast' | 'design_critic_ruthless';
  lane: string;
  payload: any;
}): void {
  const { schemaKey, payload } = opts;

  if (schemaKey === 'change_selector_fast') {
    // Selector checks
    if (!payload || !Array.isArray(payload.selectedChanges)) {
      throw Object.assign(new Error('content_noncompliance: selectedChanges must be an array'), {
        stopReason: 'content_noncompliance',
      });
    }
    
    if (payload.selectedChanges.length !== 8) {
      throw Object.assign(
        new Error(`content_noncompliance: selector must return exactly 8, got ${payload.selectedChanges.length}`),
        { stopReason: 'content_noncompliance' }
      );
    }
  } else if (schemaKey !== 'design_critic_ruthless') {
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
 * Helper to make SpecialistInput
 */
function makeInput(opts: {
  role: any;
  lane: Lane;
  jobId: string;
  runId: string;
  plan: any;
  context: any;
  roleConfig: any;
}): SpecialistInput {
  return {
    role: opts.role,
    trace: {
      jobId: opts.jobId,
      runId: opts.runId,
    },
    input: {
      plan: opts.plan,
      context: opts.context,
    },
    roleConfig: opts.roleConfig,
  };
}

/**
 * Run one complete creative production macro: creator → cap → selector → critic
 */
export async function runCreativeMacro(params: {
  lane: Lane;
  rep: number;
  runId: string;
  jobId: string;
  plan: any;
  context: any;
  stack: CreativeStack;
  maxAttempts?: number;
  runMode?: RunMode;
  capBeforeSelect?: number;
}): Promise<PilotRun> {
  const { lane, rep, runId, jobId, plan, context, stack } = params;
  const maxAttempts = params.maxAttempts ?? 3;
  const runMode = params.runMode ?? 'production'; // Default to production for creative mode
  const capBeforeSelect = params.capBeforeSelect ?? 24;

  // Create validation policy and tracking objects
  const policy = createValidationPolicy(runMode);
  const normalizationTracking = createNormalizationTracking(policy.allowNormalization);
  const usageTracking = createUsageTracking();
  const selectionTracking: SelectionTracking = {
    enabled: true,
    systems: { candidatesCount: 0, selectedCount: 0, selectorModel: stack.selector.modelId },
    brand: { candidatesCount: 0, selectedCount: 0, selectorModel: stack.selector.modelId },
  };

  let attempts = 0;
  let lastErr: unknown = null;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      // ============================================================
      // SYSTEMS CREATOR → CAP → SELECTOR → VALIDATE
      // ============================================================
      
      console.log(`[${runId}] Calling systemsCreator (${stack.systemsCreator.modelId})...`);
      const systemsCreatorOut = await callSpecialistWithRetry(
        makeInput({
          role: 'designer_systems',
          lane,
          jobId,
          runId,
          plan,
          context: {
            ...context,
            lane,
            mode: 'creative', // Signal creative mode (no count enforcement)
            maxTokens: stack.systemsCreator.maxTokens,
            temperature: stack.systemsCreator.temperature,
          },
          roleConfig: toRoleConfig(
            stack.systemsCreator.modelId,
            stack.systemsCreator.provider,
            lane,
            {
              timeoutMs: stack.systemsCreator.timeoutMs || 45_000,
            }
          ),
        }),
        false // enableLadder
      );

      // Capture usage
      usageTracking.systems = {
        inputTokens: systemsCreatorOut.meta.inputTokens || 0,
        outputTokens: systemsCreatorOut.meta.outputTokens || 0,
        latencyMs: systemsCreatorOut.meta.latencyMs || 0,
        costUsd: systemsCreatorOut.meta.costUsd || 0,
      };

      // Parse creator output
      let systemsCreatorPayload = cleanParseArtifactPayload(systemsCreatorOut.artifact);
      const systemsCandidates = systemsCreatorPayload.proposedChanges || [];
      
      // Cap candidates to prevent token bombs
      const { capped: systemsCapped, originalCount: systemsOriginalCount } = capCandidates(
        systemsCandidates,
        capBeforeSelect
      );
      selectionTracking.systems.candidatesCount = systemsOriginalCount;

      console.log(`[${runId}] Calling selector for systems (${systemsCapped.length} candidates)...`);
      
      let systemsSelectedPayload: any;
      let selectorUsedFallback = false;
      
      try {
        // Call selector
        const systemsSelectorOut = await callSpecialistWithRetry(
          makeInput({
            role: 'change_selector_fast',
            lane,
            jobId,
            runId,
            plan,
            context: {
              ...context,
              lane,
              candidateChanges: systemsCapped,
            },
            roleConfig: toRoleConfig(
              stack.selector.modelId,
              stack.selector.provider,
              lane,
              {
                timeoutMs: stack.selector.timeoutMs || 30_000,
              }
            ),
          }),
          false // enableLadder
        );

        // Capture selector usage
        if (!usageTracking.selector) {
          usageTracking.selector = {
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: 0,
            costUsd: 0,
          };
        }
        usageTracking.selector.inputTokens += systemsSelectorOut.meta.inputTokens || 0;
        usageTracking.selector.outputTokens += systemsSelectorOut.meta.outputTokens || 0;
        usageTracking.selector.latencyMs += systemsSelectorOut.meta.latencyMs || 0;
        usageTracking.selector.costUsd += systemsSelectorOut.meta.costUsd || 0;

        // Parse selector output
        systemsSelectedPayload = cleanParseArtifactPayload(systemsSelectorOut.artifact);
        
        // Validate selector schema
        validateDesignSwarmPayloadOrThrow('change_selector_fast', systemsSelectedPayload);
        assertContentAfterSchema({ schemaKey: 'change_selector_fast', lane, payload: systemsSelectedPayload });
        
      } catch (selectorErr) {
        console.warn(`[${runId}] Selector failed for systems, using deterministic fallback:`, selectorErr);
        selectorUsedFallback = true;
        
        // Fallback: deterministic top-8
        const selected = deterministicTop8(systemsCapped);
        systemsSelectedPayload = { selectedChanges: selected };
      }

      // Map selectedChanges → proposedChanges (for downstream compatibility)
      const systemsPayload = {
        proposedChanges: systemsSelectedPayload.selectedChanges,
      };
      selectionTracking.systems.selectedCount = systemsPayload.proposedChanges.length;

      // Validate final craft schema (should always pass since selector guarantees 8)
      validateDesignSwarmPayloadOrThrow('designer_systems_fast', systemsPayload);
      assertContentAfterSchema({ schemaKey: 'designer_systems_fast', lane, payload: systemsPayload });

      // ============================================================
      // BRAND CREATOR → CAP → SELECTOR → VALIDATE
      // ============================================================
      
      console.log(`[${runId}] Calling brandCreator (${stack.brandCreator.modelId})...`);
      const brandCreatorOut = await callSpecialistWithRetry(
        makeInput({
          role: 'designer_brand',
          lane,
          jobId,
          runId,
          plan,
          context: {
            ...context,
            lane,
            mode: 'creative',
            systemsArtifact: systemsPayload, // Let brand see selected systems
            maxTokens: stack.brandCreator.maxTokens,
            temperature: stack.brandCreator.temperature,
          },
          roleConfig: toRoleConfig(
            stack.brandCreator.modelId,
            stack.brandCreator.provider,
            lane,
            {
              timeoutMs: stack.brandCreator.timeoutMs || 45_000,
            }
          ),
        }),
        false // enableLadder
      );

      // Capture usage
      usageTracking.brand = {
        inputTokens: brandCreatorOut.meta.inputTokens || 0,
        outputTokens: brandCreatorOut.meta.outputTokens || 0,
        latencyMs: brandCreatorOut.meta.latencyMs || 0,
        costUsd: brandCreatorOut.meta.costUsd || 0,
      };

      // Parse creator output
      let brandCreatorPayload = cleanParseArtifactPayload(brandCreatorOut.artifact);
      const brandCandidates = brandCreatorPayload.proposedChanges || [];
      
      // Cap candidates
      const { capped: brandCapped, originalCount: brandOriginalCount } = capCandidates(
        brandCandidates,
        capBeforeSelect
      );
      selectionTracking.brand.candidatesCount = brandOriginalCount;

      console.log(`[${runId}] Calling selector for brand (${brandCapped.length} candidates)...`);
      
      let brandSelectedPayload: any;
      
      try {
        // Call selector
        const brandSelectorOut = await callSpecialistWithRetry(
          makeInput({
            role: 'change_selector_fast',
            lane,
            jobId,
            runId,
            plan,
            context: {
              ...context,
              lane,
              candidateChanges: brandCapped,
            },
            roleConfig: toRoleConfig(
              stack.selector.modelId,
              stack.selector.provider,
              lane,
              {
                timeoutMs: stack.selector.timeoutMs || 30_000,
              }
            ),
          }),
          false // enableLadder
        );

        // Capture selector usage
        if (!usageTracking.selector) {
          usageTracking.selector = {
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: 0,
            costUsd: 0,
          };
        }
        usageTracking.selector.inputTokens += brandSelectorOut.meta.inputTokens || 0;
        usageTracking.selector.outputTokens += brandSelectorOut.meta.outputTokens || 0;
        usageTracking.selector.latencyMs += brandSelectorOut.meta.latencyMs || 0;
        usageTracking.selector.costUsd += brandSelectorOut.meta.costUsd || 0;

        // Parse selector output
        brandSelectedPayload = cleanParseArtifactPayload(brandSelectorOut.artifact);
        
        // Validate selector schema
        validateDesignSwarmPayloadOrThrow('change_selector_fast', brandSelectedPayload);
        assertContentAfterSchema({ schemaKey: 'change_selector_fast', lane, payload: brandSelectedPayload });
        
      } catch (selectorErr) {
        console.warn(`[${runId}] Selector failed for brand, using deterministic fallback:`, selectorErr);
        selectorUsedFallback = true;
        
        // Fallback: deterministic top-8
        const selected = deterministicTop8(brandCapped);
        brandSelectedPayload = { selectedChanges: selected };
      }

      // Map selectedChanges → proposedChanges
      const brandPayload = {
        proposedChanges: brandSelectedPayload.selectedChanges,
      };
      selectionTracking.brand.selectedCount = brandPayload.proposedChanges.length;

      // Validate final craft schema
      validateDesignSwarmPayloadOrThrow('designer_brand_fast', brandPayload);
      assertContentAfterSchema({ schemaKey: 'designer_brand_fast', lane, payload: brandPayload });

      // ============================================================
      // CRITIC (ruthless = 10 issues + 10 fixes + pass:false)
      // ============================================================
      
      console.log(`[${runId}] Calling critic (${stack.critic.modelId})...`);
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
            maxTokens: stack.critic.maxTokens,
            temperature: stack.critic.temperature,
          },
          roleConfig: toRoleConfig(
            stack.critic.modelId,
            stack.critic.provider,
            lane,
            {
              timeoutMs: stack.critic.timeoutMs || 90_000,
            }
          ),
        }),
        false // enableLadder
      );

      // Capture usage
      usageTracking.critic = {
        inputTokens: criticOut.meta.inputTokens || 0,
        outputTokens: criticOut.meta.outputTokens || 0,
        latencyMs: criticOut.meta.latencyMs || 0,
        costUsd: criticOut.meta.costUsd || 0,
      };

      // Parse and normalize critic
      let criticPayload = cleanParseArtifactPayload(criticOut.artifact);
      
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
      
      // Validate critic schema
      validateDesignSwarmPayloadOrThrow('design_critic_ruthless', criticPayload);
      assertContentAfterSchema({ schemaKey: 'design_critic_ruthless', lane, payload: criticPayload });

      // ============================================================
      // SCORE & RETURN
      // ============================================================
      
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

      const truthPenalty = (
        systemsTruthPenalty.truthPenalty +
        brandTruthPenalty.truthPenalty +
        criticTruthPenalty.truthPenalty
      ) / 3;

      const baseScore = 100;
      const qualityPenalty = 0.01;
      const finalScore = Math.max(0, baseScore - (truthPenalty * 100) - qualityPenalty);

      const totalCostUsd =
        (usageTracking.systems?.costUsd || 0) +
        (usageTracking.brand?.costUsd || 0) +
        (usageTracking.selector?.costUsd || 0) +
        (usageTracking.critic?.costUsd || 0);
      
      const totalLatencyMs =
        (usageTracking.systems?.latencyMs || 0) +
        (usageTracking.brand?.latencyMs || 0) +
        (usageTracking.selector?.latencyMs || 0) +
        (usageTracking.critic?.latencyMs || 0);

      // Calculate usage totals
      usageTracking.totals = {
        inputTokens: (usageTracking.systems?.inputTokens || 0) + (usageTracking.brand?.inputTokens || 0) + (usageTracking.selector?.inputTokens || 0) + (usageTracking.critic?.inputTokens || 0),
        outputTokens: (usageTracking.systems?.outputTokens || 0) + (usageTracking.brand?.outputTokens || 0) + (usageTracking.selector?.outputTokens || 0) + (usageTracking.critic?.outputTokens || 0),
        latencyMs: totalLatencyMs,
        costUsd: totalCostUsd,
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
          pass: criticPayload.pass || false,
        },
        finalScore,
        truthPenalty,
        qualityPenalty,
        meta: {
          totalCostUsd,
          totalLatencyMs,
          attempts,
          models: {
            systems: stack.systemsCreator.modelId,
            brand: stack.brandCreator.modelId,
            critic: stack.critic.modelId,
          },
          stopReasons: {
            systems: systemsCreatorOut.stopReason,
            brand: brandCreatorOut.stopReason,
            critic: criticOut.stopReason,
          },
          requestIds: {
            systems: systemsCreatorOut.meta.requestId || '',
            brand: brandCreatorOut.meta.requestId || '',
            critic: criticOut.meta.requestId || '',
          },
          normalization: normalizationTracking,
          usage: usageTracking,
          selection: selectionTracking,
        },
      };

    } catch (err) {
      lastErr = err;
      console.error(`[${runId}] Attempt ${attempts}/${maxAttempts} failed:`, err);
      
      if (attempts >= maxAttempts) {
        throw err;
      }
    }
  }

  throw lastErr || new Error('Unknown error in runCreativeMacro');
}
