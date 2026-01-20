import fs from "node:fs";
import path from "node:path";

type Json = any;

/**
 * Replay Provider with Recording Mode
 * 
 * Two modes:
 * 1. REPLAY (default): Read fixtures from disk deterministically
 * 2. RECORD (SWARM_RECORD=1): Write AI responses to fixture folder
 * 
 * Recording uses the same naming convention as replay for seamless integration.
 */

interface ReplayProviderOptions {
  baseDir: string; // e.g. server/ai/engine/__tests__/fixtures/swarm/replays
  replayId: string; // apply_ok | reject_ok | revise_then_apply | custom scenario name
  mode?: "replay" | "record"; // default: replay
  upstreamProvider?: (args: any) => Promise<Json>; // required for record mode
}

interface CompleteJsonArgs {
  role: string;
  replayRunId?: string;
  [key: string]: any;
}

function readJson(filePath: string): Json {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[replay] Fixture not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeJson(filePath: string, data: Json): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`[replay:record] Wrote fixture: ${filePath}`);
}

/**
 * Create replay provider instance
 * 
 * Supports both replay (read fixtures) and record (write fixtures) modes.
 */
export function createReplayProvider(opts: ReplayProviderOptions) {
  const mode = opts.mode ?? "replay";
  const counters = new Map<string, number>(); // key: ${replayRunId}:${role}

  function getCounterKey(role: string, replayRunId?: string): string {
    return replayRunId ? `${replayRunId}:${role}` : role;
  }

  function getCounter(role: string, replayRunId?: string): number {
    const key = getCounterKey(role, replayRunId);
    return counters.get(key) ?? 0;
  }

  function incrementCounter(role: string, replayRunId?: string): void {
    const key = getCounterKey(role, replayRunId);
    counters.set(key, getCounter(role, replayRunId) + 1);
  }

  /**
   * Load fixture for a role (replay mode)
   */
  function loadRolePayload(role: string, replayRunId?: string): Json {
    const idx = getCounter(role, replayRunId);
    const filePath = path.join(opts.baseDir, opts.replayId, `${role}.json`);
    
    console.log(`[replay] id=${opts.replayId} run=${replayRunId ?? "default"} role=${role} idx=${idx}`);
    
    const data = readJson(filePath);

    // Allow either single object or array of objects (for iteration)
    if (Array.isArray(data)) {
      const picked = data[Math.min(idx, data.length - 1)];
      incrementCounter(role, replayRunId);
      return picked;
    }

    // Single object (no iteration)
    return data;
  }

  /**
   * Save fixture for a role (record mode)
   */
  async function saveRolePayload(role: string, args: CompleteJsonArgs, response: Json): Promise<void> {
    const idx = getCounter(role, args.replayRunId);
    const filePath = path.join(opts.baseDir, opts.replayId, `${role}.json`);

    // Read existing file if it exists (to append to array)
    let existingData: Json[] = [];
    if (fs.existsSync(filePath)) {
      const raw = readJson(filePath);
      existingData = Array.isArray(raw) ? raw : [raw];
    }

    // Append new response
    existingData.push(response);

    // Write back to disk
    writeJson(filePath, existingData);
    incrementCounter(role, args.replayRunId);
  }

  /**
   * completeJson implementation
   * 
   * Replay mode: Load fixture from disk
   * Record mode: Call upstream provider and save response
   */
  async function completeJson(args: CompleteJsonArgs): Promise<Json> {
    const role = args.role ?? "unknown";

    if (mode === "record") {
      if (!opts.upstreamProvider) {
        throw new Error("[replay:record] upstreamProvider required for record mode");
      }

      // Call upstream provider (real AI)
      const response = await opts.upstreamProvider(args);

      // Save to fixture folder
      await saveRolePayload(role, args, response);

      return response;
    }

    // Default: replay mode (read from disk)
    return loadRolePayload(role, args.replayRunId);
  }

  return {
    completeJson,
  };
}

/**
 * Legacy export for backward compatibility
 */
export function makeReplayProvider(opts: {
  baseDir: string;
  replayId: string;
}) {
  return createReplayProvider(opts);
}
