/**
 * Agent Orchestrator Service
 * Phase 2: Core Brain Loop - GPT-5.2 + agent-stack tool execution
 */

import { ENV } from "../_core/env.js";
import { createAgentRun, updateAgentRunStatus, appendAgentEvent, getAgentRun } from "../db/agentRuns.js";
import { getDb } from "../db.js";
import { agentRuns } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";

const AGENT_STACK_URL = process.env.AGENT_STACK_URL || "http://35.188.184.31:8080";
const AGENT_STACK_TOKEN = process.env.AGENT_STACK_TOKEN || "";
const AIML_API_KEY = ENV.aimlApiKey;
const AIML_BASE_URL = "https://api.aimlapi.com/v1";

interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface RunState {
  runId: number;
  goal: string;
  messages: Message[];
  toolSchemas: ToolSchema[];
  stepCount: number;
  errorCount: number;
  maxSteps: number;
  maxErrors: number;
}

/**
 * Fetch available tools from agent-stack router
 */
async function fetchToolSchemas(): Promise<ToolSchema[]> {
  const response = await fetch(`${AGENT_STACK_URL}/tools`, {
    headers: {
      "X-Router-Token": AGENT_STACK_TOKEN,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tools: ${response.statusText}`);
  }

  const tools = await response.json();
  return tools;
}

/**
 * Classify tool into risk tier
 * Tier 0: auto (no approval)
 * Tier 1: auto+logged (no approval, but logged)
 * Tier 2: approval required
 * Tier 3: double approval (not implemented yet)
 */
function classifyToolTier(toolName: string): number {
  // Tier 0: Safe local operations
  const tier0 = [
    "workspace_read",
    "workspace_list",
    "workspace_write",
    "repo_commit",
    "repo_open_pr",
    "browser_screenshot",
    "browser_extract_text",
  ];

  // Tier 1: Logged but auto-approved
  const tier1 = [
    "sandbox_run",
    "browser_goto",
  ];

  // Tier 2: Requires approval
  const tier2 = [
    "browser_type",
    "browser_click",
    "browser_login",
  ];

  // Tier 3: Double approval (treat as tier 2 for now)
  const tier3 = [
    "deploy",
    "dns_update",
    "payment",
  ];

  if (tier0.includes(toolName)) return 0;
  if (tier1.includes(toolName)) return 1;
  if (tier2.includes(toolName)) return 2;
  if (tier3.includes(toolName)) return 3;

  // Default: require approval for unknown tools
  return 2;
}

/**
 * Execute a tool via agent-stack router
 */
async function executeTool(name: string, args: Record<string, unknown>): Promise<{
  success: boolean;
  result?: unknown;
  error?: string;
  approval_required?: boolean;
}> {
  try {
    const response = await fetch(`${AGENT_STACK_URL}/tool`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Router-Token": AGENT_STACK_TOKEN,
      },
      body: JSON.stringify({ name, arguments: args }),
    });

    const result = await response.json();

    if (result.approval_required) {
      return { success: false, approval_required: true, result };
    }

    if (!response.ok) {
      return { success: false, error: result.error || response.statusText };
    }

    return { success: true, result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Call GPT-5.2 via AIML API with function calling
 */
async function callModel(
  messages: Message[],
  tools: ToolSchema[]
): Promise<{
  role: "assistant";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}> {
  const response = await fetch(`${AIML_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AIML_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      messages,
      tools: tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    throw new Error(`Model call failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message;
}

/**
 * Main orchestrator loop
 */
export async function runOrchestrator(config: {
  userId: number;
  goal: string;
  maxSteps?: number;
  maxErrors?: number;
}): Promise<{ runId: number; status: string }> {
  const { userId, goal, maxSteps = 20, maxErrors = 3 } = config;

  // Create run record
  const run = await createAgentRun({
    createdBy: userId,
    goal,
    model: "gpt-5.2",
    routerUrl: AGENT_STACK_URL,
    workspaceName: `workspace-${userId}-${Date.now()}`,
  });

  const runId = run.id;

  // Log initial message
  await appendAgentEvent(runId, "message", {
    role: "user",
    content: goal,
  });

  try {
    // Fetch tool schemas
    const toolSchemas = await fetchToolSchemas();

    // Initialize state
    const state: RunState = {
      runId,
      goal,
      messages: [
        {
          role: "system",
          content:
            "You are an autonomous execution agent. Use tools to accomplish the user's goal. Keep going until the goal is done. When finished, respond with a summary and do not call any more tools.",
        },
        {
          role: "user",
          content: goal,
        },
      ],
      toolSchemas,
      stepCount: 0,
      errorCount: 0,
      maxSteps,
      maxErrors,
    };

    // Main loop
    while (state.stepCount < state.maxSteps && state.errorCount < state.maxErrors) {
      state.stepCount++;

      // Call model
      const modelResponse = await callModel(state.messages, state.toolSchemas);

      // Add assistant message
      state.messages.push({
        role: modelResponse.role,
        content: modelResponse.content || "",
        tool_calls: modelResponse.tool_calls,
      });

      await appendAgentEvent(runId, "message", {
        role: "assistant",
        content: modelResponse.content,
        tool_calls: modelResponse.tool_calls,
      });

      // Check if model wants to call tools
      if (!modelResponse.tool_calls || modelResponse.tool_calls.length === 0) {
        // No tool calls - agent is done
        await updateAgentRunStatus(runId, "success");
        return { runId, status: "success" };
      }

      // Execute tool calls
      for (const toolCall of modelResponse.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Classify tool tier
        const tier = classifyToolTier(toolName);

        // Log tool call
        await appendAgentEvent(runId, "tool_call", {
          tool_call_id: toolCall.id,
          name: toolName,
          arguments: toolArgs,
          tier,
        });

        // Check if approval required (Tier 2+)
        if (tier >= 2) {
          const approvalId = `approval_${runId}_${Date.now()}`;
          
          await appendAgentEvent(runId, "approval_request", {
            approval_id: approvalId,
            tool_call_id: toolCall.id,
            name: toolName,
            arguments: toolArgs,
            tier,
            reason: tier === 3 ? "High-risk operation (Tier 3)" : "Approval required (Tier 2)",
          });

          // Persist state for resume
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          await db.update(agentRuns)
            .set({
              status: "awaiting_approval",
              stateJson: {
                messages: state.messages,
                stepCount: state.stepCount,
                errorCount: state.errorCount,
                maxSteps: state.maxSteps,
                maxErrors: state.maxErrors,
              },
              pendingActionJson: {
                approvalId,
                toolName,
                toolArgs,
                toolCallId: toolCall.id,
                requestedAt: new Date().toISOString(),
                riskTier: tier,
              },
            })
            .where(eq(agentRuns.id, runId));

          return { runId, status: "awaiting_approval" };
        }

        // Execute tool
        const toolResult = await executeTool(toolName, toolArgs);

        // Check for approval required
        if (toolResult.approval_required) {
          await appendAgentEvent(runId, "approval_request", {
            tool_call_id: toolCall.id,
            name: toolName,
            arguments: toolArgs,
            preview: toolResult.result,
          });

          await updateAgentRunStatus(runId, "awaiting_approval");
          return { runId, status: "awaiting_approval" };
        }

        // Log tool result
        await appendAgentEvent(runId, "tool_result", {
          tool_call_id: toolCall.id,
          success: toolResult.success,
          result: toolResult.result,
          error: toolResult.error,
        });

        // Handle errors
        if (!toolResult.success) {
          state.errorCount++;
          if (state.errorCount >= state.maxErrors) {
            await updateAgentRunStatus(runId, "failed", `Too many errors: ${toolResult.error}`);
            return { runId, status: "failed" };
          }
        }

        // Add tool result to messages
        state.messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error }),
        });
      }
    }

    // Max steps reached
    await updateAgentRunStatus(runId, "failed", "Max steps reached");
    return { runId, status: "failed" };
  } catch (error) {
    await appendAgentEvent(runId, "error", {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    await updateAgentRunStatus(runId, "failed", String(error));
    return { runId, status: "failed" };
  }
}

/**
 * Continue orchestrator loop with restored state
 */
async function continueOrchestrator(
  runId: number,
  restoredState: {
    messages: Message[];
    stepCount: number;
    errorCount: number;
    maxSteps: number;
    maxErrors: number;
  }
): Promise<void> {
  // Fetch tool schemas
  const toolSchemas = await fetchToolSchemas();

  const state: RunState = {
    runId,
    goal: "", // Not needed for continuation
    messages: restoredState.messages,
    toolSchemas,
    stepCount: restoredState.stepCount,
    errorCount: restoredState.errorCount,
    maxSteps: restoredState.maxSteps,
    maxErrors: restoredState.maxErrors,
  };

  // Continue main loop
  while (state.stepCount < state.maxSteps && state.errorCount < state.maxErrors) {
    state.stepCount++;

    // Call model
    const modelResponse = await callModel(state.messages, state.toolSchemas);

    // Add assistant message
    state.messages.push({
      role: modelResponse.role,
      content: modelResponse.content || "",
      tool_calls: modelResponse.tool_calls,
    });

    await appendAgentEvent(runId, "message", {
      role: "assistant",
      content: modelResponse.content,
      tool_calls: modelResponse.tool_calls,
    });

    // Check if model wants to call tools
    if (!modelResponse.tool_calls || modelResponse.tool_calls.length === 0) {
      // No tool calls - agent is done
      await updateAgentRunStatus(runId, "success");
      return;
    }

    // Execute tool calls
    for (const toolCall of modelResponse.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      // Classify tool tier
      const tier = classifyToolTier(toolName);

      // Log tool call
      await appendAgentEvent(runId, "tool_call", {
        tool_call_id: toolCall.id,
        name: toolName,
        arguments: toolArgs,
        tier,
      });

      // Check if approval required (Tier 2+)
      if (tier >= 2) {
        const approvalId = `approval_${runId}_${Date.now()}`;
        
        await appendAgentEvent(runId, "approval_request", {
          approval_id: approvalId,
          tool_call_id: toolCall.id,
          name: toolName,
          arguments: toolArgs,
          tier,
          reason: tier === 3 ? "High-risk operation (Tier 3)" : "Approval required (Tier 2)",
        });

        // Persist state for resume
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(agentRuns)
          .set({
            status: "awaiting_approval",
            stateJson: {
              messages: state.messages,
              stepCount: state.stepCount,
              errorCount: state.errorCount,
              maxSteps: state.maxSteps,
              maxErrors: state.maxErrors,
            },
            pendingActionJson: {
              approvalId,
              toolName,
              toolArgs,
              toolCallId: toolCall.id,
              requestedAt: new Date().toISOString(),
              riskTier: tier,
            },
          })
          .where(eq(agentRuns.id, runId));

        return; // Stop and wait for approval
      }

      // Execute tool
      const toolResult = await executeTool(toolName, toolArgs);

      // Check for approval required from router
      if (toolResult.approval_required) {
        await appendAgentEvent(runId, "approval_request", {
          tool_call_id: toolCall.id,
          name: toolName,
          arguments: toolArgs,
          preview: toolResult.result,
        });

        await updateAgentRunStatus(runId, "awaiting_approval");
        return;
      }

      // Log tool result
      await appendAgentEvent(runId, "tool_result", {
        tool_call_id: toolCall.id,
        success: toolResult.success,
        result: toolResult.result,
        error: toolResult.error,
      });

      // Handle errors
      if (!toolResult.success) {
        state.errorCount++;
        if (state.errorCount >= state.maxErrors) {
          await updateAgentRunStatus(runId, "failed", `Too many errors: ${toolResult.error}`);
          return;
        }
      }

      // Add tool result to messages
      state.messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error }),
      });
    }
  }

  // Max steps reached
  await updateAgentRunStatus(runId, "failed", "Max steps reached");
}

/**
 * Resume a run after approval
 */
export async function resumeAfterApproval(runId: number, approved: boolean): Promise<{ status: string }> {
  const run = await getAgentRun(runId);
  if (!run) {
    throw new Error("Run not found");
  }

  if (run.status !== "awaiting_approval") {
    throw new Error("Run is not awaiting approval");
  }

  if (!run.pendingActionJson) {
    throw new Error("No pending action found");
  }

  // Log approval result
  await appendAgentEvent(runId, "approval_result", {
    approved,
    timestamp: new Date().toISOString(),
  });

  if (!approved) {
    // Clear pending action and mark as failed
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.update(agentRuns)
      .set({
        status: "failed",
        errorMessage: "User denied approval",
        pendingActionJson: null,
        finishedAt: new Date(),
      })
      .where(eq(agentRuns.id, runId));
    
    return { status: "failed" };
  }

  // APPROVED - Execute pending tool and continue
  const { toolName, toolArgs, toolCallId } = run.pendingActionJson;

  // Log tool call
  await appendAgentEvent(runId, "tool_call", {
    tool_call_id: toolCallId,
    name: toolName,
    arguments: toolArgs,
  });

  // Execute the tool
  const toolResult = await executeTool(toolName, toolArgs);

  // Log tool result
  await appendAgentEvent(runId, "tool_result", {
    tool_call_id: toolCallId,
    success: toolResult.success,
    result: toolResult.result,
    error: toolResult.error,
  });

  if (!run.stateJson) {
    throw new Error("No state found to resume");
  }

  // Append tool result to messages
  run.stateJson.messages.push({
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error }),
  });

  // Clear pending action and update state
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(agentRuns)
    .set({
      status: "running",
      pendingActionJson: null,
      stateJson: run.stateJson,
      approvedAt: new Date(),
    })
    .where(eq(agentRuns.id, runId));

  // Continue orchestrator loop
  try {
    await continueOrchestrator(runId, run.stateJson);
    return { status: "success" };
  } catch (error) {
    await appendAgentEvent(runId, "error", {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await updateAgentRunStatus(runId, "failed", String(error));
    return { status: "failed" };
  }
}
