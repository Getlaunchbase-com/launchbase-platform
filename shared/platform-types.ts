/**
 * Platform Client DTOs
 * Shared types between LaunchBase platform and customer sites
 * 
 * RULE: Customer sites consume these types only - no decision logic
 */

import { z } from 'zod';

// Facebook Connection
export const FacebookConnectionStatusSchema = z.object({
  connected: z.boolean(),
  pageId: z.string().nullable(),
  pageName: z.string().nullable(),
  tokenValid: z.boolean(),
  lastVerified: z.string().datetime().nullable(),
});
export type FacebookConnectionStatus = z.infer<typeof FacebookConnectionStatusSchema>;

// Draft
export const DraftSchema = z.object({
  id: z.number(),
  content: z.string(),
  platform: z.enum(['facebook', 'instagram', 'twitter']),
  status: z.enum(['pending', 'approved', 'published', 'rejected', 'expired']),
  triggerReason: z.string(),
  intelligenceVersion: z.string(),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  externalId: z.string().nullable(),
});
export type Draft = z.infer<typeof DraftSchema>;

export const DraftListResponseSchema = z.object({
  drafts: z.array(DraftSchema),
  total: z.number(),
});
export type DraftListResponse = z.infer<typeof DraftListResponseSchema>;

// Approve Draft
export const ApproveDraftRequestSchema = z.object({
  draftId: z.number(),
  publishAt: z.string().datetime().optional(),
});
export type ApproveDraftRequest = z.infer<typeof ApproveDraftRequestSchema>;

export const ApproveDraftResponseSchema = z.object({
  success: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  externalId: z.string().nullable(),
  error: z.string().optional(),
});
export type ApproveDraftResponse = z.infer<typeof ApproveDraftResponseSchema>;

// Context Summary (optional, for later)
export const ContextSummarySchema = z.object({
  weather: z.object({
    postType: z.string(),
    urgency: z.enum(['low', 'medium', 'high']),
    summary: z.string(),
    safetyGate: z.boolean(),
  }).nullable(),
  localContext: z.object({
    topTrend: z.string().nullable(),
    shouldMention: z.boolean(),
  }).nullable(),
  recommendation: z.object({
    shouldPost: z.boolean(),
    suggestedTiming: z.string().datetime().nullable(),
    reason: z.string(),
  }),
});
export type ContextSummary = z.infer<typeof ContextSummarySchema>;
