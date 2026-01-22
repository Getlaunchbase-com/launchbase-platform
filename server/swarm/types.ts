import { z } from "zod";

export const IntentionEnum = z.enum(["smoke_test", "pressure_test", "improve", "critic"]);
export type Intention = z.infer<typeof IntentionEnum>;

export const ScopePresetEnum = z.enum(["auto", "minimal", "standard", "deep"]);
export type ScopePreset = z.infer<typeof ScopePresetEnum>;

export const StructuredCommandSchema = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
});

export type StructuredCommand = z.infer<typeof StructuredCommandSchema>;

const TogglesSchema = z.object({
  escalationRetryEnabled: z.boolean().default(true),
  hunkRepairEnabled: z.boolean().default(true),
  emptyPatchRetryEnabled: z.boolean().default(true),
  reviewerEnabled: z.boolean().default(true),
  arbiterEnabled: z.boolean().default(true),
}).default({
  escalationRetryEnabled: true,
  hunkRepairEnabled: true,
  emptyPatchRetryEnabled: true,
  reviewerEnabled: true,
  arbiterEnabled: true,
});

export const FeaturePackV1Schema = z.object({
  repoSourceId: z.number().int().optional(),

  name: z.string().min(1),
  intention: IntentionEnum.default("smoke_test"),
  sourceType: z.enum(["fixture", "manual"]).default("fixture"),
  fixtureName: z.string().optional(),
  failurePacketJson: z.string().optional(), // manual
  errorMessage: z.string().optional(),
  logs: z.array(z.string()).default([]),
  primaryModel: z.string().min(1),
  fallbackModel: z.string().optional(),
  role: z.enum(["owner", "it", "dev", "readonly"]).default("owner"),
  timeoutSec: z.number().int().positive().default(180),
  runBudgetSec: z.number().int().positive().default(600),
  toggles: TogglesSchema,
  scopePreset: ScopePresetEnum.default("standard"),
  maxFiles: z.number().int().positive().default(20),
  maxBytes: z.number().int().positive().default(200_000),
  selectedFiles: z.array(z.string()).default([]),
  testCommands: z.array(StructuredCommandSchema).default([]),
});

export type FeaturePackV1 = z.infer<typeof FeaturePackV1Schema>;

export const CreateRunInputSchema = z.object({
  featurePack: FeaturePackV1Schema,
  profileId: z.number().int().optional(),
});


export const CreateProfileFromRunInputSchema = z.object({
  repairId: z.string().min(1),
  name: z.string().min(1).optional(),
});

export const ProfileStatsWindowEnum = z.enum(["24h","7d","30d"]);
export type ProfileStatsWindow = z.infer<typeof ProfileStatsWindowEnum>;

export const GetProfileStatsInputSchema = z.object({
  id: z.number().int(),
  window: ProfileStatsWindowEnum.default("7d"),
});

export const ProfileStatsSchema = z.object({
  window: ProfileStatsWindowEnum,
  runs: z.number(),
  passRate: z.number(), // 0..1
  ok: z.number(),
  tests_failed: z.number(),
  patch_invalid: z.number(),
  other: z.number(),
  avgCostUsd: z.number().nullable(),
  p95LatencyMs: z.number().nullable(),
});
export type ProfileStats = z.infer<typeof ProfileStatsSchema>;

export const CreateProfileInputSchema = z.object({
  name: z.string().min(1),
  config: FeaturePackV1Schema,
});

export const ListRunsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.number().int().optional(), // createdAt unix ms for pagination
  stopReason: z.string().optional(),
  model: z.string().optional(),
  intention: IntentionEnum.optional(),
  fixtureName: z.string().optional(),
});

export const GetRunInputSchema = z.object({
  repairId: z.string().min(1),
});

export const GetArtifactUrlInputSchema = z.object({
  repairId: z.string().min(1),
  key: z.string().min(1),
});

export const ListProfilesInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
});

export const GetProfileInputSchema = z.object({
  id: z.number().int().positive(),
});

export const PromoteProfileInputSchema = z.object({
  id: z.number().int().positive(),
  isPromoted: z.boolean(),
});

export const ListModelsOutputSchema = z.array(z.object({
  id: z.string(),
  label: z.string().optional(),
}));


export const RepoSourceTypeEnum = z.enum(["local", "git"]);
export const RepoAuthTypeEnum = z.enum(["token", "ssh"]);

export const RepoSourceSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: RepoSourceTypeEnum,
  localPath: z.string().nullable().optional(),
  repoUrl: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  authType: RepoAuthTypeEnum.nullable().optional(),
  // NOTE: encryptedSecret intentionally omitted from API output.
  lastSyncAt: z.any().nullable().optional(),
  lastHeadSha: z.string().nullable().optional(),
});
export type RepoSourceRow = z.infer<typeof RepoSourceSchema> & {
  encryptedSecret?: string | null;
};

export const CreateRepoSourceLocalInputSchema = z.object({
  name: z.string().min(1),
  localPath: z.string().min(1),
});

export const CreateRepoSourceGitInputSchema = z.object({
  name: z.string().min(1),
  repoUrl: z.string().min(1),
  branch: z.string().min(1).default("main"),
  authToken: z.string().optional(),
});

export const SyncRepoSourceInputSchema = z.object({
  id: z.number().int(),
});

export const FileSearchInputSchema = z.object({
  repoSourceId: z.number().int(),
  query: z.string().min(1),
  limit: z.number().int().min(1).max(200).default(50),
});

export const FileReadInputSchema = z.object({
  repoSourceId: z.number().int(),
  path: z.string().min(1),
});

export const PushRunToBranchInputSchema = z.object({
  repairId: z.string().min(1),
  repoSourceId: z.number().int(),
  branchName: z.string().min(1).optional(),
  commitMessage: z.string().min(1).optional(),
});
