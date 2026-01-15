import { z } from "zod";

/**
 * Critic Specialist Output Schema
 *
 * The Critic specialist reviews Craft's proposed changes and provides
 * structured critique with specific issues and suggested fixes.
 *
 * Non-negotiables:
 * - Must return pass/fail verdict
 * - Issues must be specific and actionable
 * - Suggested fixes must map to targetKeys
 * - RequiresApproval flags changes that need human review
 */

export const CriticIssueSchema = z.object({
  /**
   * Severity of the issue
   * - critical: Blocks implementation (factual errors, legal issues)
   * - major: Should be fixed before implementation (weak claims, unclear messaging)
   * - minor: Nice to have (style preferences, minor improvements)
   */
  severity: z.enum(["critical", "major", "minor"]),

  /**
   * What's wrong with the proposed change
   * Must be specific and reference the actual content
   */
  description: z.string().min(1),

  /**
   * Where the issue is located
   * Should reference targetKey from Craft's proposedChanges
   * MUST match pattern: ^(design|brand)\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$
   */
  location: z.string().regex(/^(design|brand)\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/, "location must match targetKey taxonomy"),

  /**
   * Optional: Why this is an issue
   * Helps explain the reasoning behind the critique
   */
  rationale: z.string().optional(),
});

export const CriticSuggestedFixSchema = z.object({
  /**
   * Maps to the targetKey from Craft's proposedChanges
   * MUST match pattern: ^(design|brand)\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$
   */
  targetKey: z.string().regex(/^(design|brand)\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/, "targetKey must match taxonomy"),

  /**
   * The suggested fix or alternative
   * Must be concrete and ready to implement
   */
  fix: z.string().min(1),

  /**
   * Why this fix is better
   */
  rationale: z.string().min(1),
});

export const CriticOutputSchema = z.object({
  /**
   * Overall verdict: do the proposed changes pass review?
   * - true: Changes are acceptable (may have minor issues)
   * - false: Changes have critical/major issues that must be addressed
   */
  pass: z.boolean(),

  /**
   * List of issues found during review
   * MUST contain between 10 and 16 issues (enforced)
   */
  issues: z.array(CriticIssueSchema).min(10).max(16),

  /**
   * Suggested fixes for the issues
   * Each fix should map to a specific targetKey
   * MUST contain between 10 and 16 fixes (enforced)
   */
  suggestedFixes: z.array(CriticSuggestedFixSchema).min(10).max(16),

  /**
   * Does this change set require human approval before implementation?
   * - true: Human review required (legal claims, brand changes, etc.)
   * - false: Can proceed with automated implementation
   */
  requiresApproval: z.boolean(),

  /**
   * Optional: Is a preview recommended before going live?
   * Helps determine if customer should see mockup first
   */
  previewRecommended: z.boolean().optional(),

  /**
   * Optional risks identified during critique
   * MUST be an array of strings. Do not use objects.
   */
  risks: z.array(z.string()).optional(),

  /**
   * Optional assumptions made during critique
   */
  assumptions: z.array(z.string()).optional(),
});

export type CriticIssue = z.infer<typeof CriticIssueSchema>;
export type CriticSuggestedFix = z.infer<typeof CriticSuggestedFixSchema>;
export type CriticOutput = z.infer<typeof CriticOutputSchema>;
