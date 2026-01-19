import { z } from 'zod';

// IntakeValidationV1
export const IntakeValidationV1Schema = z.object({
  version: z.literal('intake_validation.v1'),
  timestamp: z.string(),
  status: z.enum(['PASS', 'NEEDS_INFO', 'BLOCKED']),
  tier: z.enum(['standard', 'growth', 'premium']),
  confidence: z.number().min(0).max(1),
  
  derived: z.object({
    vertical: z.string().optional(),
    websiteStatus: z.enum(['existing', 'none', 'needs_rebuild']).optional(),
    audience: z.string().optional(),
    language: z.string().default('en'),
  }),
  
  detectedCapabilities: z.object({
    hasWebsiteUrl: z.boolean(),
    hasBookingLink: z.boolean(),
    hasBrandColors: z.boolean(),
    hasLogo: z.boolean(),
    hasReviews: z.boolean(),
    hasGoogleAccount: z.boolean(),
    hasQuickBooksAccount: z.boolean(),
  }),
});

export type IntakeValidationV1 = z.infer<typeof IntakeValidationV1Schema>;

// AddonPlanV1
export const AddonPlanV1Schema = z.object({
  version: z.literal('addon_plan.v1'),
  timestamp: z.string(),
  
  addonsRequested: z.array(z.string()),
  
  addonsEligibleByTier: z.object({
    inbox_engine: z.boolean(),
    phone_engine: z.boolean(),
    social_engine: z.boolean(),
    ads_engine: z.boolean(),
    books_engine: z.boolean(),
  }),
  
  integrationReadiness: z.object({
    inbox_engine: z.enum(['READY', 'NEEDS_OAUTH', 'NEEDS_ACCESS', 'NOT_APPLICABLE']),
    phone_engine: z.enum(['READY', 'NEEDS_OAUTH', 'NEEDS_ACCESS', 'NOT_APPLICABLE']),
    social_engine: z.enum(['READY', 'NEEDS_OAUTH', 'NEEDS_ACCESS', 'NOT_APPLICABLE']),
    ads_engine: z.enum(['READY', 'NEEDS_OAUTH', 'NEEDS_ACCESS', 'NOT_APPLICABLE']),
    books_engine: z.enum(['READY', 'NEEDS_OAUTH', 'NEEDS_ACCESS', 'NOT_APPLICABLE']),
  }),
  
  recommendedAddons: z.array(z.object({
    addon: z.string(),
    reason: z.string(),
  })),
});

export type AddonPlanV1 = z.infer<typeof AddonPlanV1Schema>;

// RepairPacketV1
export const RepairPacketV1Schema = z.object({
  version: z.literal('repair_packet.v1'),
  timestamp: z.string(),
  minimal: z.literal(true),
  
  questions: z.array(z.object({
    key: z.string(),
    question: z.string(),
    whyItMatters: z.string(),
    requiredForAddons: z.array(z.string()).optional(),
    requiredForTier: z.enum(['standard', 'growth', 'premium']).optional(),
  })),
});

// Note: RepairPacketV1 type is exported from ./repairPacket.ts
// This schema is for preflight validation only

// FailurePacketV1
export const FailurePacketV1Schema = z.object({
  version: z.literal('failure_packet.v1'),
  runId: z.string(),
  intakeId: z.number().optional(),
  step: z.string(),
  errorName: z.string(),
  errorMessage: z.string(),
  stack: z.string().optional(),
  timestampIso: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});

// Preflight-specific type (for validation)
type FailurePacketV1Preflight = z.infer<typeof FailurePacketV1Schema>;
export type { FailurePacketV1Preflight as FailurePacketV1 };

// PreflightResultV1 (combined output)
export const PreflightResultV1Schema = z.object({
  version: z.literal('preflight_result.v1'),
  validation: IntakeValidationV1Schema,
  addonPlan: AddonPlanV1Schema,
  repairPacket: RepairPacketV1Schema,
});

export type PreflightResultV1 = z.infer<typeof PreflightResultV1Schema>;

// Force checkpoint update
