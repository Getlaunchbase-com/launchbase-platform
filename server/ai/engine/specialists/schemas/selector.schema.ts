/**
 * Selector Output Schema (Fast Mode)
 * 
 * Validates that selector returns EXACTLY 8 selected changes from candidate pool.
 * Selector MUST NOT invent new changes — only choose from input.
 */

import { z } from 'zod';

/**
 * Anchor schema (same as craft schema)
 */
const AnchorSchema = z.object({
  type: z.enum(['content', 'style', 'layout', 'asset']),
  currentValue: z.string().optional(),
  context: z.string().optional(),
});

/**
 * Selected change schema (same structure as craft proposedChanges)
 */
const SelectedChangeSchema = z.object({
  targetKey: z.string().min(1),
  changeType: z.enum(['content', 'style', 'layout', 'asset']),
  proposedValue: z.string().min(1),
  rationale: z.string().min(8),
  anchor: AnchorSchema.optional(),
});

/**
 * Selector output schema: EXACTLY 8 selected changes
 */
export const SelectorOutputSchemaFast = z.object({
  selectedChanges: z.array(SelectedChangeSchema).length(8),
});

export type SelectorOutputFast = z.infer<typeof SelectorOutputSchemaFast>;
