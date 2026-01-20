/**
 * Swarm Runner V1 — Field General Orchestration
 * 
 * Implements 4-step swarm flow:
 * 1. Field General "plan"
 * 2. Specialist: craft
 * 3. Specialist: critic
 * 4. Field General "collapse"
 * 
 * Gate 1: Memory transport only (no provider spend)
 * Gate 2: Real provider calls for specialists
 * Gate 3: Model router integration
 */

import type { AiWorkOrderV1, AiWorkResultV1, AiArtifactV1, StopReasonV1 } from "./types";
import type { PolicyV1 } from "./policy/policyTypes";
import { callSpecialistAIML, type SpecialistRoleConfig } from "./specialists/aimlSpecialist";
import { buildDeterministicCollapse } from "./swarm/collapseDeterministic";

/**
 * Run swarm orchestration (Gate 1 skeleton)
 * 
 * @param workOrder - AI work order
 * @param policy - Resolved policy
 * @param ctx - Execution context
 * @returns AI work result with 4 artifacts
 */
export async function runSwarmV1(
  workOrder: AiWorkOrderV1,
  policy: PolicyV1,
  ctx: { traceId: string; tenant?: string; scope?: string }
): Promise<AiWorkResultV1> {
  const artifacts: AiArtifactV1[] = [];
  const costs: Array<{
    specialist: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    model: string;
    latencyMs: number;
    stopReason: string;
  }> = [];
  let totalCostUsd = 0;
  const roleCostsUsd: Record<string, number> = {};
  const roleModels: Record<string, string> = {};

  // Warning aggregator (Gate 2)
  let hadWarnings = false;
  const warnings: Array<{ role?: string; stopReason: string }> = [];

  function recordWarning(role: string | undefined, stopReason: string) {
    hadWarnings = true;
    warnings.push({ role, stopReason });
  }

  // Extract swarm config from policy
  const swarmConfig = policy.swarm;
  if (!swarmConfig?.enabled) {
    return {
      version: "v1",
      status: "failed",
      stopReason: "policy_invalid",
      needsHuman: true,
      traceId: ctx.traceId,
      artifacts: [],
      customerSafe: true,
    };
  }

  const { roles, costCapsUsd, failureMode, specialists } = swarmConfig;

  // Guard against undefined
  const rolesSafe = roles ?? {};
  const costCapsSafe = costCapsUsd ?? {};

  // Step 1: Field General "plan"
  const planArtifact: AiArtifactV1 = {
    kind: "swarm.plan",
    payload: {
      scope: workOrder.scope,
      inputs: workOrder.inputs,
      specialists,
      fingerprint: `${ctx.traceId}:plan`,
    },
    customerSafe: false,
  };
  artifacts.push(planArtifact);

  // Helper functions for iteration loop
  function getProposedChanges(payload: any): any[] {
    const pcs = payload?.proposedChanges;
    return Array.isArray(pcs) ? pcs : [];
  }

  function hasHighIssues(criticPayload: any): boolean {
    const issues = criticPayload?.issues;
    if (!Array.isArray(issues)) return false;
    return issues.some((i: any) => i?.severity === "high");
  }

  // Interpolate placeholders in prompt overrides
  function interpolate(template: string, vars: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (_, k) => {
      const v = vars[k];
      if (v === undefined) return `{${k}}`; // leave intact to make bugs visible
      return typeof v === "string" ? v : JSON.stringify(v, null, 2);
    });
  }

  // Step 2-3: Run specialists with iteration loop (craft → critic → revise)
  const maxIterations = (workOrder.inputs as any)?.maxIterations ?? 2;
  const craftRole = specialists[0] ?? "craft";
  const criticRole = specialists[1] ?? "critic";
  
  let craftArtifactLast: AiArtifactV1 | undefined;
  let criticArtifactLast: AiArtifactV1 | undefined;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Run craft, then critic
    for (const specialist of [craftRole, criticRole]) {
    const rawConfig = rolesSafe[specialist];
    if (!rawConfig) continue;
    
    // Ensure roleConfig satisfies SpecialistRoleConfig
    const roleConfig: SpecialistRoleConfig = {
      transport: (rawConfig.transport as "aiml" | "memory") ?? "aiml",
      model: rawConfig.model ?? "gpt-5.2",
      capabilities: rawConfig.capabilities ?? [],
      costCapUsd: (rawConfig as any).costCapUsd,
      timeoutMs: (rawConfig as any).timeoutMs,
    };
    // Check total cap BEFORE calling next specialist
    if (typeof costCapsSafe.total === "number" && totalCostUsd > costCapsSafe.total) {
      recordWarning(undefined, "cost_cap_exceeded");
      // Stop making calls, proceed to collapse
      break;
    }

    try {
      // Extract prompt overrides for this role (if present)
      const inputs = workOrder.inputs as any;
      
      // Normalize role key (handles "critic", "swarm.specialist.critic", etc.)
      const roleKey = specialist.split(".").pop() ?? specialist;
      
      // Role-specific overrides win, fall back to global
      const roleOverrides = inputs?.promptOverrides?.[roleKey];
      let systemPromptOverride = roleOverrides?.systemPromptOverride ?? inputs?.systemPromptOverride;
      let userPromptOverride = roleOverrides?.userPromptOverride ?? inputs?.userPromptOverride;
      
      console.log(`[swarm] role=${roleKey} override.system=${!!systemPromptOverride} override.user=${!!userPromptOverride}`);
      if (systemPromptOverride) {
        console.log(`[swarm] ${roleKey} systemPrompt preview: ${systemPromptOverride.slice(0, 120)}...`);
      }

      // Build context with iteration feedback
      const baseContext = workOrder.inputs ?? {};
      const contextWithFeedback =
        specialist === craftRole
          ? { ...baseContext, swarmIteration: iter, priorCritic: criticArtifactLast?.payload ?? null }
          : { ...baseContext, swarmIteration: iter, lastCraft: craftArtifactLast?.payload ?? null };

      // Interpolate placeholders in prompt overrides
      if (systemPromptOverride || userPromptOverride) {
        const vars = {
          failureContext: {
            component: inputs?.component,
            command: inputs?.command,
            logs: inputs?.logs,
            expectedFixes: inputs?.expectedFixes,
            constraints: inputs?.constraints,
          },
          constraints: inputs?.constraints ?? [],
          craftOutput: craftArtifactLast?.payload ?? null,
          priorCritic: criticArtifactLast?.payload ?? null,
          iteration: iter,
        };
        if (systemPromptOverride) {
          systemPromptOverride = interpolate(systemPromptOverride, vars);
        }
        if (userPromptOverride) {
          userPromptOverride = interpolate(userPromptOverride, vars);
        }
      }

      const result = await callSpecialistAIML({
        role: specialist as "craft" | "critic",
        trace: {
          jobId: ctx.traceId,
          step: `swarm.specialist.${specialist}`,
          round: iter, // Pass iteration round for deterministic replay
        },
        input: {
          plan: planArtifact.payload,
          context: contextWithFeedback,
          // Pass prompt overrides at top level (aimlSpecialist expects them here)
          ...(systemPromptOverride ? { systemPromptOverride } : {}),
          ...(userPromptOverride ? { userPromptOverride } : {}),
        },
        roleConfig,
      });

      // Critic schema gate: enforce required fields
      if (roleKey === "critic") {
        const p = result.artifact.payload as any;
        if (typeof p?.pass !== "boolean") {
          console.warn(`[swarm] Critic output missing required field 'pass', applying schema gate`);
          result.artifact.payload = {
            pass: false,
            issues: [
              {
                severity: "high" as const,
                message: "Critic output missing required field `pass` (schema gate).",
              },
            ],
            previewRecommended: false,
            risks: ["critic_schema_invalid"],
            assumptions: [],
            role: specialist,
            stopReason: result.stopReason,
          };
        } else {
          // Inject stopReason into valid critic payload
          result.artifact.payload = {
            ...(result.artifact.payload ?? {}),
            role: specialist,
            stopReason: result.stopReason,
          };
        }
      } else {
        // Inject stopReason into payload (single source of truth)
        result.artifact.payload = {
          ...(result.artifact.payload ?? {}),
          role: specialist,
          stopReason: result.stopReason,
        };
      }

      // Check per-role cap AFTER specialist call
      const perRoleCap = costCapsSafe.perRole?.[specialist];
      const roleCapExceeded = typeof perRoleCap === "number" && result.meta.costUsd > perRoleCap;

      if (roleCapExceeded) {
        // Rewrite artifact to reflect cap failure
        artifacts.push({
          kind: `swarm.specialist.${specialist}`,
          customerSafe: false,
          payload: {
            ...(typeof result.artifact.payload === "object" && result.artifact.payload !== null ? result.artifact.payload : {}),
            role: specialist,
            stopReason: "cost_cap_exceeded",
            meta: result.meta,
            cap: { roleCapUsd: perRoleCap, costUsd: result.meta.costUsd },
          },
        });

        recordWarning(specialist, "cost_cap_exceeded");

        // Track cost
        costs.push({
          specialist,
          inputTokens: result.meta.inputTokens,
          outputTokens: result.meta.outputTokens,
          costUsd: result.meta.costUsd,
          model: result.meta.model,
          latencyMs: result.meta.latencyMs,
          stopReason: "cost_cap_exceeded",
        });
        totalCostUsd += result.meta.costUsd;

        // fail_fast: stop immediately
        if (failureMode === "fail_fast") {
          // Deterministic failure collapse: customer-safe, no provider calls
          artifacts.push({
            kind: "swarm.collapse",
            customerSafe: true,
            payload: null,
          });

          return {
            version: "v1",
            status: "failed",
            stopReason: "cost_cap_exceeded",
            needsHuman: true,
            traceId: ctx.traceId,
            artifacts,
            customerSafe: true,
            extensions: {
              swarm: {
                costs,
                totalCostUsd,
                roleCostsUsd,
                roleModels,
                warnings: [
                  ...warnings,
                  makeFailureCollapseWarning(
                    "cost_cap_exceeded",
                    `Per-role cap exceeded (role=${specialist})`
                  ),
                ],
                failedSpecialist: specialist,
                failureReason: "cost_cap_exceeded",
              },
            },
          };
        }

        // continue_with_warnings: continue to next specialist
        continue;
      }

      // Normal artifact (no cap exceeded)
      // Force payload.stopReason to match specialist output stopReason
      const artifact = result.artifact;
      artifact.payload = {
        ...(artifact.payload ?? {}),
        stopReason: result.stopReason,
      };
      artifacts.push(artifact);

      // Track last artifacts for iteration feedback
      if (specialist === craftRole) {
        craftArtifactLast = artifact;
      } else if (specialist === criticRole) {
        criticArtifactLast = artifact;
      }

      // Track cost
      costs.push({
        specialist,
        inputTokens: result.meta.inputTokens,
        outputTokens: result.meta.outputTokens,
        costUsd: result.meta.costUsd,
        model: result.meta.model,
        latencyMs: result.meta.latencyMs,
        stopReason: result.stopReason,
      });
      totalCostUsd += result.meta.costUsd;
      
      // Track per-role cost and model (Gate 3)
      roleCostsUsd[specialist] = (roleCostsUsd[specialist] || 0) + result.meta.costUsd;
      roleModels[specialist] = result.meta.model;

      // Check total cap AFTER adding specialist cost
      if (typeof costCapsSafe.total === "number" && totalCostUsd > costCapsSafe.total) {
        recordWarning(undefined, "cost_cap_exceeded");

        // fail_fast: stop immediately
        if (failureMode === "fail_fast") {
          // Deterministic failure collapse: customer-safe, no provider calls
          artifacts.push({
            kind: "swarm.collapse",
            customerSafe: true,
            payload: null,
          });

          return {
            version: "v1",
            status: "failed",
            stopReason: "cost_cap_exceeded",
            needsHuman: true,
            traceId: ctx.traceId,
            artifacts,
            customerSafe: true,
            extensions: {
              swarm: {
                costs,
                totalCostUsd,
                roleCostsUsd,
                roleModels,
                warnings: [
                  ...warnings,
                  makeFailureCollapseWarning(
                    "cost_cap_exceeded",
                    `Total cap exceeded (totalCostUsd=${totalCostUsd})`
                  ),
                ],
                failureReason: "cost_cap_exceeded",
              },
            },
          };
        }

        // continue_with_warnings: stop making calls, proceed to collapse
        break;
      }

      // If specialist failed and failureMode is NOT continue_with_warnings, stop
      if (result.stopReason !== "ok" && failureMode !== "continue_with_warnings") {
        // Deterministic failure collapse: customer-safe, no provider calls
        artifacts.push({
          kind: "swarm.collapse",
          customerSafe: true,
          payload: null,
        });

        return {
          version: "v1",
          status: "failed",
          stopReason: "provider_failed",
          needsHuman: true,
          traceId: ctx.traceId,
          artifacts,
          customerSafe: true,
          extensions: {
            swarm: {
              costs,
              totalCostUsd,
              roleCostsUsd,
              roleModels,
              warnings: [
                ...warnings,
                makeFailureCollapseWarning(
                  "provider_failed",
                  `Specialist failed (role=${specialist})`
                ),
              ],
              failedSpecialist: specialist,
              failureReason: result.stopReason,
            },
          },
        };
      }

      // If specialist failed in continue_with_warnings mode, record warning
      if (result.stopReason !== "ok") {
        recordWarning(specialist, result.stopReason);
      }
    } catch (err) {
      // Unexpected error (should not happen with aimlSpecialist adapter)
      const errorMessage = err instanceof Error ? err.message : String(err);
      costs.push({
        specialist,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        model: roleConfig.model ?? "unknown",
        latencyMs: 0,
        stopReason: "provider_failed",
      });

      // If failureMode is continue_with_warnings, continue to next specialist
      if (failureMode === "continue_with_warnings") {
        artifacts.push({
          kind: `swarm.specialist.${specialist}`,
          payload: {
            ok: false,
            stopReason: "provider_failed",
            fingerprint: `${ctx.traceId}:${specialist}:unexpected_error`,
          },
          customerSafe: false,
        });
        recordWarning(specialist, "provider_failed");
        continue;
      }

      // fail_fast: stop immediately
      // Deterministic failure collapse: customer-safe, no provider calls
      artifacts.push({
        kind: "swarm.collapse",
        customerSafe: true,
        payload: null,
      });

      return {
        version: "v1",
        status: "failed",
        stopReason: "provider_failed",
        needsHuman: true,
        traceId: ctx.traceId,
        artifacts,
        customerSafe: true,
        extensions: {
          swarm: {
            costs,
            totalCostUsd,
            roleCostsUsd,
            roleModels,
            warnings: [
              ...warnings,
              makeFailureCollapseWarning("provider_failed", "Unexpected error in swarmRunner"),
            ],
            failedSpecialist: specialist,
            failureReason: "provider_failed",
          },
        },
      };
    }
    } // end specialist loop

    // Check iteration stop conditions after both craft + critic have run
    if (craftArtifactLast && criticArtifactLast) {
      const craftPayload = craftArtifactLast.payload as any;
      const criticPayload = criticArtifactLast.payload as any;
      
      const proposedChanges = getProposedChanges(craftPayload);
      const hasChanges = proposedChanges.length > 0;
      let pass = criticPayload?.pass === true;
      const high = hasHighIssues(criticPayload);

      // Guardrail: empty changes can never "pass"
      if (pass && !hasChanges) pass = false;

      // ✅ Stop if good (REVISE→APPLY lands here)
      if (pass && hasChanges && !high) {
        break;
      }
    }

    // Otherwise iterate again (unless last iter, then fall out)
  } // end iteration loop

  // Step 4: Field General "collapse" (deterministic synthesis)
  // Extract craft + critic artifacts to feed into collapse
  const craftArtifact = artifacts.find((a) => a.kind === "swarm.specialist.craft");
  const criticArtifact = artifacts.find((a) => a.kind === "swarm.specialist.critic");

  // If either specialist is missing, return needs_human collapse
  if (!craftArtifact || !criticArtifact) {
    artifacts.push({
      kind: "swarm.collapse",
      customerSafe: true,
      payload: null,
    });

    return {
      version: "v1",
      status: "succeeded",
      stopReason: "needs_human",
      needsHuman: true,
      traceId: ctx.traceId,
      artifacts,
      customerSafe: true,
      extensions: {
        swarm: {
          costs,
          totalCostUsd,
          roleCostsUsd,
          roleModels,
          warnings,
          reason: "Missing craft or critic artifact for collapse",
        },
      },
    };
  }

  // ARBITER GATE: Reject empty proposedChanges (belt + suspenders)
  // Even if critic passed, collapse will catch this, but we enforce it here too
  const craftPayload = craftArtifact.payload;
  const hasProposedChanges = 
    craftPayload && 
    typeof craftPayload === 'object' && 
    'proposedChanges' in craftPayload &&
    Array.isArray(craftPayload.proposedChanges) && 
    craftPayload.proposedChanges.length > 0;

  if (!hasProposedChanges) {
    artifacts.push({
      kind: "swarm.collapse",
      customerSafe: true,
      payload: null,
    });

    return {
      version: "v1",
      status: "succeeded",
      stopReason: "needs_human",
      needsHuman: true,
      traceId: ctx.traceId,
      artifacts,
      customerSafe: true,
      extensions: {
        swarm: {
          costs,
          totalCostUsd,
          roleCostsUsd,
          roleModels,
          warnings: [
            ...warnings,
            {
              kind: "swarm.empty_patch",
              message: "Craft proposed no changes (proposedChanges empty or missing)",
              detail: { craftPayload: typeof craftPayload },
            },
          ],
          reason: "Empty patch rejected by arbiter gate",
        },
      },
    };
  }

  // Extract stopReason from specialist costs (fallback to "ok" if not found)
  const craftCost = costs.find((c) => c.specialist === "craft");
  const criticCost = costs.find((c) => c.specialist === "critic");
  const craftStopReason = craftCost?.stopReason || "ok";
  const criticStopReason = criticCost?.stopReason || "ok";

  // Build deterministic collapse
  const collapse = buildDeterministicCollapse({
    craft: {
      stopReason: craftStopReason,
      payload: craftArtifact.payload,
    },
    critic: {
      stopReason: criticStopReason,
      payload: criticArtifact.payload,
    },
  });

  // Push collapse artifact (ONLY customerSafe artifact)
  artifacts.push({
    kind: "swarm.collapse",
    customerSafe: true,
    payload: collapse.payload, // null if needs_human
  });

  // Determine final status and needsHuman
  // Status is "succeeded" because swarm completed all steps (even if needs escalation)
  const finalStatus = "succeeded";
  const needsHuman = collapse.stopReason === "needs_human";

  return {
    version: "v1",
    status: finalStatus,
    stopReason: collapse.stopReason,
    needsHuman,
    traceId: ctx.traceId,
    artifacts,
    customerSafe: true,
    extensions: {
      swarm: {
        costs,
        totalCostUsd,
        roleCostsUsd,
        roleModels,
        warnings: hadWarnings ? warnings : undefined,
        ...(collapse.extensions || {}),
      },
    },
  };
}

/**
 * Helper: Create failure warning for collapse extensions
 */
function makeFailureCollapseWarning(kind: string, message: string) {
  return { kind, message };
}
