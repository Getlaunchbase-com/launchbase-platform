/**
 * AI Provider Factory
 * 
 * Transport layer for AI providers (aiml/memory/log).
 * Mirrors EMAIL_TRANSPORT pattern for deterministic testing.
 */

import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
import type { AiProvider, AiChatRequest, AiChatResponse, AiChatMessage } from "./types";
import { aimlProvider } from "./aimlProvider";
import { safeError, safePreview, toSafeClientMessage } from "../security/redaction";

// ============================================
// TRANSPORT TYPES
// ============================================

export type AiTransport = "aiml" | "memory" | "log" | "replay";

// ============================================
// MEMORY TRANSPORT (for tests)
// ============================================

/**
 * In-memory storage for deterministic test responses
 * Key: ${step}:${model}:${hash}
 */
const memoryStore = new Map<string, string>();

/**
 * Seed a response for memory transport using trace-based key (PREFERRED)
 * This is deterministic and doesn't depend on prompt content.
 */
export function seedMemoryTraceResponse(
  schema: string,
  model: string,
  jobId: string,
  round: number,
  response: string
): void {
  const key = `${schema}:${model}:${jobId}:${round}`;
  memoryStore.set(key, response);
}

/**
 * Seed a response for memory transport using hash-based key (LEGACY)
 * Kept for backward compatibility but brittle (depends on prompt rendering).
 * @deprecated Use seedMemoryTraceResponse instead
 */
export function seedMemoryResponse(
  step: string,
  model: string,
  userTextHash: string,
  response: string
): void {
  const key = `${step}:${model}:${userTextHash}`;
  memoryStore.set(key, response);
}

/**
 * Clear all memory responses (used in tests)
 */
export function clearMemoryResponses(): void {
  memoryStore.clear();
}

/**
 * Simple hash function for memory keys
 */
export function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

type TraceParsed = {
  jobId?: string;
  step?: string;
  schema?: string;
  round?: number;
  caps?: { roundLimit?: number; costCapUsd?: number };
};

function parseTrace(trace: unknown): TraceParsed {
  if (!trace) return {};

  // If object, return as-is
  if (typeof trace === "object") return trace as TraceParsed;

  if (typeof trace !== "string") return {};

  let s = trace.trim();

  // Attempt up to 2 parses to handle double-stringify
  for (let i = 0; i < 2; i++) {
    if (!(s.startsWith("{") || s.startsWith('"'))) break;
    try {
      const parsed = JSON.parse(s);
      if (typeof parsed === "string") {
        s = parsed.trim();
        continue; // try parsing again
      }
      return parsed as TraceParsed; // object
    } catch {
      break;
    }
  }

  return {};
}

function schemaFromTraceOrFallback(request: { trace?: any; model?: string }): string | undefined {
  // 1) Structured object: { schema, step, ... }
  if (request.trace && typeof request.trace === "object") {
    const t = request.trace as Record<string, unknown>;
    const schema = typeof t.schema === "string" ? t.schema : undefined;
    if (schema) return schema;

    // ✅ Key fix: step becomes schema for memory fixtures
    const step = typeof t.step === "string" ? t.step : undefined;
    if (step) {
      // Step → fixture schema mapping (workflow step names → output schema names)
      if (step === "generate_candidates") return "copy_proposal";
      if (step === "test") return "decision_collapse"; // Test fixture mapping
      return step;
    }
  }

  // 2) String trace fallback
  const traceStr =
    typeof request.trace === "string" ? request.trace : JSON.stringify(request.trace ?? "");

  // Include ALL task types we support
  if (traceStr.includes("test:test:1")) return "decision_collapse"; // Test fixture mapping
  if (traceStr.includes("intent_parse")) return "intent_parse";
  if (traceStr.includes("generate_candidates")) return "copy_proposal";
  if (traceStr.includes("copy_proposal")) return "copy_proposal";
  if (traceStr.includes("critique")) return "critique";
  if (traceStr.includes("decision_collapse")) return "decision_collapse";

  return undefined;
}

/**
 * Memory transport provider (deterministic, for tests)
 */
const memoryProvider: AiProvider = {
  async chat(req: AiChatRequest): Promise<AiChatResponse> {
    const { model, messages, trace } = req;
    const traceObj = parseTrace(trace);

    // Try trace-based key first (PREFERRED - deterministic, no prompt dependency)
    const schema = traceObj?.schema;
    const jobId = traceObj?.jobId;
    const round = traceObj?.round ?? 0;
    const traceKey = schema && jobId ? `${schema}:${model}:${jobId}:${round}` : null;

    let rawText: string | undefined;

    if (traceKey) {
      // Try exact match first
      rawText = memoryStore.get(traceKey);
      
      // DEBUG: Log lookup details
      const vitestWildcard = typeof process !== 'undefined' && (process.env.VITEST === 'true' || process.env.VITEST === '1');
      console.log("[memory] lookup", {
        schema,
        model,
        jobId,
        round,
        key: traceKey,
        vitestWildcard,
        seedCount: memoryStore.size,
        sampleKeys: Array.from(memoryStore.keys()).slice(0, 10),
        exactMatch: Boolean(rawText),
      });
      
      // Wildcard matching ONLY in tests (for unpredictable Date.now() jobIds)
      // Production code should use deterministic jobIds or mock Date.now()
      if (!rawText && schema && jobId && vitestWildcard) {
        for (const [key, value] of Array.from(memoryStore.entries())) {
          if (key.startsWith(`${schema}:${model}:`) && key.endsWith(`:${round}`)) {
            console.log("[memory] wildcard matched:", key);
            rawText = value;
            break;
          }
        }
      }
    }

    // Fallback to hash-based key (LEGACY - brittle but keeps old tests working)
    // WARNING: This uses prompt content for keys - deprecated, use trace-based seeding
    if (!rawText) {
      const userMessage = messages.find((m) => m.role === "user")?.content || "";
      const hash = simpleHash(userMessage);
      const hashKey = `${traceObj?.step || "unknown"}:${model}:${hash}`;
      rawText = memoryStore.get(hashKey);
    }

    if (!rawText) {
      // No seeded response found, return schema-based fixture

      // Schema-first routing
      const schemaRaw = schemaFromTraceOrFallback(req);
      const schema = schemaRaw ?? "v2"; // Default to v2 if undefined
      let fixture: any;

      switch (schema) {
        case "intent_parse":
          fixture = {
            schemaVersion: "v1",
            intentType: "COPY_CHANGE",
            targetKeys: ["hero.headline"],
            userText: "I want to rewrite my homepage copy",
            proposedDirection: "Rewrite homepage copy to be more engaging",
            needsHuman: false,
            confidence: 0.95,
            requiresApproval: true,
          };
          break;

        case "copy_proposal":
          fixture = {
            schemaVersion: "v1",
            requiresApproval: true,
            variants: [
              {
                targetKey: "hero.headline",
                value: "Transform Your Business",
                rationale: "Clear, benefit-led headline for above-the-fold.",
                confidence: 0.9,
                risks: [],
              },
            ],
            confidence: 0.9,
            risks: [],
            assumptions: ["User wants homepage hero copy rewrite"],
          };
          break;

        case "critique":
          fixture = {
            schemaVersion: "v1",
            pass: true,
            issues: [],
            suggestedFixes: [],
            confidence: 0.85,
            requiresApproval: true,
            evaluationCriteria: {
              clarity: 0.8,
              trust: 0.8,
              scanability: 0.8,
              mobileFold: 0.8,
              sectionContractCompliance: 0.8,
            },
          };
          break;

        case "decision_collapse": {
          const caps = traceObj?.caps ?? {};
          const roundLimit = Math.max(0, Math.min(2, Number(caps.roundLimit ?? 2)));
          const costCapUsd = Math.max(0, Math.min(10, Number(caps.costCapUsd ?? 2)));

          fixture = {
            schemaVersion: "v1",
            selectedProposal: {
              type: "copy",
              targetKey: "hero.headline",
              value: "Transform Your Business",
            },
            reason: "Best balance of clarity and impact.",
            approvalText: "Approve updated hero headline.",
            previewRecommended: true,
            needsHuman: false,
            confidence: 0.9,
            requiresApproval: true,
            roundLimit,
            costCapUsd,
          };
          break;
        }

        case "v2":
          // Generic v2 fixture for tests that don't specify a schema
          fixture = {
            schemaVersion: "v2",
            success: true,
            message: "Memory provider generic v2 response",
            data: {},
          };
          break;

        default:
          throw new Error("SENTINEL::MEMORY_PROVIDER_DEFAULT_BRANCH::v2 (schema: " + schema + ")");
      }

      return {
        rawText: JSON.stringify(fixture),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
        providerMeta: {
          requestId: `memory-${Date.now()}`,
          model: `memory:${schema ?? "none"}`,
          finishReason: "stop",
        } as any,
      };
    }

    // Response found and will be returned

    return {
      rawText,
      usage: {
        inputTokens: 100, // Fake
        outputTokens: 200, // Fake
      },
      providerMeta: {
        requestId: `memory-${Date.now()}`,
        model,
        finishReason: "stop",
      },
    };
  },
};

// ============================================
// REPLAY TRANSPORT (for swarm deterministic testing)
// ============================================

// Module-level singleton to preserve counter state across calls
let _replayProvider: AiProvider | null = null;

export function __resetReplayProviderForTests() {
  _replayProvider = null;
}

function createReplayProvider(): AiProvider {
  const replayId = process.env.SWARM_REPLAY_RUN_ID ?? process.env.REPLAY_ID ?? "apply_ok"; // fallback for backward compat
  const baseDir = nodePath.resolve(process.cwd(), "server/ai/engine/__tests__/fixtures/swarm/replays");
  const recordMode = process.env.SWARM_RECORD === "1";
  const allowOverwrite = process.env.SWARM_RECORD_ALLOW_OVERWRITE === "1";
  
  // Per-instance counters (fresh per test)
  const counters: Record<string, number> = {};
  
  function nextIndex(runId: string, role: string): number {
    const key = `${runId}:${role}`;
    const idx = counters[key] ?? 0;
    counters[key] = idx + 1;
    return idx;
  }
  
  function loadFixture(role: string, idx: number): any {
    const filePath = nodePath.join(baseDir, replayId, `${role}.json`);
    
    if (!nodeFs.existsSync(filePath)) {
      throw new Error(`[replay] missing fixture: ${filePath}`);
    }
    
    const raw = nodeFs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    
    // Support single object or array
    if (Array.isArray(data)) {
      if (data.length === 0) throw new Error(`[replay] empty fixture array: ${filePath}`);
      const picked = data[Math.min(idx, data.length - 1)];
      if (idx >= data.length) {
        console.warn(`[replay] ${role} exhausted; clamping to last entry`);
      }
      return picked;
    }
    
    return data;
  }
  
  async function recordFixture(role: string, idx: number, response: AiChatResponse): Promise<void> {
    const filePath = nodePath.join(baseDir, replayId, `${role}.json`);
    const dir = nodePath.dirname(filePath);
    
    // Ensure directory exists
    if (!nodeFs.existsSync(dir)) {
      nodeFs.mkdirSync(dir, { recursive: true });
    }
    
    // Read existing fixtures (if any)
    let existingData: any[] = [];
    if (nodeFs.existsSync(filePath)) {
      // Safety: refuse to overwrite unless explicitly allowed
      if (!allowOverwrite && idx === 0) {
        throw new Error(
          `[replay:record] Fixture already exists: ${filePath}\n` +
          `Set SWARM_RECORD_ALLOW_OVERWRITE=1 to overwrite, or use a different SWARM_REPLAY_RUN_ID`
        );
      }
      
      const raw = nodeFs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      existingData = Array.isArray(data) ? data : [data];
    }
    
    // Parse response to get artifact structure
    let artifact: any;
    try {
      artifact = JSON.parse(response.rawText);
    } catch {
      artifact = { rawText: response.rawText };
    }
    
    // Append new response
    existingData.push(artifact);
    
    // Write back to disk
    nodeFs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), "utf-8");
    console.log(`[replay:record] Wrote fixture: ${filePath} (entry ${idx})`);
  }
  
  return {
    async chat(options: AiChatRequest): Promise<AiChatResponse> {
      // Extract role from trace (explicit or fallback)
      const role =
        options.trace?.role ??
        options.trace?.step?.split(".").pop();
      
      if (!role) {
        throw new Error("[replay] missing trace.role and cannot infer from trace.step");
      }
      
      const runId = options.trace?.replayRunId ?? options.trace?.jobId ?? "default";
      const idx = nextIndex(runId, role);
      
      // RECORD MODE: Call upstream AIML provider and save response
      if (recordMode) {
        console.log(`[replay:record] id=${replayId} run=${runId} role=${role} idx=${idx}`);
        
        // Call real AIML provider
        const response = await aimlProvider.chat(options);
        
        // Save to fixture folder
        await recordFixture(role, idx, response);
        
        return response;
      }
      
      // REPLAY MODE: Load fixture from disk
      console.log(`[replay] id=${replayId} run=${runId} role=${role} idx=${idx}`);
      
      const fixture = loadFixture(role, idx);
      
      return {
        rawText: JSON.stringify(fixture),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
        providerMeta: {
          requestId: `replay-${Date.now()}`,
          model: `replay:${role}`,
          finishReason: "stop",
        },
      };
    },
  };
}

// ============================================
// LOG TRANSPORT (for debugging)
// ============================================

/**
 * Log transport provider (prints request, returns invalid JSON)
 */
const logProvider: AiProvider = {
  async chat(req: AiChatRequest): Promise<AiChatResponse> {
    console.log("[AI:log] Chat request", {
      model: req.model,
      messageCount: req.messages.length,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      trace: req.trace,
      messages: req.messages.map((m) => ({
        role: m.role,
        contentLength: m.content.length,
        contentPreview: m.content.slice(0, 100),
      })),
    });

    // Return empty JSON (will fail validation to catch quickly)
    return {
      rawText: "{}",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
      providerMeta: {
        requestId: `log-${Date.now()}`,
        model: req.model,
        finishReason: "stop",
      },
    };
  },
};

// ============================================
// FACTORY
// ============================================

/**
 * Get AI provider based on transport configuration
 * 
 * @param transport - Transport type (default: from env AI_TRANSPORT or "aiml")
 * @returns AiProvider instance
 */
export function getAiProvider(transport?: AiTransport): AiProvider {
  // Read from env at call time (not module load time) so tests can override
  const selectedTransport = transport || (process.env.AI_PROVIDER as AiTransport) || "aiml";

  switch (selectedTransport) {
    case "aiml":
      return aimlProvider;

    case "memory":
      return memoryProvider;

    case "log":
      return logProvider;

    case "replay":
      if (!_replayProvider) {
        _replayProvider = createReplayProvider();
      }
      return _replayProvider;

    default:
      console.warn(`[AI] Unknown transport: ${selectedTransport}, falling back to aiml`);
      return aimlProvider;
  }
}

/**
 * Get current transport name
 */
export function getCurrentTransport(): AiTransport {
  return (process.env.AI_PROVIDER as AiTransport) || "aiml";
}

// ============================================
// HIGH-LEVEL WRAPPER (completeJson)
// ============================================

/**
 * CompleteJson request options
 */
export interface CompleteJsonOptions {
  model: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  trace: {
    jobId: string;
    step: string;
    round: number;
    role?: string; // explicit role for replay provider
    replayRunId?: string; // stable per job for counter isolation
  };
}

/**
 * CompleteJson response
 */
export interface CompleteJsonResult {
  rawText: string;
  json: any | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  meta: {
    provider: string;
    model: string;
    requestId: string;
    finishReason: string;
  };
  cost: {
    estimatedUsd: number;
    creditsUsed: number | null;
  };
  latencyMs: number;
  attemptedModels?: string[];
  failureReasons?: Record<string, string>;
}

/**
 * High-level wrapper that calls provider.chat() and parses JSON
 * 
 * This is the interface tests and orchestrators should use.
 * 
 * Supports optional ModelRouter integration for automatic failover.
 */
export async function completeJson(
  options: CompleteJsonOptions,
  transport?: AiTransport,
  routerOpts?: { task?: string; useRouter?: boolean; strict?: boolean }
): Promise<CompleteJsonResult> {
  const selectedTransport = transport || (process.env.AI_PROVIDER as AiTransport) || "aiml";
  const provider = getAiProvider(selectedTransport);
  const startTime = Date.now();

  const trace = `${options.trace.jobId}:${options.trace.step}:${options.trace.round}`;
  const role = options.trace.role || routerOpts?.task || "generic";
  
  // Extract repairId from jobId (format: repair_<timestamp>)
  const repairId = options.trace.jobId.startsWith('repair_') 
    ? options.trace.jobId 
    : `repair_${options.trace.jobId}`;

  // If router enabled and transport is aiml, use withModelFallback for health-aware routing
  if (routerOpts?.useRouter && selectedTransport === "aiml") {
    try {
      const { withModelFallback } = await import("../modelRouting/withModelFallback");
      const { buildCandidates } = await import("../modelRouting/modelChains");
      
      // Build candidate list: primary + role-aware fallbacks
      const candidates = buildCandidates(options.model, role);
      const primary = candidates[0];
      const fallbacks = candidates.slice(1);
      
      console.log(`[completeJson] Using health-aware routing for ${role}`, {
        trace,
        primary,
        fallbacks,
      });
      
      // Wrap provider call with health-aware fallback
      const result = await withModelFallback({
        primary,
        fallbacks,
        call: async (modelId: string) => {
          return await provider.chat({
            ...options,
            model: modelId,
            jsonOnly: true,
          });
        },
        maxAttempts: 3,
        timeoutMs: 120000, // 120s timeout for swarm calls
        context: `${role}:${trace}`,
      });

      const latencyMs = Date.now() - startTime;
      const baseResult = buildCompleteJsonResult(
        result.response,
        result.selectedModel,
        selectedTransport,
        latencyMs,
        trace
      );
      
      // Write attempt artifact
      writeAttemptArtifact({
        repairId,
        trace: options.trace,
        role,
        requestedModel: options.model,
        attemptedModels: result.attemptedModels,
        failureReasons: result.failureReasons,
        selectedModel: result.selectedModel,
        latencyMs,
        error: null,
      });
      
      // Add fallback metadata
      return {
        ...baseResult,
        attemptedModels: result.attemptedModels,
        failureReasons: result.failureReasons,
      };
    } catch (err) {
      // Do NOT log raw error object.
      const e = safeError(err);
      console.warn("[AI] withModelFallback failed", {
        trace,
        transport: selectedTransport,
        requestedModel: options.model,
        role,
        error: e,
      });

      // STRICT MODE: no fallback
      if (routerOpts.strict) {
        throw new Error(toSafeClientMessage({ trace, hint: "router_strict" }));
      }
      // Non-strict fallback continues below.
    }
  }

  // Call provider directly (no router)
  try {
    console.log("[completeJson] calling provider.chat (direct)", {
      transport: selectedTransport,
      provider: provider?.constructor?.name || "unknown",
      trace,
      model: options.model,
    });
    const response = await provider.chat({
      ...options,
      jsonOnly: true,
    });

    const latencyMs = Date.now() - startTime;
    const finalResult = buildCompleteJsonResult(response, options.model, selectedTransport, latencyMs, trace);
    
    // Write attempt artifact (direct call, no fallback)
    writeAttemptArtifact({
      repairId,
      trace: options.trace,
      role,
      requestedModel: options.model,
      attemptedModels: [options.model],
      failureReasons: {},
      selectedModel: options.model,
      latencyMs,
      error: null,
    });
    
    return finalResult;
  } catch (err) {
    // Ensure we never leak provider message details to callers up-stack.
    const e = safeError(err);
    console.error("[AI] Provider chat failed", {
      trace,
      transport: selectedTransport,
      model: options.model,
      error: e,
    });
    
    // Write attempt artifact (failure)
    const latencyMs = Date.now() - startTime;
    writeAttemptArtifact({
      repairId,
      trace: options.trace,
      role,
      requestedModel: options.model,
      attemptedModels: [options.model],
      failureReasons: { [options.model]: e.message || 'Provider call failed' },
      selectedModel: null,
      latencyMs,
      error: e.message || 'Provider call failed',
    });
    
    throw new Error(toSafeClientMessage({ trace }));
  }
}

/**
 * Write attempt metadata to artifact file (JSONL format)
 */
function writeAttemptArtifact(data: {
  repairId: string;
  trace: { jobId: string; step: string; round: number; role?: string };
  role: string;
  requestedModel: string;
  attemptedModels: string[];
  failureReasons: Record<string, string>;
  selectedModel: string | null;
  latencyMs: number;
  error: string | null;
}): void {
  try {
    // Determine output directory
    const outDir = nodePath.join(process.cwd(), "runs", "repair", data.repairId);
    
    // Create directory if it doesn't exist
    if (!nodeFs.existsSync(outDir)) {
      nodeFs.mkdirSync(outDir, { recursive: true });
    }
    
    // Write breadcrumb to prove function was called
    const breadcrumbFile = nodePath.join(outDir, ".attempts_called");
    nodeFs.writeFileSync(breadcrumbFile, Date.now().toString(), "utf8");
    
    // Build JSONL line
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      jobId: data.trace.jobId,
      step: data.trace.step,
      round: data.trace.round,
      role: data.role,
      requestedModel: data.requestedModel,
      attemptedModels: data.attemptedModels,
      failureReasons: data.failureReasons,
      selectedModel: data.selectedModel,
      latencyMs: data.latencyMs,
      error: data.error,
    }) + "\n";
    
    // Append to attempts.jsonl
    const attemptsFile = nodePath.join(outDir, "attempts.jsonl");
    nodeFs.appendFileSync(attemptsFile, line, "utf8");
  } catch (err: any) {
    // Write error to attempts.error.jsonl for debugging
    try {
      const outDir = nodePath.join(process.cwd(), "runs", "repair", data.repairId);
      const errorFile = nodePath.join(outDir, "attempts.error.jsonl");
      const errorLine = JSON.stringify({
        ts: new Date().toISOString(),
        error: String(err),
        stack: err?.stack,
        data,
      }) + "\n";
      nodeFs.appendFileSync(errorFile, errorLine, "utf8");
    } catch {
      // If even error logging fails, silently continue
    }
  }
}

/**
 * Helper to build CompleteJsonResult from provider response
 */
function buildCompleteJsonResult(
  response: AiChatResponse,
  model: string,
  transport: string,
  latencyMs: number,
  trace?: string
): CompleteJsonResult {
  let json: any | null = null;

  // Strip markdown code blocks if present (common with Llama models)
  let textToParse = response.rawText;
  const mdJsonMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdJsonMatch) {
    textToParse = mdJsonMatch[1].trim();
  }

  try {
    json = JSON.parse(textToParse);
  } catch (err) {
    // NEVER log rawText preview. Log only a hash + length.
    console.warn("[AI] Failed to parse JSON response", {
      trace,
      model: response.providerMeta?.model || model,
      requestId: response.providerMeta?.requestId || "unknown",
      rawText: safePreview(response.rawText),
      error: safeError(err),
    });
  }

  // Calculate cost (rough estimate for now)
  const inputTokens = response.usage?.inputTokens || 0;
  const outputTokens = response.usage?.outputTokens || 0;
  const estimatedUsd = (inputTokens * 0.00001 + outputTokens * 0.00003); // Rough GPT-4o-mini pricing

  return {
    rawText: response.rawText,
    json,
    usage: {
      inputTokens,
      outputTokens,
    },
    meta: {
      provider: transport,
      model: response.providerMeta?.model || model,
      requestId: response.providerMeta?.requestId || "unknown",
      finishReason: response.providerMeta?.finishReason || "unknown",
    },
    cost: {
      estimatedUsd,
      creditsUsed: null, // TODO: Extract from AIML response headers
    },
    latencyMs,
  };
}
