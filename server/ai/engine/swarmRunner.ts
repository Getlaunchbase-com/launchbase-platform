/**
 * swarmRunner.ts — Swarm Orchestration (Field General + Specialists)
 * 
 * Phase 2.3 Gate 1: Skeleton only (memory/log transport)
 * 
 * Orchestrates multi-AI collaboration:
 * 1. Field General "plan"
 * 2. Specialist: craft
 * 3. Specialist: critic
 * 4. Field General "collapse"
 * 
 * All non-CORE experimental fields live under extensions.
 */

import type { AiWorkOrderV1, AiWorkResultV1, ArtifactV1 } from "./types";
import type { PolicyV1 } from "./policy/policyTypes";

/**
 * Swarm execution context (minimal for Gate 1)
 */
export interface SwarmContextV1 {
  traceId: string;
  tenant: string;
  scope: string;
}

/**
 * Run swarm orchestration (Field General + specialists)
 * 
 * Phase 2.3 Gate 1: Memory/log transport only (no AIML spend)
 * 
 * @param workOrder - The AI work order
 * @param policy - Resolved policy (must have swarm.enabled = true)
 * @param ctx - Execution context
 * @returns AiWorkResultV1 with 4 artifacts (plan, craft, critic, collapse)
 */
export async function runSwarmV1(
  workOrder: AiWorkOrderV1,
  policy: PolicyV1,
  ctx: SwarmContextV1
): Promise<AiWorkResultV1> {
  const artifacts: ArtifactV1[] = [];

  // Verify swarm is enabled in policy
  if (!policy.swarm?.enabled) {
    return {
      version: "v1",
      status: "failed",
      stopReason: "invalid_request",
      needsHuman: false,
      traceId: ctx.traceId,
      artifacts: [],
      customerSafe: true,
    };
  }

  // Extract swarm config from policy
  const specialists = policy.swarm.specialists || ["craft", "critic"];
  const maxSwirlRounds = policy.swarm.maxSwirlRounds || 1;
  const collapseStrategy = policy.swarm.collapseStrategy || "field_general";

  try {
    // Step 1: Field General "plan"
    const planArtifact = await runFieldGeneralPlan(workOrder, policy, ctx);
    artifacts.push(planArtifact);

    // Step 2: Specialist responses (craft + critic)
    for (const specialist of specialists) {
      const specialistArtifact = await runSpecialist(specialist, workOrder, policy, ctx, planArtifact);
      artifacts.push(specialistArtifact);
    }

    // Step 3: Field General "collapse"
    const collapseArtifact = await runFieldGeneralCollapse(workOrder, policy, ctx, artifacts);
    artifacts.push(collapseArtifact);

    // Success: swarm completed
    return {
      version: "v1",
      status: "succeeded",
      stopReason: "ok",
      needsHuman: false,
      traceId: ctx.traceId,
      artifacts,
      customerSafe: true,
    };
  } catch (err) {
    // Provider failure or other error
    return {
      version: "v1",
      status: "failed",
      stopReason: "provider_failed",
      needsHuman: true,
      traceId: ctx.traceId,
      artifacts, // Return artifacts created so far
      customerSafe: true,
    };
  }
}

/**
 * Field General "plan" step
 * 
 * Gate 1: Memory transport returns mock plan
 */
async function runFieldGeneralPlan(
  workOrder: AiWorkOrderV1,
  policy: PolicyV1,
  ctx: SwarmContextV1
): Promise<ArtifactV1> {
  // Gate 1: Mock plan (no real model call)
  const mockPlan = {
    task: workOrder.scope,
    specialists: policy.swarm?.specialists || ["craft", "critic"],
    constraints: workOrder.constraints,
    strategy: "Generate proposals from specialists, critique, then collapse to final decision",
  };

  return {
    kind: "swarm.plan",
    payload: mockPlan,
    customerSafe: false, // Internal only
  };
}

/**
 * Specialist response step
 * 
 * Gate 1: Memory transport returns mock proposal/critique
 */
async function runSpecialist(
  specialist: string,
  workOrder: AiWorkOrderV1,
  policy: PolicyV1,
  ctx: SwarmContextV1,
  planArtifact: ArtifactV1
): Promise<ArtifactV1> {
  // Gate 1: Mock specialist response (no real model call)
  const mockResponse = {
    specialist,
    task: workOrder.scope,
    response: specialist === "craft" 
      ? "Mock crafted proposal based on inputs"
      : "Mock critique of crafted proposal",
    confidence: 0.85,
  };

  return {
    kind: `swarm.specialist.${specialist}`,
    payload: mockResponse,
    customerSafe: false, // Internal only
  };
}

/**
 * Field General "collapse" step
 * 
 * Gate 1: Memory transport returns mock decision
 * 
 * RULE: This is the ONLY customerSafe=true artifact
 */
async function runFieldGeneralCollapse(
  workOrder: AiWorkOrderV1,
  policy: PolicyV1,
  ctx: SwarmContextV1,
  artifacts: ArtifactV1[]
): Promise<ArtifactV1> {
  // Gate 1: Mock collapse decision (no real model call)
  const mockDecision = {
    decision: "approved",
    rationale: "Mock rationale: Proposal meets requirements after critique review",
    confidence: 0.9,
    finalProposal: {
      summary: "Mock final proposal summary",
      key: "mock_key",
      value: "mock_value",
    },
  };

  return {
    kind: "swarm.collapse",
    payload: mockDecision,
    customerSafe: true, // ONLY customerSafe artifact
  };
}
