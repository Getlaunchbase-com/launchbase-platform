/**
 * Model Registry
 * 
 * Calls AIML /v1/models, caches with TTL, refreshes in background.
 * Keeps "last known good" on failure.
 */

import OpenAI from "openai";
import { NormalizedModel, ModelRegistryState, ModelType } from "./modelRouting.types";
import { normalizeFeatures, inferTypeFromId } from "./modelNormalize";

export type ModelRegistryOpts = {
  ttlMs: number;
  denylist?: string[];
  openaiClient: OpenAI;
  logger?: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void };
};

// inferTypeFromId moved to modelNormalize.ts for testability

/**
 * Normalizes OpenAI-compatible /models payload:
 * openai.models.list() returns { data: Array<{id, ...}> }
 * AIML may include vendor-specific fields; keep in raw.
 */
function normalizeModel(raw: any): NormalizedModel {
  const id = String(raw.id);
  const info = raw.info ?? {};
  
  const features = normalizeFeatures(raw.features);

  return {
    id,
    type: (raw.type as ModelType) ?? inferTypeFromId(id),
    developer: info.developer ?? raw.developer,
    name: info.name ?? raw.name,
    description: info.description ?? raw.description,
    contextLength: info.contextLength ?? raw.context_length ?? raw.contextLength,
    features,
    url: info.url ?? raw.url,
    raw,
  };
}

export class ModelRegistry {
  private state: ModelRegistryState = { models: new Map(), stale: true };
  private lastFetchAt = 0;
  private inflight?: Promise<void>;

  constructor(private opts: ModelRegistryOpts) {}

  get snapshot(): ModelRegistryState {
    return this.state;
  }

  get(id: string): NormalizedModel | null {
    return this.state.models.get(id) ?? null;
  }

  list(): NormalizedModel[] {
    return Array.from(this.state.models.values());
  }

  /**
   * Refresh if TTL expired, otherwise no-op (unless force=true).
   */
  async refresh(force = false): Promise<void> {
    const now = Date.now();
    const age = now - this.lastFetchAt;
    if (!force && age < this.opts.ttlMs && this.state.models.size > 0) return;

    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        const resp = await this.opts.openaiClient.models.list();
        const rawModels = (resp as any).data ?? [];
        const deny = new Set(this.opts.denylist ?? []);

        const next = new Map<string, NormalizedModel>();
        for (const raw of rawModels) {
          const m = normalizeModel(raw);
          if (deny.has(m.id)) continue;
          next.set(m.id, m);
        }

        // only replace cache if we got something usable
        if (next.size > 0) {
          this.state = {
            models: next,
            lastRefreshAt: now,
            stale: false,
            lastError: undefined,
          };
          this.lastFetchAt = now;
          this.opts.logger?.info?.(`[ModelRegistry] refreshed: ${next.size} models`);
        } else {
          this.state = {
            ...this.state,
            stale: true,
            lastError: "refresh returned empty model list",
            lastRefreshAt: now,
          };
          this.opts.logger?.warn?.(`[ModelRegistry] refresh returned empty list; keeping previous cache`);
        }
      } catch (e: any) {
        this.state = {
          ...this.state,
          stale: true,
          lastError: e?.message ?? String(e),
          lastRefreshAt: now,
        };
        this.opts.logger?.error?.(`[ModelRegistry] refresh failed; keeping last known good`, e);
      } finally {
        this.inflight = undefined;
      }
    })();

    return this.inflight;
  }
}
