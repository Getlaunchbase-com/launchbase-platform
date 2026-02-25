/**
 * Pipeline Job Queue (BullMQ)
 *
 * Offloads heavy pipeline operations to background workers so the HTTP
 * handler can return immediately with a job ID. Workers process:
 *
 *   - blueprint-parse   → agent /tools/blueprint-parse + schema validation + DB persist
 *   - blueprint-detect  → agent /tools/blueprint-detect + validation + DB persist
 *   - estimate-chain    → agent /tools/estimate-chain + schema validation + DB persist
 *
 * Backend:
 *   - REDIS_URL set → BullMQ with Redis (distributed, multi-replica)
 *   - REDIS_URL unset → Direct execution (no queue, inline await)
 *
 * Usage:
 *   const job = await enqueuePipelineJob({ type: "blueprint-parse", ... });
 *   // Returns immediately. Worker picks up the job.
 *   // Poll GET /api/trpc/blueprintIngestion.getJobStatus?jobId=...
 */

import type { JobsOptions } from "bullmq";

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

export interface BlueprintParseJob {
  type: "blueprint-parse";
  documentId: number;
  artifactId: number;
  projectId: number;
  userId: number;
}

export interface BlueprintDetectJob {
  type: "blueprint-detect";
  documentId: number;
  projectId: number;
  userId: number;
}

export interface EstimateChainJob {
  type: "estimate-chain";
  documentId: number;
  projectId: number;
  symbolPackId: number;
  runId: number;
  userId: number;
  params?: {
    laborFactor?: number;
    wasteFactor?: number;
  };
}

export type PipelineJob = BlueprintParseJob | BlueprintDetectJob | EstimateChainJob;

// ---------------------------------------------------------------------------
// Queue name
// ---------------------------------------------------------------------------

export const PIPELINE_QUEUE_NAME = "pipeline";

// ---------------------------------------------------------------------------
// Default job options
// ---------------------------------------------------------------------------

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 3600, count: 1000 },  // Keep completed jobs 1 hour
  removeOnFail: { age: 86400, count: 5000 },      // Keep failed jobs 24 hours
};

// Timeout per job type (ms)
export const JOB_TIMEOUTS: Record<PipelineJob["type"], number> = {
  "blueprint-parse": 150_000,   // 2.5 min
  "blueprint-detect": 150_000,  // 2.5 min
  "estimate-chain": 210_000,    // 3.5 min
};

// ---------------------------------------------------------------------------
// Queue singleton
// ---------------------------------------------------------------------------

let _queue: any = null;
let _initPromise: Promise<any> | null = null;

async function getQueue(): Promise<any> {
  if (_queue) return _queue;
  if (_initPromise) return _initPromise;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null; // No Redis → direct execution

  _initPromise = (async () => {
    const { Queue } = await import("bullmq");
    const { default: IORedis } = await import("ioredis");
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    _queue = new Queue(PIPELINE_QUEUE_NAME, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    console.log("[pipelineQueue] BullMQ queue created with Redis backend");
    return _queue;
  })();

  return _initPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EnqueueResult {
  jobId: string;
  queued: boolean; // false = direct execution (no Redis)
}

/**
 * Enqueue a pipeline job. Returns a job ID immediately.
 *
 * If REDIS_URL is not set, returns { queued: false } — the caller should
 * fall back to inline execution.
 */
export async function enqueuePipelineJob(job: PipelineJob): Promise<EnqueueResult> {
  const queue = await getQueue();

  if (!queue) {
    // No Redis — return a synthetic ID, caller must execute inline
    return { jobId: `inline-${Date.now()}`, queued: false };
  }

  const bullJob = await queue.add(job.type, job, {
    ...DEFAULT_JOB_OPTIONS,
    jobId: `${job.type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
  });

  console.log(
    "[pipelineQueue] Job enqueued: %s id=%s",
    job.type,
    bullJob.id
  );

  return { jobId: bullJob.id!, queued: true };
}

/**
 * Get job status by ID.
 * Returns null if queue is not available (no Redis).
 */
export async function getJobStatus(jobId: string): Promise<{
  id: string;
  state: string;
  progress: number;
  failedReason?: string;
  returnValue?: any;
} | null> {
  const queue = await getQueue();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    id: job.id!,
    state,
    progress: typeof job.progress === "number" ? job.progress : 0,
    failedReason: job.failedReason ?? undefined,
    returnValue: job.returnvalue ?? undefined,
  };
}

/**
 * Check if BullMQ queue is healthy (Redis reachable).
 * Returns true if Redis is not configured (queue disabled).
 */
export async function isQueueHealthy(): Promise<boolean> {
  if (!process.env.REDIS_URL) return true;
  try {
    const queue = await getQueue();
    if (!queue) return true;
    // BullMQ Queue has a client we can ping
    await queue.client.then((c: any) => c.ping());
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully close the queue connection.
 */
export async function closeQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
    _initPromise = null;
    console.log("[pipelineQueue] Queue closed");
  }
}
