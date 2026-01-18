/**
 * JobPacketV1 - Locked plan from Round 1 PLAN swarm
 * 
 * This is the constitutional contract that governs Round 2 BUILD execution.
 * Builder cannot deviate from this plan.
 */

export type JobPacketV1 = {
  version: "jobPacket.v1";
  id: string; // Unique job ID (e.g., "premium_getlaunchbase_<timestamp>")
  createdAtIso: string;
  
  target: {
    site: string; // e.g., "getlaunchbase.com"
    tier: "standard" | "growth" | "premium";
    intakeId?: number; // If triggered from intake
  };
  
  scope: {
    pages: string[]; // e.g., ["pricing", "how_it_works", "examples"]
    surfacesAllowed: string[]; // e.g., ["homepage_ui", "pricing_ui", "how_it_works_ui"]
    outOfScope: string[]; // e.g., ["stripe", "oauth", "portal", "auth"]
  };
  
  builderGate: {
    enabled: boolean;
    allowedFolders: string[]; // e.g., ["client/src/pages/**", "client/src/components/marketing/**"]
    forbiddenFolders: string[]; // e.g., ["server/**", "drizzle/**", "package.json"]
    allowedComponents: string[]; // e.g., ["Button", "Card", "Section"]
  };
  
  designSystem: {
    contractPath: string; // e.g., "docs/premium_design_system_patchlist.md"
    typography: {
      h1: string; // e.g., "40-48px desktop / 30-34px mobile"
      h2: string;
      h3: string;
      body: string;
    };
    spacing: {
      sectionPadding: string; // e.g., "py-16 desktop / py-12 mobile"
      cardPadding: string;
    };
    components: {
      buttonHeight: string; // e.g., "44-48px"
      cardBorderRadius: string; // e.g., "16-24px"
    };
  };
  
  acceptanceGates: {
    mobile: {
      mustPass: string[]; // e.g., ["Only 1 primary CTA in hero", "CTA visible by 20% scroll"]
      shouldPass: string[];
    };
    designSystem: {
      mustPass: string[]; // e.g., ["H1 once per page", "Button variants consistent"]
      shouldPass: string[];
    };
    truth: {
      mustPass: string[]; // e.g., ["No invented performance claims"]
      shouldPass: string[];
    };
    performance: {
      mustPass: string[];
      shouldPass: string[];
    };
  };
  
  pagePlans: {
    page: string; // e.g., "pricing"
    pagePlanPath: string; // e.g., "docs/premium_pageplans/pricing.pageplan.json"
  }[];
  
  limits: {
    maxLoops: number; // e.g., 10
    maxRepairs: number; // e.g., 2
    maxUsd: number; // e.g., 2.00
    maxLatencyPerLoopSec: number; // e.g., 120
  };
  
  audit: {
    fieldGeneralPlan: string; // Summary from Field General
    criticConcerns: string[]; // Concerns raised by Critic
    coderFeasibility: string; // Feasibility assessment from Coder
    arbiterDecision: string; // Final decision from Arbiter
    models: {
      fieldGeneral: string; // e.g., "openai/gpt-5-2"
      critic: string; // e.g., "claude-sonnet-4-20250514"
      coder: string; // e.g., "openai/gpt-5-2"
      arbiter: string; // e.g., "openai/gpt-5-2"
    };
  };
};

export function createJobPacket(opts: {
  target: JobPacketV1["target"];
  scope: JobPacketV1["scope"];
  builderGate: JobPacketV1["builderGate"];
  designSystem: JobPacketV1["designSystem"];
  acceptanceGates: JobPacketV1["acceptanceGates"];
  pagePlans: JobPacketV1["pagePlans"];
  limits: JobPacketV1["limits"];
  audit: JobPacketV1["audit"];
}): JobPacketV1 {
  return {
    version: "jobPacket.v1",
    id: `premium_${opts.target.site.replace(/\./g, "_")}_${Date.now()}`,
    createdAtIso: new Date().toISOString(),
    ...opts,
  };
}
