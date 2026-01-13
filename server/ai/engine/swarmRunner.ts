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
import { callSpecialistAIML } from "./specialists";

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
      const result = await callSpecialistAIML({
        role: specialist as "craft" | "critic",
        trace: {
          jobId: ctx.traceId,
          step: `swarm.specialist.${specialist}`,
        },
        input: {
          plan: planArtifact.payload,
          context: workOrder.inputs,
        },
        roleConfig,
      });

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
          const collapseArtifact = await runFieldGeneralCollapse(
            workOrder,
            policy,
            ctx,
            artifacts,
            costs,
            totalCostUsd,
            "cost_cap_exceeded"
          );
          artifacts.push(collapseArtifact);

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
                warnings,
                failedSpecialist: specialist,
                reason: `Per-role cost cap (${perRoleCap} USD) exceeded for ${specialist}`,
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
          const collapseArtifact = await runFieldGeneralCollapse(
            workOrder,
            policy,
            ctx,
            artifacts,
            costs,
            totalCostUsd,
            "cost_cap_exceeded"
          );
          artifacts.push(collapseArtifact);

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
                warnings,
                reason: `Total cost cap (${costCapsUsd.total} USD) exceeded after ${specialist} specialist`,
              },
            },
          };
        }

        // continue_with_warnings: stop making calls, proceed to collapse
        break;
      }

      // If specialist failed and failureMode is NOT continue_with_warnings, stop
      if (result.stopReason !== "ok" && failureMode !== "continue_with_warnings") {
        const collapseArtifact = await runFieldGeneralCollapse(
          workOrder,
          policy,
          ctx,
          artifacts,
          costs,
          totalCostUsd,
          "provider_failed"
        );
        artifacts.push(collapseArtifact);

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
      const collapseArtifact = await runFieldGeneralCollapse(
        workOrder,
        policy,
        ctx,
        artifacts,
        costs,
        totalCostUsd,
        "provider_failed"
      );
      artifacts.push(collapseArtifact);

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
            failedSpecialist: specialist,
            error: errorMessage,
          },
        },
      };
    }
  }

  // Step 4: Field General "collapse"
  // Use "ok" for success, warnings tracked in extensions
  const finalStopReason: StopReasonV1 = "ok";
  const collapseArtifact = await runFieldGeneralCollapse(
    workOrder,
    policy,
    ctx,
    artifacts,
    costs,
    totalCostUsd,
    finalStopReason
  );
  artifacts.push(collapseArtifact);

  return {
    version: "v1",
    status: "succeeded",
    stopReason: finalStopReason,
    needsHuman: false,
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
      },
    },
  };
}

/**
 * Field General collapse step (deterministic)
 * 
 * @param workOrder - AI work order
 * @param policy - Resolved policy
 * @param ctx - Execution context
 * @param artifacts - Artifacts so far
 * @param costs - Cost breakdown
 * @param totalCostUsd - Total cost
 * @param stopReason - Final stop reason
 * @returns Collapse artifact (customerSafe=true)
 */
async function runFieldGeneralCollapse(
  workOrder: AiWorkOrderV1,
  policy: PolicyV1,
  ctx: { traceId: string },
  artifacts: ArtifactV1[],
  costs: Array<{
    specialist: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    model: string;
    latencyMs: number;
    stopReason: string;
  }>,
  totalCostUsd: number,
  stopReason: StopReasonV1
): Promise<ArtifactV1> {
  // Deterministic collapse logic (Gate 1: simple summary)
  return {
    kind: "swarm.collapse",
    payload: {
      summary: `Swarm completed with ${artifacts.length} artifacts`,
      totalCostUsd,
      specialists: costs.map((c) => c.specialist),
      stopReason,
      fingerprint: `${ctx.traceId}:collapse`,
    },
    customerSafe: true,
  };
}
