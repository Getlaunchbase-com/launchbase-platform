/**
 * ModelRouter Failover Tests
 */

import { describe, it, expect } from "vitest";
import { ModelRegistry } from "../modelRegistry";
import { ModelPolicy } from "../modelPolicy";
import { ModelRouter } from "../modelRouter";

describe("ModelRouter", () => {
  it("fails over on model-not-found", async () => {
    const openaiClient: any = {
      models: {
        list: async () => ({
          data: [
            { id: "m1", type: "text", info: { contextLength: 16000 } },
            { id: "m2", type: "text", info: { contextLength: 16000 } },
          ],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    const policy = new ModelPolicy(reg);
    const telemetryEvents: any[] = [];
    const router = new ModelRouter(reg, policy, {
      modelFailover: (e) => telemetryEvents.push(e),
      modelRequest: () => {},
    });

    const result = await router.route(
      { task: "chat", requestedModelId: "m1", maxAttempts: 2 },
      async (modelId) => {
        if (modelId === "m1") throw new Error("model not found");
        return { ok: true, modelId };
      }
    );

    expect(result.ok).toBe(true);
    expect(result.modelId).toBe("m2");
    expect(telemetryEvents.length).toBeGreaterThan(0);
    expect(telemetryEvents[0].from).toBe("m1");
    expect(telemetryEvents[0].to).toBe("m2");
  });

  it("uses primary when requested model succeeds", async () => {
    const openaiClient: any = {
      models: {
        list: async () => ({
          data: [{ id: "gpt-4o-mini", type: "text", info: { contextLength: 16000 } }],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    const policy = new ModelPolicy(reg);
    const requestEvents: any[] = [];
    const router = new ModelRouter(reg, policy, {
      modelFailover: () => {},
      modelRequest: (e) => requestEvents.push(e),
    });

    const result = await router.route(
      { task: "chat", requestedModelId: "gpt-4o-mini" },
      async (modelId) => {
        return { ok: true, modelId };
      }
    );

    expect(result.ok).toBe(true);
    expect(result.modelId).toBe("gpt-4o-mini");
    expect(requestEvents.length).toBe(1);
    expect(requestEvents[0].resolved).toBe("gpt-4o-mini");
    expect(requestEvents[0].attempts).toBe(1);
  });

  it("exhausts attempts and throws", async () => {
    const openaiClient: any = {
      models: {
        list: async () => ({
          data: [
            { id: "m1", type: "text", info: { contextLength: 16000 } },
            { id: "m2", type: "text", info: { contextLength: 16000 } },
          ],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    const policy = new ModelPolicy(reg);
    const router = new ModelRouter(reg, policy);

    await expect(
      router.route({ task: "chat", maxAttempts: 2 }, async () => {
        throw new Error("model not found");
      })
    ).rejects.toThrow("model not found");
  });

  it("skips requested model if not in registry", async () => {
    const openaiClient: any = {
      models: {
        list: async () => ({
          data: [{ id: "m2", type: "text", info: { contextLength: 16000 } }],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    const policy = new ModelPolicy(reg);
    const failoverEvents: any[] = [];
    const router = new ModelRouter(reg, policy, {
      modelFailover: (e) => failoverEvents.push(e),
      modelRequest: () => {},
    });

    const result = await router.route(
      { task: "chat", requestedModelId: "missing-model" },
      async (modelId) => {
        return { ok: true, modelId };
      }
    );

    expect(result.ok).toBe(true);
    expect(result.modelId).toBe("m2");
    expect(failoverEvents.length).toBe(1);
    expect(failoverEvents[0].from).toBe("missing-model");
    expect(failoverEvents[0].error).toBe("requested_model_not_in_registry");
  });
});
