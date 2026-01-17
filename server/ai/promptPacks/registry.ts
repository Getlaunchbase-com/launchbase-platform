/**
 * PromptPack Registry
 * 
 * Versioned, task-keyed prompt packs with schema enforcement and cost caps.
 * This is the "secret sauce lockbox" - prompts are versioned assets with guardrails.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
import type { AiContractType } from "../validateAiOutput";

// ============================================
// TYPES
// ============================================

export type TaskType =
  | "intent_parse"
  | "generate_candidates"
  | "critique"
  | "decision_collapse";

export type SystemRole = "field_general" | "critic" | "implementer";

export interface PromptPack {
  version: string;
  taskType: TaskType;
  systemRole: SystemRole;
  systemPrompt: string;
  taskPrompt: string;
  outputSchemaName: AiContractType;
  maxRounds: number;
  costCapUsd: number;
}

// ============================================
// PROMPT LOADER
// ============================================

// In production (bundled), prompts are copied to dist/v1/
// In development, they're in server/ai/promptPacks/v1/
const PROMPT_DIR = process.env.NODE_ENV === "production" 
  ? join(process.cwd(), "dist", "v1")
  : join(__dir, "v1");

function loadPrompt(filename: string): string {
  const path = join(PROMPT_DIR, filename);
  return readFileSync(path, "utf-8").trim();
}

// ============================================
// REGISTRY (v1)
// ============================================

const PROMPT_PACKS_V1: Record<TaskType, PromptPack> = {
  intent_parse: {
    version: "v1",
    taskType: "intent_parse",
    systemRole: "field_general",
    systemPrompt: loadPrompt("system_field_general.md"),
    taskPrompt: loadPrompt("task_intent_parse.md"),
    outputSchemaName: "intent_parse",
    maxRounds: 2,
    costCapUsd: 10,
  },

  generate_candidates: {
    version: "v1",
    taskType: "generate_candidates",
    systemRole: "field_general",
    systemPrompt: loadPrompt("system_field_general.md"),
    taskPrompt: loadPrompt("task_generate_candidates.md"),
    outputSchemaName: "copy_proposal", // or design_tokens, determined by caller
    maxRounds: 2,
    costCapUsd: 10,
  },

  critique: {
    version: "v1",
    taskType: "critique",
    systemRole: "critic",
    systemPrompt: loadPrompt("system_critic.md"),
    taskPrompt: loadPrompt("task_critique.md"),
    outputSchemaName: "critique",
    maxRounds: 2,
    costCapUsd: 10,
  },

  decision_collapse: {
    version: "v1",
    taskType: "decision_collapse",
    systemRole: "implementer",
    systemPrompt: loadPrompt("system_implementer.md"),
    taskPrompt: loadPrompt("task_decision_collapse.md"),
    outputSchemaName: "decision_collapse",
    maxRounds: 2,
    costCapUsd: 10,
  },
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Get a prompt pack by task type
 * 
 * @param taskType - Task type (intent_parse, generate_candidates, etc.)
 * @param version - Version (default: "v1")
 * @returns PromptPack
 */
export function getPromptPack(
  taskType: TaskType,
  version: string = "v1"
): PromptPack {
  if (version !== "v1") {
    throw new Error(`Unsupported prompt pack version: ${version}`);
  }

  const pack = PROMPT_PACKS_V1[taskType];
  if (!pack) {
    throw new Error(`Unknown task type: ${taskType}`);
  }

  return pack;
}

/**
 * Interpolate variables into a prompt template
 * 
 * @param template - Prompt template with {{VARIABLE}} placeholders
 * @param variables - Key-value pairs to interpolate
 * @returns Interpolated prompt
 * 
 * @example
 * const prompt = interpolatePrompt(
 *   "User said: {{USER_TEXT}}",
 *   { USER_TEXT: "Make the headline shorter" }
 * );
 * // => "User said: Make the headline shorter"
 */
export function interpolatePrompt(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, "g"), value);
  }

  return result;
}

/**
 * Get all available task types
 */
export function getAvailableTaskTypes(): TaskType[] {
  return Object.keys(PROMPT_PACKS_V1) as TaskType[];
}

/**
 * Get all available system roles
 */
export function getAvailableSystemRoles(): SystemRole[] {
  return ["field_general", "critic", "implementer"];
}
