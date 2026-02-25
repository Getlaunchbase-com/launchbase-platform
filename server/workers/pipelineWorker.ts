/**
 * Pipeline Worker (BullMQ)
 *
 * Processes heavy pipeline jobs dispatched by the queue:
 *   - blueprint-parse:  call agent /tools/blueprint-parse → validate → persist
 *   - blueprint-detect: call agent /tools/blueprint-detect → validate → persist
 *   - estimate-chain:   call agent /tools/estimate-chain → validate → persist
 *
 * Requires REDIS_URL. If not set, startPipelineWorker() is a no-op
 * and the platform falls back to inline execution in tRPC handlers.
 *
 * Workers are horizontally scalable: run N replicas, each pulls jobs
 * from the same Redis-backed queue.
 */

import type {
  PipelineJob,
  BlueprintParseJob,
  BlueprintDetectJob,
  EstimateChainJob,
} from "../queues/pipelineQueue";
import { JOB_TIMEOUTS } from "../queues/pipelineQueue";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AGENT_URL = process.env.AGENT_STACK_URL ?? "http://localhost:4100";
const CONCURRENCY = parseInt(process.env.PIPELINE_WORKER_CONCURRENCY ?? "3", 10);

// ---------------------------------------------------------------------------
// Worker singleton
// ---------------------------------------------------------------------------

let _worker: any = null;

/**
 * Start the BullMQ pipeline worker.
 *
 * No-op if REDIS_URL is not set (platform falls back to inline execution).
 * Safe to call multiple times — only one worker runs per process.
 */
export async function startPipelineWorker(): Promise<void> {
  if (_worker) return;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log(
      "[pipelineWorker] REDIS_URL not set — worker disabled, using inline execution"
    );
    return;
  }

  const { Worker } = await import("bullmq");
  const { default: IORedis } = await import("ioredis");
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  _worker = new Worker(
    "pipeline",
    async (job) => {
      const data = job.data as PipelineJob;
      const timeout = JOB_TIMEOUTS[data.type] ?? 180_000;

      console.log(
        "[pipelineWorker] Processing job %s type=%s",
        job.id,
        data.type
      );

      try {
        switch (data.type) {
          case "blueprint-parse":
            return await processBlueprintParse(data, job);
          case "blueprint-detect":
            return await processBlueprintDetect(data, job);
          case "estimate-chain":
            return await processEstimateChain(data, job);
          default:
            throw new Error(`Unknown job type: ${(data as any).type}`);
        }
      } catch (err) {
        console.error(
          "[pipelineWorker] Job %s failed: %s",
          job.id,
          (err as Error).message
        );
        throw err; // BullMQ will retry per backoff config
      }
    },
    {
      connection,
      concurrency: CONCURRENCY,
      limiter: {
        max: 10,
        duration: 60_000, // max 10 jobs/min to protect agent-stack
      },
    }
  );

  _worker.on("completed", (job: any) => {
    console.log("[pipelineWorker] Job completed: %s", job.id);
  });

  _worker.on("failed", (job: any, err: Error) => {
    console.error(
      "[pipelineWorker] Job failed: %s — %s",
      job?.id,
      err.message
    );
  });

  console.log(
    "[pipelineWorker] Started with concurrency=%d",
    CONCURRENCY
  );
}

/**
 * Stop the pipeline worker gracefully (drain in-flight jobs).
 */
export async function stopPipelineWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
    console.log("[pipelineWorker] Stopped");
  }
}

// ---------------------------------------------------------------------------
// Agent call helper
// ---------------------------------------------------------------------------

async function callAgent(
  toolPath: string,
  payload: unknown,
  timeoutMs: number
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${AGENT_URL}${toolPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      throw new Error(
        `Agent ${toolPath} returned HTTP ${resp.status}: ${errBody.slice(0, 500)}`
      );
    }

    return await resp.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Job processors
// ---------------------------------------------------------------------------

/**
 * Process blueprint-parse: agent call → validate → persist pages/text/legend
 */
async function processBlueprintParse(
  data: BlueprintParseJob,
  job: any
): Promise<{ documentId: number; pagesCreated: number }> {
  const { getDb } = await import("../db");
  const {
    blueprintDocuments,
    blueprintPages,
    blueprintTextBlocks,
    blueprintLegendEntries,
    agentArtifacts,
  } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  const { validateBlueprintParseV1, getSchemaHash } = await import(
    "../contracts/validateBlueprintParse"
  );

  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Load document + artifact
  const [doc] = await db
    .select()
    .from(blueprintDocuments)
    .where(eq(blueprintDocuments.id, data.documentId))
    .limit(1);
  if (!doc) throw new Error(`Document ${data.documentId} not found`);

  const [artifact] = await db
    .select()
    .from(agentArtifacts)
    .where(eq(agentArtifacts.id, data.artifactId))
    .limit(1);
  if (!artifact) throw new Error(`Artifact ${data.artifactId} not found`);

  // Mark as parsing
  await db
    .update(blueprintDocuments)
    .set({ status: "parsing" })
    .where(eq(blueprintDocuments.id, data.documentId));

  await job.updateProgress(10);

  // Call agent
  const parseOutput = await callAgent(
    "/tools/blueprint-parse",
    {
      document_id: data.documentId,
      artifact_path: artifact.storagePath,
      storage_backend: artifact.storageBackend,
      filename: doc.filename,
      mime_type: doc.mimeType,
      project_id: data.projectId,
    },
    JOB_TIMEOUTS["blueprint-parse"]
  );

  await job.updateProgress(50);

  // Validate
  const validation = validateBlueprintParseV1(parseOutput);
  if (!validation.valid) {
    await db
      .update(blueprintDocuments)
      .set({ status: "failed" })
      .where(eq(blueprintDocuments.id, data.documentId));
    throw new Error(
      `BlueprintParseV1 validation failed: ${validation.errors.map((e: any) => e.message).join("; ")}`
    );
  }

  // Schema hash drift check
  const platformHash = getSchemaHash();
  if (parseOutput.contract?.schema_hash !== platformHash) {
    await db
      .update(blueprintDocuments)
      .set({ status: "failed" })
      .where(eq(blueprintDocuments.id, data.documentId));
    throw new Error("Schema hash mismatch — agent and platform have drifted");
  }

  await job.updateProgress(60);

  // Persist pages
  const pageIdMap = new Map<number, number>();
  for (const page of parseOutput.pages) {
    const [result] = await db.insert(blueprintPages).values({
      documentId: data.documentId,
      pageNumber: page.page_number,
      label: page.label ?? null,
      imageStoragePath: page.image_artifact_path ?? null,
      imageWidth: page.width_px,
      imageHeight: page.height_px,
      meta: null,
    });
    pageIdMap.set(page.page_number, result.insertId);
  }

  await job.updateProgress(75);

  // Persist text blocks (batched)
  if (parseOutput.text_blocks?.length > 0) {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const textBlockValues = parseOutput.text_blocks.map((tb: any) => ({
      pageId: pageIdMap.get(tb.page) ?? 0,
      x: clamp(tb.bbox.x),
      y: clamp(tb.bbox.y),
      w: clamp(tb.bbox.w),
      h: clamp(tb.bbox.h),
      text: tb.text,
      confidence: tb.confidence,
      blockType: tb.type,
    }));

    for (let i = 0; i < textBlockValues.length; i += 100) {
      await db.insert(blueprintTextBlocks).values(textBlockValues.slice(i, i + 100));
    }

    for (const pageId of pageIdMap.values()) {
      await db
        .update(blueprintPages)
        .set({ textExtracted: true })
        .where(eq(blueprintPages.id, pageId));
    }
  }

  // Persist legend candidates
  if (parseOutput.legend_candidates?.length > 0) {
    await db.insert(blueprintLegendEntries).values(
      parseOutput.legend_candidates.map((lc: any) => ({
        documentId: data.documentId,
        pageId: pageIdMap.get(lc.page) ?? null,
        symbolDescription: lc.symbol_description ?? lc.method,
        rawLabel: lc.raw_label ?? "unknown",
        canonicalType: null,
        symbolPackId: null,
      }))
    );
  }

  // Update document status + contract metadata
  await db
    .update(blueprintDocuments)
    .set({
      status: "parsed",
      parseContractName: "BlueprintParseV1",
      parseContractVersion: parseOutput.contract.version,
      parseSchemaHash: platformHash,
    })
    .where(eq(blueprintDocuments.id, data.documentId));

  await job.updateProgress(100);

  return { documentId: data.documentId, pagesCreated: pageIdMap.size };
}

/**
 * Process blueprint-detect: agent call → validate → persist detections
 */
async function processBlueprintDetect(
  data: BlueprintDetectJob,
  job: any
): Promise<{ documentId: number; detectionsCreated: number }> {
  const { getDb } = await import("../db");
  const {
    blueprintDocuments,
    blueprintPages,
    blueprintDetectionsRaw,
  } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Load pages for this document
  const pages = await db
    .select()
    .from(blueprintPages)
    .where(eq(blueprintPages.documentId, data.documentId));

  if (pages.length === 0) throw new Error("No pages found — run parse first");

  await db
    .update(blueprintDocuments)
    .set({ status: "detection_running" })
    .where(eq(blueprintDocuments.id, data.documentId));

  await job.updateProgress(10);

  // Call agent
  const detectOutput = await callAgent(
    "/tools/blueprint-detect",
    {
      document_id: data.documentId,
      pages: pages.map((p) => ({
        page_id: p.id,
        page_number: p.pageNumber,
        image_path: p.imageStoragePath,
        width_px: p.imageWidth,
        height_px: p.imageHeight,
      })),
      project_id: data.projectId,
    },
    JOB_TIMEOUTS["blueprint-detect"]
  );

  await job.updateProgress(50);

  // Validate + persist detections
  const detections = detectOutput.detections ?? detectOutput;
  if (!Array.isArray(detections)) {
    throw new Error("Agent detect output is not an array");
  }

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  let created = 0;

  for (let i = 0; i < detections.length; i += 100) {
    const batch = detections.slice(i, i + 100);
    await db.insert(blueprintDetectionsRaw).values(
      batch.map((d: any) => ({
        pageId: d.page_id ?? pages.find((p) => p.pageNumber === d.page_number)?.id ?? 0,
        documentId: data.documentId,
        x: clamp(d.x ?? d.bbox?.x ?? 0),
        y: clamp(d.y ?? d.bbox?.y ?? 0),
        w: clamp(d.w ?? d.bbox?.w ?? 0),
        h: clamp(d.h ?? d.bbox?.h ?? 0),
        rawClass: d.raw_class,
        confidence: d.confidence,
        status: "raw" as const,
      }))
    );
    created += batch.length;
    await job.updateProgress(50 + Math.round((i / detections.length) * 40));
  }

  await db
    .update(blueprintDocuments)
    .set({ status: "detection_complete" })
    .where(eq(blueprintDocuments.id, data.documentId));

  await job.updateProgress(100);

  return { documentId: data.documentId, detectionsCreated: created };
}

/**
 * Process estimate-chain: agent call → validate → persist results
 */
async function processEstimateChain(
  data: EstimateChainJob,
  job: any
): Promise<{ runId: number }> {
  const { getDb } = await import("../db");
  const {
    blueprintDocuments,
    blueprintDetectionsRaw,
    blueprintSymbolPacks,
    estimateChainRuns,
    projectTaskOverrides,
  } = await import("../db/schema");
  const { eq, and, inArray } = await import("drizzle-orm");
  const { validateEstimateChainV1, getEstimateSchemaHash } =
    await import("../contracts/validateEstimateChainV1");

  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Load document
  const [doc] = await db
    .select()
    .from(blueprintDocuments)
    .where(eq(blueprintDocuments.id, data.documentId))
    .limit(1);
  if (!doc) throw new Error(`Document ${data.documentId} not found`);

  // Load symbol pack
  const [pack] = await db
    .select()
    .from(blueprintSymbolPacks)
    .where(eq(blueprintSymbolPacks.id, data.symbolPackId))
    .limit(1);
  if (!pack) throw new Error(`Symbol pack ${data.symbolPackId} not found`);

  // Load mapped/verified detections
  const detections = await db
    .select()
    .from(blueprintDetectionsRaw)
    .where(
      and(
        eq(blueprintDetectionsRaw.documentId, data.documentId),
        inArray(blueprintDetectionsRaw.status, ["mapped", "verified"])
      )
    );

  // Load project overrides
  let overrides: any[] = [];
  if (data.projectId) {
    overrides = await db
      .select()
      .from(projectTaskOverrides)
      .where(eq(projectTaskOverrides.projectId, data.projectId));
  }

  await job.updateProgress(10);

  // Call agent
  const agentOutput = await callAgent(
    "/tools/estimate-chain",
    {
      document_id: data.documentId,
      project_id: data.projectId ?? null,
      symbol_pack_id: data.symbolPackId,
      symbol_pack_mappings: pack.mappings ?? [],
      detections: detections.map((d) => ({
        id: d.id,
        raw_class: d.rawClass,
        canonical_type: d.canonicalType ?? null,
        status: d.status,
        confidence: d.confidence,
        page_id: d.pageId,
        bbox: { x: d.x, y: d.y, w: d.w, h: d.h },
      })),
      overrides,
      params: {
        labor_factor: data.params?.laborFactor ?? null,
        waste_factor: data.params?.wasteFactor ?? null,
      },
      run_id: data.runId,
    },
    JOB_TIMEOUTS["estimate-chain"]
  );

  await job.updateProgress(60);

  // Validate
  const validation = validateEstimateChainV1(agentOutput);
  if (!validation.valid) {
    await db
      .update(estimateChainRuns)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(estimateChainRuns.id, data.runId));
    throw new Error(
      `EstimateChainV1 validation failed: ${validation.errors.map((e: any) => e.message).join("; ")}`
    );
  }

  // Schema hash drift check
  const agentHash = agentOutput?.contract?.schema_hash;
  const platformHash = getEstimateSchemaHash();
  if (agentHash && agentHash !== platformHash) {
    await db
      .update(estimateChainRuns)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(estimateChainRuns.id, data.runId));
    throw new Error("EstimateChainV1 schema hash mismatch — drift detected");
  }

  await job.updateProgress(80);

  // Extract metrics + persist
  const lineItems = agentOutput.line_items ?? [];
  const rollups = agentOutput.rollups ?? {};
  const quality = agentOutput.quality ?? {};

  await db
    .update(estimateChainRuns)
    .set({
      outputJson: agentOutput,
      totalLineItems: lineItems.length,
      totalLaborHours: parseFloat((rollups.labor_total_hours ?? 0).toFixed(2)),
      unmappedClassCount: (quality.unmapped_classes ?? []).length,
      lowConfidenceCount: (quality.low_confidence_items ?? []).length,
      gapFlagCount: (quality.gap_flags ?? []).length,
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(estimateChainRuns.id, data.runId));

  await job.updateProgress(100);

  return { runId: data.runId };
}
