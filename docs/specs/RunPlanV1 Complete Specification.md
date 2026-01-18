# RunPlanV1 Complete Specification

## TypeScript Type Definition

```typescript
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
```

## Example JSON (Standard Tier)

```json
{
  "version": "runplan.v1",
  "runId": "run_2026-01-17_abc123",
  "jobId": "job_intake_456",
  
  "tier": "standard",
  "runMode": "production",
  "loopsRequested": 1,
  
  "creativeMode": {
    "enabled": true,
    "capBeforeSelect": 24
  },
  
  "builderGate": {
    "enabled": false,
    "reason": "tier_not_premium"
  },
  
  "packs": {
    "systems": {
      "packId": "launchbase_systems_v1",
      "params": {
        "businessName": "Acme Plumbing",
        "industry": "Home Services",
        "targetAudience": "Homeowners in Austin, TX",
        "services": ["Emergency Plumbing", "Water Heater Repair", "Drain Cleaning"],
        "uniqueValue": "24/7 emergency service with 1-hour response time",
        "tone": "professional, trustworthy, local"
      }
    },
    "brand": {
      "packId": "launchbase_brand_v1",
      "params": {
        "businessName": "Acme Plumbing",
        "industry": "Home Services",
        "targetAudience": "Homeowners in Austin, TX",
        "brandPersonality": "reliable, responsive, community-focused",
        "colorPreferences": "blue (trust), orange (urgency)",
        "competitorUrls": ["https://competitor1.com", "https://competitor2.com"]
      }
    },
    "critic": {
      "packId": "launchbase_critic_v1",
      "params": {
        "truthPack": {
          "neverInventClaims": true,
          "onlyUseIntakeFacts": true,
          "requiresApproval": true
        },
        "industryStandards": ["clear pricing", "emergency contact visible", "service area map"],
        "complianceRules": ["no fake reviews", "no stock photos pretending to be staff", "no invented certifications"]
      }
    }
  },
  
  "budgets": {
    "maxUsd": 0.50,
    "maxLatencyMs": 120000
  },
  
  "truth": {
    "neverInventClaims": true,
    "onlyUseIntakeFacts": true,
    "requiresApproval": true
  },
  
  "createdAtIso": "2026-01-17T13:45:00.000Z"
}
```

## Example JSON (Premium Tier with Builder.io)

```json
{
  "version": "runplan.v1",
  "runId": "run_2026-01-17_xyz789",
  "jobId": "job_intake_789",
  
  "tier": "premium",
  "runMode": "production",
  "loopsRequested": 10,
  
  "creativeMode": {
    "enabled": true,
    "capBeforeSelect": 24
  },
  
  "builderGate": {
    "enabled": true,
    "allowedSurfaces": ["homepage_ui", "landing_page_ui", "pricing_ui"],
    "maxIterations": 5
  },
  
  "packs": {
    "systems": {
      "packId": "launchbase_systems_v1",
      "params": {
        "businessName": "Elite Law Firm",
        "industry": "Legal Services",
        "targetAudience": "Business owners needing corporate law services",
        "services": ["Contract Review", "Business Formation", "IP Protection"],
        "uniqueValue": "20+ years experience with Fortune 500 companies",
        "tone": "authoritative, sophisticated, results-driven"
      }
    },
    "brand": {
      "packId": "launchbase_brand_v1",
      "params": {
        "businessName": "Elite Law Firm",
        "industry": "Legal Services",
        "targetAudience": "Business owners needing corporate law services",
        "brandPersonality": "premium, authoritative, trustworthy",
        "colorPreferences": "navy (authority), gold (premium)",
        "competitorUrls": ["https://biglaw1.com", "https://biglaw2.com"]
      }
    },
    "critic": {
      "packId": "launchbase_critic_v1",
      "params": {
        "truthPack": {
          "neverInventClaims": true,
          "onlyUseIntakeFacts": true,
          "requiresApproval": true
        },
        "industryStandards": ["attorney bios with bar numbers", "practice areas clearly listed", "case results (if permitted)"],
        "complianceRules": ["no guaranteed outcomes", "no invented case wins", "no fake attorney credentials"]
      }
    }
  },
  
  "budgets": {
    "maxUsd": 5.00,
    "maxLatencyMs": 1200000
  },
  
  "truth": {
    "neverInventClaims": true,
    "onlyUseIntakeFacts": true,
    "requiresApproval": true
  },
  
  "createdAtIso": "2026-01-17T14:00:00.000Z"
}
```

## Key Fields for executeRunPlan()

### Where Things Live:

1. **stack**: NOT in RunPlan (loaded separately from `config/stacks/stack_creative_production_default.json`)
2. **context**: Derived from RunPlan fields:
   - `creativeMode` → context.creativeMode
   - `runMode` → context.policy.allowNormalization
3. **plan**: Built from RunPlan.packs.systems.params (the "work order")
4. **lane**: Derived from intake.industry or intake.vertical (default: "web")

### Mapping Logic:

```typescript
// Load production stack (external to RunPlan)
const stack = loadProductionStack(); // from config/stacks/

// Build context from RunPlan
const context = {
  creativeMode: runPlan.creativeMode,
  policy: { 
    allowNormalization: runPlan.runMode === "production" 
  },
};

// Build work order from packs
const plan = {
  runId: runPlan.runId,
  jobId: runPlan.jobId,
  tier: runPlan.tier,
  packs: runPlan.packs,
  truth: runPlan.truth,
  // Inject intake facts here:
  businessName: runPlan.packs.systems.params.businessName,
  industry: runPlan.packs.systems.params.industry,
  // ... etc
};

// Derive lane from intake
const lane = deriveLaneFromIndustry(intake.industry); // "web" | "marketing" | "app"
```

## Database Storage

```typescript
// drizzle/schema.ts
export const runPlans = mysqlTable("run_plans", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  tenant: varchar("tenant", { length: 32 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 255 }).notNull(),
  
  runId: varchar("runId", { length: 128 }).notNull(),
  jobId: varchar("jobId", { length: 128 }).notNull(),
  
  tier: mysqlEnum("tier", ["standard", "growth", "premium"]).notNull(),
  runMode: mysqlEnum("runMode", ["tournament", "production"]).notNull(),
  
  creativeModeEnabled: int("creativeModeEnabled").notNull().default(1), // 0/1
  
  // Full RunPlan JSON (versioned)
  data: json("data").$type<Record<string, unknown>>().notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

## Tier-Specific Configurations

| Tier | loopsRequested | maxUsd | maxLatencyMs | builderGate.enabled |
|------|----------------|--------|--------------|---------------------|
| **standard** | 1 | $0.50 | 120,000ms (2min) | false |
| **growth** | 3 | $1.50 | 360,000ms (6min) | false |
| **premium** | 10 | $5.00 | 1,200,000ms (20min) | true |

## Truth Pack (All Tiers)

```typescript
truth: {
  neverInventClaims: true,     // Never make up facts
  onlyUseIntakeFacts: true,    // Only use customer-provided info
  requiresApproval: true,      // Customer must approve before deploy
}
```

This ensures all AI outputs are grounded in customer intake data and require explicit approval.
