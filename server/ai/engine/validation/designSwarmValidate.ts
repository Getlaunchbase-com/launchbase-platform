import { z } from "zod";
import {
  CraftOutputSchemaFast,
  CraftProposedChangeSchema,
} from "../specialists/schemas/craft.schema";
import {
  CriticOutputSchema,
  CriticIssueSchema,
  CriticSuggestedFixSchema,
} from "../specialists/schemas/critic.schema";

/**
 * Ruthless Critic Schema: EXACTLY 10 issues + 10 fixes, pass=false
 * Used for design_critic_ruthless role in tournaments
 */
export const CriticOutputSchemaRuthlessStrict = z.object({
  /**
   * Overall verdict: MUST be false for ruthless mode
   */
  pass: z.literal(false),

  /**
   * List of issues found during review
   * MUST contain EXACTLY 10 issues (ruthless mode)
   */
  issues: z.array(CriticIssueSchema).length(10),

  /**
   * Suggested fixes for the issues
   * MUST contain EXACTLY 10 fixes (ruthless mode)
   */
  suggestedFixes: z.array(CriticSuggestedFixSchema).length(10),

  /**
   * Does this change set require human approval before implementation?
   * REQUIRED boolean field
   */
  requiresApproval: z.boolean(),

  /**
   * Is a preview recommended before going live?
   * REQUIRED boolean field
   */
  previewRecommended: z.boolean(),

  /**
   * Optional risks identified during critique
   */
  risks: z.array(z.string()).optional(),

  /**
   * Optional assumptions made during critique
   */
  assumptions: z.array(z.string()).optional(),
});

export type DesignSwarmSchemaKey =
  | "designer_systems_fast"
  | "designer_brand_fast"
  | "design_critic_ruthless";

/**
 * Validate Design Swarm payload using Zod schemas
 * Throws with stopReason: "schema_failed" if validation fails
 */
export function validateDesignSwarmPayloadOrThrow(
  schemaKey: DesignSwarmSchemaKey,
  payload: unknown
) {
  const schema =
    schemaKey === "design_critic_ruthless"
      ? CriticOutputSchemaRuthlessStrict
      : CraftOutputSchemaFast;

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues?.[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "schema_failed";
    
    throw Object.assign(
      new Error(`[SCHEMA] ${schemaKey} validation failed: ${msg}`),
      {
        stopReason: "schema_failed",
        zodIssues: parsed.error.issues,
        schemaKey,
      }
    );
  }
  return parsed.data;
}

export type CraftOutputFast = z.infer<typeof CraftOutputSchemaFast>;
export type CriticOutputRuthless = z.infer<typeof CriticOutputSchemaRuthlessStrict>;
