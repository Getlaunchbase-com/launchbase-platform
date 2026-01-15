import { z } from 'zod';

/**
 * Selector Specialist Output Schema (Fast)
 * 
 * Selects the best 8 changes from a candidate list (8-24 items).
 * MUST match the craft schema structure (targetKey, value, rationale, confidence, risks).
 */

const SelectedChangeSchema = z.object({
  /**
   * Maps to a specific page section or element
   * MUST match pattern: ^(design|brand)\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$
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
  rationale: z.string().min(8),
  
  /**
   * Confidence in this change (0.0 to 1.0)
   * Higher confidence = less likely to need human review
   */
  confidence: z.number().min(0).max(1),
  
  /**
   * Optional risks or concerns about this change
   */
  risks: z.array(z.string()).optional(),
});

/**
 * Selector Output Schema (Fast) - EXACTLY 8 selected changes
 */
export const SelectorOutputSchemaFast = z.object({
  /**
   * EXACTLY 8 selected changes from the candidate list
   * Each change MUST be copied from candidateChanges (no invention)
   */
  selectedChanges: z.array(SelectedChangeSchema).length(8, "Must select exactly 8 changes"),
});

export type SelectorOutputFast = z.infer<typeof SelectorOutputSchemaFast>;
