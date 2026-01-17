// server/ai/orchestration/types.ts

export type Tier = "standard" | "growth" | "premium";
export type RunMode = "tournament" | "production";

export type BuilderGate =
  | {
      enabled: false;
      reason: "tier_not_premium" | "disabled_by_policy" | "incomplete_info";
    }
  | {
      enabled: true;
      allowedSurfaces: Array<"homepage_ui" | "landing_page_ui" | "pricing_ui">;
      maxIterations: number; // e.g. 3-5 builder passes
    };

export type CreditsV1 = {
  included: number;
  remaining: number;
  consumed: number;
};

export type CreativeModeV1 = {
  enabled: boolean;
  capBeforeSelect: number; // 24
};

export type RunPlanV1 = {
  version: "runplan.v1";
  runId: string;
  jobId: string;

  tier: Tier;
  runMode: RunMode;

  // loops for swarm polish (credits will constrain later)
  loopsRequested: number;

  creativeMode: CreativeModeV1;
  builderGate: BuilderGate;

  // prompt packs + policy knobs (deterministic build)
  packs: {
    systems: { packId: string; params: Record<string, unknown> };
    brand: { packId: string; params: Record<string, unknown> };
    critic: { packId: string; params: Record<string, unknown> };
  };

  // budgets (used for guardrails + ops)
  budgets: {
    maxUsd: number;
    maxLatencyMs: number;
  };

  // safety knobs / "truth pack"
  truth: {
    neverInventClaims: true;
    onlyUseIntakeFacts: true;
    requiresApproval: true;
  };

  createdAtIso: string;
};

export type ShipPacketV1 = {
  version: "shippacket.v1";
  intakeId: number;
  runPlanId: number;
  runId: string;
  tier: Tier;

  proposal: {
    systems: unknown | null;
    brand: unknown | null;
    critic: unknown | null;
  };

  preview: {
    url?: string;
    token?: string;
    screenshots: string[];
  };

  execution: {
    buildPlanId: number | null;
    builderSnapshotId: string | null;
  };

  createdAtIso: string;
};
