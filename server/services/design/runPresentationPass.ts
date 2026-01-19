import { getDb } from "../../db";
import { designJobs, designCandidates, type InsertDesignJob, type InsertDesignCandidate } from "../../../drizzle/schema";
import { logDesignEvent } from "../../design-events";
import { generateCandidates } from "./generateCandidatesSimple";
import { scoreDesign, rankCandidates } from "./scoreDesignSimple";
import type { DesignOutput, IntakeData, BuildPlan } from "./types";
import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";

/**
 * Normalize designJson from DB to DesignOutput (handles legacy + new formats)
 */
function toDesignOutput(input: unknown): DesignOutput {
  if (input && typeof input === "object") {
    const o = input as any;

    // New format (already DesignOutput)
    if (o.version && o.tokens && o.layout) return o as DesignOutput;

    // Legacy format -> adapt with safe defaults
    if (o.hero || o.sections || o.colors || o.typography) {
      return {
        version: "v1",
        variantKey: o?.meta?.variantKey ?? "legacy",
        tokens: {
          maxWidth: "lg",
          radius: "lg",
          sectionGap: "normal",
          headingScale: "default",
          ctaStyle: "solid",
          trustPlacement: "hero",
          imageStyle: "stock",
        },
        layout: {
          hero: "left",
          trust: "inline",
          services: "cards",
          testimonials: "single",
          cta: "heroAndBottom",
        },
      };
    }
  }

  // Hard fail: unknown shape
  throw new Error("designJson is neither DesignOutput nor legacy design shape");
}

/**
 * Run presentation pass (Tier 1 Enhanced)
 * 
 * Orchestrates:
 * 1. Compute inputsHash
 * 2. Reuse existing job if completed
 * 3. Create job
 * 4. Generate 3 candidates
 * 5. Score them
 * 6. Pick winner, store ranks/scores
 * 7. Log events
 * 
 * **Fail-open:** If anything errors, returns null (default preview works)
 */

export async function runPresentationPass(args: {
  intakeId: number;
  tenant: "launchbase" | "vinces";
  tier: "standard" | "enhanced";
  intakeData: IntakeData;
  buildPlan: BuildPlan;
  siteSlug?: string;
}): Promise<{ jobId: number; winner: DesignOutput; variantKey: string; score: number } | null> {
  // 0) Hard guard: only enhanced tier
  if (args.tier !== "enhanced") {
    return null;
  }

  try {
    const inputsHash = hashPresentationInputs(args);

    // 1) Reuse winner if already done
    const existing = await findCompletedJob({
      intakeId: args.intakeId,
      tenant: args.tenant,
      tier: args.tier,
      inputsHash,
    });
    if (existing?.winner) {
      console.log(`[Presentation Pass] Reusing existing job ${existing.jobId} for intake ${args.intakeId}`);
      return existing;
    }

    // 2) Create job
    const job = await createDesignJob({
      intakeId: args.intakeId,
      tenant: args.tenant,
      tier: args.tier,
      inputsHash,
      engine: "launchbase_rules_v1",
    });
    await logDesignEvent({
      designJobId: job.id,
      intakeId: args.intakeId,
      tenant: args.tenant,
      eventType: "DESIGN_JOB_CREATED",
      actorType: "system",
      reason: "Tier 1 Enhanced Presentation Pass triggered",
      meta: { tier: args.tier, engine: "launchbase_rules_v1" },
    });

    // 3) Generate candidates
    const candidates = generateCandidates({
      intakeData: args.intakeData,
      buildPlan: args.buildPlan,
    });
    await insertCandidates(job.id, candidates);
    await logDesignEvent({
      designJobId: job.id,
      intakeId: args.intakeId,
      tenant: args.tenant,
      eventType: "DESIGN_CANDIDATES_GENERATED",
      actorType: "system",
      meta: { count: candidates.length },
    });

    // 4) Score
    const scored = candidates.map((c) => ({ ...c, score: scoreDesign(c) }));
    const ranked = rankCandidates(scored);
    await persistScoresAndRanks(job.id, ranked);
    await logDesignEvent({
      designJobId: job.id,
      intakeId: args.intakeId,
      tenant: args.tenant,
      eventType: "DESIGN_SCORED",
      actorType: "system",
      meta: { topScore: ranked[0]?.scoreTotal, topVariant: ranked[0]?.variantKey },
    });

    // 5) Select winner
    const winner = ranked[0];
    await markWinner(job.id, winner.variantKey);
    await logDesignEvent({
      designJobId: job.id,
      intakeId: args.intakeId,
      tenant: args.tenant,
      eventType: "DESIGN_SELECTED",
      actorType: "system",
      meta: { variantKey: winner.variantKey, score: winner.scoreTotal },
    });

    console.log(`[Presentation Pass] Job ${job.id} complete: winner=${winner.variantKey}, score=${winner.scoreTotal}`);

    return { jobId: job.id, winner: winner.design, variantKey: winner.variantKey, score: winner.scoreTotal };
  } catch (e) {
    console.error(`[Presentation Pass] Failed for intake ${args.intakeId}:`, e);
    await logDesignEvent({
      intakeId: args.intakeId,
      tenant: args.tenant,
      eventType: "DESIGN_FAILED",
      actorType: "system",
      reason: String(e),
      meta: { error: String(e) },
    });
    return null; // Fail open → default preview works
  }
}

/**
 * Hash presentation inputs (to detect if re-run needed)
 */
function hashPresentationInputs(args: {
  intakeData: IntakeData;
  buildPlan: BuildPlan;
  tier: string;
}): string {
  const input = {
    businessName: args.intakeData.businessName,
    businessDescription: args.intakeData.businessDescription,
    serviceArea: args.intakeData.serviceArea,
    vertical: args.buildPlan.vertical,
    primaryCTA: args.buildPlan.primaryCTA,
    tier: args.tier,
    engine: "launchbase_rules_v1",
  };
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

/**
 * Find completed job by inputs hash (for reuse)
 */
async function findCompletedJob(params: {
  intakeId: number;
  tenant: string;
  tier: string;
  inputsHash: string;
}): Promise<{ jobId: number; winner: DesignOutput; variantKey: string; score: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const jobs = await db
    .select()
    .from(designJobs)
    .where(
      and(
        eq(designJobs.intakeId, params.intakeId),
        eq(designJobs.tenant, params.tenant as any),
        eq(designJobs.tier, params.tier as any),
        eq(designJobs.inputsHash, params.inputsHash),
        eq(designJobs.status, "selected")
      )
    )
    .limit(1);

  if (jobs.length === 0 || !jobs[0].winnerCandidateId) {
    return null;
  }

  const job = jobs[0];
  
  // Get winner candidate
  const candidates = await db
    .select()
    .from(designCandidates)
    .where(eq(designCandidates.id, job.winnerCandidateId!))
    .limit(1);

  if (candidates.length === 0 || !candidates[0].designJson) {
    return null;
  }

  return {
    jobId: job.id,
    winner: toDesignOutput(candidates[0].designJson),
    variantKey: candidates[0].variantKey,
    score: candidates[0].scoreTotal,
  };
}

/**
 * Create design job
 */
async function createDesignJob(params: {
  intakeId: number;
  tenant: "launchbase" | "vinces";
  tier: "standard" | "enhanced";
  inputsHash: string;
  engine: string;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const job: InsertDesignJob = {
    intakeId: params.intakeId,
    tenant: params.tenant,
    tier: params.tier,
    status: "created",
    engine: params.engine,
    inputsHash: params.inputsHash,
  };

  const result = await db.insert(designJobs).values(job);
  const insertId = result[0].insertId;
  return { id: insertId };
}

/**
 * Insert candidates
 */
async function insertCandidates(
  designJobId: number,
  candidates: Array<{ variantKey: string; design: DesignOutput }>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const EMPTY_SCORE_BREAKDOWN = {
    readability: 0,
    hierarchy: 0,
    mobileClarity: 0,
    conversionClarity: 0,
    brandNeutrality: 0,
    signals: {},
    violations: [],
  };

  const rows: InsertDesignCandidate[] = candidates.map((c) => ({
    designJobId,
    variantKey: c.variantKey,
    designJson: c.design as any,
    scoreTotal: 0, // Will be updated after scoring
    scoreBreakdown: EMPTY_SCORE_BREAKDOWN,
    rank: 0, // Will be updated after ranking
  }));

  await db.insert(designCandidates).values(rows);
}

/**
 * Persist scores and ranks
 */
async function persistScoresAndRanks(
  designJobId: number,
  ranked: Array<{
    variantKey: string;
    design: DesignOutput;
    scoreTotal: number;
    scoreBreakdown: Record<string, number>;
    rank: number;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update each candidate with score + rank
  for (const r of ranked) {
    await db
      .update(designCandidates)
      .set({
        scoreTotal: r.scoreTotal,
        scoreBreakdown: r.scoreBreakdown as any,
        rank: r.rank,
      })
      .where(
        and(
          eq(designCandidates.designJobId, designJobId),
          eq(designCandidates.variantKey, r.variantKey)
        )
      );
  }

  // Update job status to scored
  await db
    .update(designJobs)
    .set({ status: "scored" })
    .where(eq(designJobs.id, designJobId));
}

/**
 * Mark winner
 */
async function markWinner(designJobId: number, winnerVariantKey: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get winner candidate ID
  const candidates = await db
    .select()
    .from(designCandidates)
    .where(
      and(
        eq(designCandidates.designJobId, designJobId),
        eq(designCandidates.variantKey, winnerVariantKey)
      )
    )
    .limit(1);

  if (candidates.length === 0) {
    throw new Error(`Winner candidate not found: ${winnerVariantKey}`);
  }

  const winnerId = candidates[0].id;

  // Update job with winner
  await db
    .update(designJobs)
    .set({
      status: "selected",
      winnerCandidateId: winnerId,
    })
    .where(eq(designJobs.id, designJobId));
}
