/**
 * ModelPolicy Tests
 */

import { describe, it, expect } from "vitest";
import { ModelRegistry } from "../modelRegistry";
import { ModelPolicy } from "../modelPolicy";

describe("ModelPolicy", () => {
  it("filters by type constraint", async () => {
    const openaiClient: any = {
      models: {
        list: async () => ({
          data: [
            { id: "gpt-4o", type: "text", info: { contextLength: 128000 } },
            { id: "text-embedding-3", type: "embedding" },
            { id: "dall-e-3", type: "image" },
          ],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    const policy = new ModelPolicy(reg);
    const resolution = policy.resolve("chat"); // chat requires type: text

    expect(resolution.primary.type).toBe("text");
    expect(resolution.primary.id).toBe("gpt-4o");
    expect(resolution.reason.filteredOut.type).toBeGreaterThan(0); // embedding + image filtered
  });

  it("filters by context length", async () => {
    const openaiClient: any = {
      models: {
        list: async () => ({
          data: [
            { id: "gpt-4o", type: "text", info: { contextLength: 128000 } },
            { id: "gpt-3.5-turbo", type: "text", info: { contextLength: 4096 } },
          ],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    const policy = new ModelPolicy(reg);
    const resolution = policy.resolve("chat"); // chat requires minContextLength: 16000

    expect(resolution.primary.id).toBe("gpt-4o");
    expect(resolution.reason.filteredOut.context).toBe(1); // gpt-3.5-turbo filtered
  });

  it("filters by required features", async () => {
    const openaiClient: any = {
      models: {
        list: async () => ({
          data: [
            {
              id: "gpt-4o",
              type: "text",
              info: { contextLength: 128000 },
              features: { json_schema: true, structured_outputs: true },
            },
            {
              id: "gpt-3.5-turbo",
              type: "text",
              info: { contextLength: 16000 },
              features: {},
            },
          ],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    const policy = new ModelPolicy(reg);
    const resolution = policy.resolve("json"); // json requires json_schema + structured_outputs

    expect(resolution.primary.id).toBe("gpt-4o");
    expect(resolution.reason.filteredOut.features).toBe(1); // gpt-3.5-turbo filtered
  });

  it("ranks by preference patterns", async () => {
    const openaiClient: any = {
      models: {
        list: async () => ({
          data: [
            { id: "gpt-4o-2024-11-20", type: "text", info: { contextLength: 128000 } },
            { id: "gpt-4o-mini", type: "text", info: { contextLength: 128000 } },
            { id: "gpt-3.5-turbo", type: "text", info: { contextLength: 16000 } },
          ],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    const policy = new ModelPolicy(reg);
    const resolution = policy.resolve("chat"); // chat prefers "gpt-4o*"

    expect(resolution.primary.id).toContain("gpt-4o");
    expect(resolution.fallbacks.length).toBeGreaterThan(0);
  });

  it("throws when no eligible models", async () => {
    const openaiClient: any = {
      models: {
        list: async () => ({
          data: [{ id: "dall-e-3", type: "image" }],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    const policy = new ModelPolicy(reg);

    expect(() => policy.resolve("chat")).toThrow("No eligible models");
  });
});
