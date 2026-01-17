// server/ai/orchestration/promptPackBuilders.ts
import type { Intake } from "../../drizzle/schema";

type PackOut = { packId: string; params: Record<string, unknown> };

function truthPack(intake: Intake) {
  return {
    // These mirror the rules from system_field_general.md
    truth: {
      neverInventClaims: true,
      onlyUseIntakeFacts: true,
      requiresApproval: true,
      // useful anchors
      language: intake.language,
      audience: intake.audience,
      tenant: intake.tenant,
    },
  };
}

function normalizeMaybeArray(x?: string[] | null) {
  if (!x || !Array.isArray(x)) return [];
  return x.filter(Boolean).slice(0, 25);
}

export function buildSystemsPack(intake: Intake): PackOut {
  return {
    // This should match a prompt pack you already have in server/ai/promptPacks/...
    packId: "swarm/v1/craft.systems_fast",
    params: {
      ...truthPack(intake),
      business: {
        name: intake.businessName,
        vertical: intake.vertical,
        websiteStatus: intake.websiteStatus,
        tagline: intake.tagline ?? null,
        primaryCTA: intake.primaryCTA ?? null,
        bookingLink: intake.bookingLink ?? null,
        serviceArea: normalizeMaybeArray(intake.serviceArea),
        services: normalizeMaybeArray(intake.services),
      },
      brand: {
        colors: intake.brandColors ?? null,
      },
      // keep rawPayload available but bounded (avoid dumping huge objects)
      rawPayload: intake.rawPayload ? JSON.stringify(intake.rawPayload).slice(0, 8000) : null,
    },
  };
}

export function buildBrandPack(intake: Intake): PackOut {
  return {
    packId: "swarm/v1/craft.brand_fast",
    params: {
      ...truthPack(intake),
      business: {
        name: intake.businessName,
        vertical: intake.vertical,
        tagline: intake.tagline ?? null,
        audience: intake.audience,
        language: intake.language,
      },
      brand: {
        colors: intake.brandColors ?? null,
      },
      preferences: {
        // Optional knobs you can add later; keep stable for now
        avoidHype: true,
        keepSimple: true,
      },
    },
  };
}

export function buildCriticPack(intake: Intake): PackOut {
  return {
    packId: "v1/system_critic",
    params: {
      ...truthPack(intake),
      business: {
        name: intake.businessName,
        vertical: intake.vertical,
        services: normalizeMaybeArray(intake.services),
        serviceArea: normalizeMaybeArray(intake.serviceArea),
        primaryCTA: intake.primaryCTA ?? null,
      },
      compliance: {
        forbidNewClaims: true,
        requireBuildable: true,
        requireWhitelistedKeys: true,
      },
    },
  };
}
