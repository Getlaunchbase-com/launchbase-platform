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

import type { AiWorkOrderV1, AiWorkResultV1, ArtifactV1, StopReasonV1 } from "./types";
import type { PolicyV1 } from "./policy/policyTypes";
import { callSpecialistAIML, callSpecialistWithRetry } from "./specialists";
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
  ctx: { traceId: string }
): Promise<AiWorkResultV1> {
  console.log("[SWARM_DEBUG] runner=swarmRunner.ts", "fn=runSwarmV1", "build=", process.env.NODE_ENV);
  const artifacts: ArtifactV1[] = [];
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

  // Step 1: Field General "plan"
  const planArtifact: ArtifactV1 = {
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

  // Step 2-3: Run specialists (craft, critic) - skip field_general
  // Collect craft artifacts to pass to critic
  const craftArtifacts: any[] = [];
  
  for (const specialist of specialists) {
    const roleConfig = roles[specialist];
    if (!roleConfig) continue;
    // Check total cap BEFORE calling next specialist
    if (typeof costCapsUsd.total === "number" && totalCostUsd > costCapsUsd.total) {
      recordWarning(undefined, "cost_cap_exceeded");
      // Stop making calls, proceed to collapse
      break;
    }

    try {
      // Build specialist input: critics receive prior craft artifacts
      const specialistInput: any = {
        plan: planArtifact.payload,
        context: workOrder.inputs,
      };
      
      // If this is a critic role, inject all prior craft artifacts
      if (specialist.includes("critic")) {
        specialistInput.craftArtifacts = craftArtifacts;
        console.log("[SWARM_DEBUG] critic_input_stats", {
          craftArtifactsCount: craftArtifacts.length,
          craftArtifactsBytes: JSON.stringify(craftArtifacts).length,
        });
      }
      
      // Use retry wrapper with ladder disabled by default (enable via policy flag)
      const enableLadder = policy.swarm?.enableRetryLadder ?? false;
      const result = await callSpecialistWithRetry({
        role: specialist as "craft" | "critic",
        trace: {
          jobId: ctx.traceId,
          step: `swarm.specialist.${specialist}`,
        },
        input: specialistInput,
        roleConfig,
      });

      // Inject stopReason into payload (single source of truth)
      result.artifact.payload = {
        ...(result.artifact.payload ?? {}),
        role: specialist,
        stopReason: result.stopReason,
      };

      // Check per-role cap AFTER specialist call
      const perRoleCap = costCapsUsd.perRole?.[specialist];
      const roleCapExceeded = typeof perRoleCap === "number" && result.meta.costUsd > perRoleCap;

      if (roleCapExceeded) {
        // Rewrite artifact to reflect cap failure
        artifacts.push({
          kind: `swarm.specialist.${specialist}`,
          customerSafe: false,
          payload: {
            ...result.artifact.payload,
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
      
      // If this is a craft/designer role, collect for critic
      // Collect if payload exists and has usable data (proposedChanges), even if timeout/provider_failed
      // This allows critic to work with partial successes
      if (!specialist.includes("critic") && artifact.payload) {
        // Check if payload has proposedChanges (craft output)
        const hasUsableOutput = artifact.payload.proposedChanges && Array.isArray(artifact.payload.proposedChanges) && artifact.payload.proposedChanges.length > 0;
        if (hasUsableOutput) {
          craftArtifacts.push({
            role: specialist,
            output: artifact.payload,
          });
          console.log("[SWARM_DEBUG] collected_craft_artifact", specialist, {
            stopReason: result.stopReason,
            changesCount: artifact.payload.proposedChanges.length,
          });
        }
      }
      
      console.log("[SWARM_DEBUG] specialist_done", specialist, {
        stopReason: result.stopReason,
        hasPayload: !!artifact.payload,
        payloadKeys: artifact.payload ? Object.keys(artifact.payload) : [],
        collected: !specialist.includes("critic") && artifact.payload && result.stopReason === "ok",
      });

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
      if (typeof costCapsUsd.total === "number" && totalCostUsd > costCapsUsd.total) {
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
        model: roleConfig.model,
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
  }

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
