/**
 * Model Router
 * 
 * Per-request failover with telemetry when "model not found" errors occur.
 */

import { ModelPolicy } from "./modelPolicy";
import { ModelRegistry } from "./modelRegistry";
import { ModelConstraints } from "./modelRouting.types";

export type Telemetry = {
  modelFailover: (evt: { from?: string; to: string; task: string; error: string }) => void;
  modelRequest: (evt: { requested?: string; resolved: string; task: string; attempts: number }) => void;
};

export type RouteOpts = {
  task: string;
  requestedModelId?: string;
  constraints?: Partial<ModelConstraints>;
  maxAttempts?: number; // default 3
};

export type ProviderCall<T> = (modelId: string) => Promise<T>;

function isModelNotFoundError(e: any): boolean {
  const msg = (e?.message ?? String(e)).toLowerCase();
  // Expand as you observe AIML error patterns
  return (
    msg.includes("model not found") ||
    msg.includes("no such model") ||
    msg.includes("does not exist") ||
    msg.includes("unavailable") ||
    msg.includes("deprecated")
  );
}

export class ModelRouter {
  constructor(
    private registry: ModelRegistry,
    private policy: ModelPolicy,
    private telemetry?: Telemetry
  ) {}

  async route<T>(opts: RouteOpts, callProvider: ProviderCall<T>): Promise<T> {
    // ensure registry is warm (non-blocking if cache fresh)
    await this.registry.refresh(false);

    const resolution = this.policy.resolve(opts.task, opts.constraints);
    const candidateIds: string[] = [];

    if (opts.requestedModelId) candidateIds.push(opts.requestedModelId);
    candidateIds.push(resolution.primary.id, ...resolution.fallbacks.map((m) => m.id));

    // de-dupe while preserving order
    const uniq = Array.from(new Set(candidateIds));

    const maxAttempts = opts.maxAttempts ?? 3;
    const attemptList = uniq.slice(0, maxAttempts);

    let lastErr: any;

    for (let i = 0; i < attemptList.length; i++) {
      const modelId = attemptList[i];

      // Validate if requested explicitly
      if (opts.requestedModelId && modelId === opts.requestedModelId) {
        const exists = this.registry.get(modelId);
        if (!exists) {
          // treat missing as immediate failover, no provider call
          this.telemetry?.modelFailover({
            from: modelId,
            to: resolution.primary.id,
            task: opts.task,
            error: "requested_model_not_in_registry",
          });
          continue;
        }
      }

      try {
        const out = await callProvider(modelId);
        this.telemetry?.modelRequest({
          requested: opts.requestedModelId,
          resolved: modelId,
          task: opts.task,
          attempts: i + 1,
        });
        return out;
      } catch (e: any) {
        lastErr = e;
        if (isModelNotFoundError(e)) {
          const next = attemptList[i + 1];
          if (next) {
            this.telemetry?.modelFailover({
              from: modelId,
              to: next,
              task: opts.task,
              error: e?.message ?? String(e),
            });
            continue;
          }
        }
        throw e;
      }
    }

    throw lastErr ?? new Error("ModelRouter exhausted attempts");
  }
}
