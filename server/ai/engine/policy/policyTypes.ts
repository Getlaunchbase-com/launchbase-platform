/**
 * Policy Types — Config-Driven Tier Behavior (Zod Schemas)
 * 
 * CORE RULE: policyId stays in WorkOrder CORE. Everything else lives here.
 * 
 * No provider-specific branching in code. Only in policy.
 */

import { z } from "zod";

// ============================================
// CAPABILITIES (PROVIDER-AGNOSTIC)
// ============================================

/**
 * Internal capability names (provider-agnostic).
 * Vendor feature strings are mapped elsewhere (feature alias layer).
 */
export const CapabilitySchema = z.enum([
  "json_output",
  "json_schema",
  "low_latency",
  "low_cost",
  "vision",
  "audio",
  "long_context",
]);

export type Capability = z.infer<typeof CapabilitySchema>;

// ============================================
// SWARM CONFIG
// ============================================

export const SwarmConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxLoops: z.number().int().min(0).max(5).optional(),
  maxSwirlRounds: z.number().int().min(0).max(5).optional(),
  specialists: z.array(z.string()).default([]), // e.g., ["craft", "critic"]
  collapseStrategy: z.string().optional(), // e.g., "field_general"
  failureMode: z.string().optional(), // e.g., "continue_with_warnings"
  roles: z.record(z.string(), z.object({
    transport: z.string(),
    model: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
  })).optional(),
  costCapsUsd: z.object({
    perRole: z.record(z.string(), z.number()).optional(),
    total: z.number().optional(),
  }).optional(),
  timeoutsMs: z.record(z.string(), z.number()).optional(),
});

export type SwarmConfig = z.infer<typeof SwarmConfigSchema>;

// ============================================
// PRESENTATION DEFAULTS
// ============================================

export const PresentationDefaultsSchema = z.object({
  mode: z.string().default("customer_portal"), // For future skins
});

export type PresentationDefaults = z.infer<typeof PresentationDefaultsSchema>;

// ============================================
// LOGGING CONFIG
// ============================================

export const LoggingConfigSchema = z.object({
  customerTrailEnabled: z.boolean().default(true),
  internalTrailEnabled: z.boolean().default(true),
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// ============================================
// ROUTING CONFIG
// ============================================

export const RoutingConfigSchema = z.object({
  requiredCaps: z.array(CapabilitySchema).default([]),
  preferredCaps: z.array(CapabilitySchema).default([]),
});

export type RoutingConfig = z.infer<typeof RoutingConfigSchema>;

// ============================================
// POLICY CAPS
// ============================================

export const PolicyCapsSchema = z.object({
  maxRounds: z.number().int().min(1).max(6),
  costCapUsd: z.number().min(0).max(10),
  maxTokensTotal: z.number().int().min(1).max(200000),
});

export type PolicyCaps = z.infer<typeof PolicyCapsSchema>;

// ============================================
// POLICY V1
// ============================================

export const PolicyV1Schema = z.object({
  policyId: z.string().min(1),
  engineVersion: z.literal("v1"),
  caps: PolicyCapsSchema,
  routing: RoutingConfigSchema,
  swarm: SwarmConfigSchema.default({ enabled: false, maxLoops: 0, specialists: [] }),
  presentationDefaults: PresentationDefaultsSchema.default({ mode: "customer_portal" }),
  logging: LoggingConfigSchema.default({ customerTrailEnabled: true, internalTrailEnabled: true }),
});

export type PolicyV1 = z.infer<typeof PolicyV1Schema>;

// ============================================
// POLICY RESOLUTION RESULT
// ============================================

export type PolicyResolutionResult =
  | { ok: true; policy: PolicyV1 }
  | { ok: false; stopReason: "policy_not_found" | "policy_invalid"; details?: string };
