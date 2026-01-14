import { z } from "zod";

/**
 * Craft Specialist Output Schema
 *
 * The Craft specialist proposes concrete, implementable copy/design changes
 * for a website based on business context and goals.
 *
 * Non-negotiables:
 * - All changes must be actionable and specific
 * - targetKey maps to page sections (hero.headline, cta.primary, etc.)
 * - Confidence scores help prioritize changes
 * - Risks flag potential issues for human review
 */

export const CraftProposedChangeSchema = z.object({
  /**
   * Maps to a specific page section or element
   * MUST match pattern: ^(design|brand)\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$
   * Examples: "design.layout.hero", "brand.tokens.color.primary", "design.conversion.stickyCta"
   */
  targetKey: z.string().regex(/^(design|brand)\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/, "targetKey must start with 'design.' or 'brand.' and follow taxonomy"),

  /**
   * The actual copy or content to use
   * Must be concrete and ready to implement
   */
  value: z.string().min(1),

  /**
   * Why this change improves the page
   * Should reference business goals, conversion principles, or user needs
   */
  rationale: z.string().min(1),

  /**
   * Confidence in this change (0.0 to 1.0)
   * Higher confidence = less likely to need human review
   */
  confidence: z.number().min(0).max(1),

  /**
   * Optional risks or concerns about this change
   * Examples: "May alienate technical audience", "Requires legal review"
   */
  risks: z.array(z.string()).optional(),
});

export const CraftOutputSchema = z.object({
  /**
   * Array of proposed changes to the website
   * Each change is independent and can be applied separately
   * MUST contain 6-12 changes (enforced)
   */
  proposedChanges: z.array(CraftProposedChangeSchema).min(6).max(12),

  /**
   * Optional overall risks or assumptions for the entire set of changes
   */
  risks: z.array(z.string()).optional(),

  /**
   * Optional assumptions made during the crafting process
   * Examples: "Assuming B2B audience", "Assuming conversion is primary goal"
   */
  assumptions: z.array(z.string()).optional(),
});

export type CraftProposedChange = z.infer<typeof CraftProposedChangeSchema>;
export type CraftOutput = z.infer<typeof CraftOutputSchema>;
