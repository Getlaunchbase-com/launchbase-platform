/**
 * ModelRegistry Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelRegistry } from "../modelRegistry";

describe("ModelRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refresh populates cache", async () => {
    const openaiClient: any = {
      models: {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: "gpt-test-1",
              type: "text",
              info: { contextLength: 16000, developer: "OpenAI" },
              features: { json_schema: true, structured_outputs: true },
            },
          ],
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 1000, openaiClient });
    await reg.refresh(true);

    expect(reg.list().length).toBe(1);
    expect(reg.get("gpt-test-1")?.features).toContain("json_schema");
    expect(reg.get("gpt-test-1")?.features).toContain("structured_outputs");
    expect(reg.get("gpt-test-1")?.contextLength).toBe(16000);
  });

  it("denylist excludes models", async () => {
    const openaiClient: any = {
      models: {
        list: vi.fn().mockResolvedValue({
          data: [
            { id: "blocked-model", type: "text" },
            { id: "allowed-model", type: "text" },
          ],
        }),
      },
    };

    const reg = new ModelRegistry({
      ttlMs: 1000,
      denylist: ["blocked-model"],
      openaiClient,
    });
    await reg.refresh(true);

    expect(reg.list().length).toBe(1);
    expect(reg.get("blocked-model")).toBeNull();
    expect(reg.get("allowed-model")).toBeTruthy();
  });

  it("keeps last known good on failure", async () => {
    let callCount = 0;
    const openaiClient: any = {
      models: {
        list: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return { data: [{ id: "model-1", type: "text" }] };
          }
          throw new Error("API failure");
        }),
      },
    };

    const reg = new ModelRegistry({ ttlMs: 100, openaiClient });

    // First refresh succeeds
    await reg.refresh(true);
    expect(reg.list().length).toBe(1);
    expect(reg.snapshot.stale).toBe(false);

    // Second refresh fails but keeps cache
    await reg.refresh(true);
    expect(reg.list().length).toBe(1); // Still has model-1
    expect(reg.snapshot.stale).toBe(true);
    expect(reg.snapshot.lastError).toContain("API failure");
  });

  it("respects TTL and doesn't refresh unnecessarily", async () => {
    const listFn = vi.fn().mockResolvedValue({
      data: [{ id: "model-1", type: "text" }],
    });

    const openaiClient: any = {
      models: { list: listFn },
    };

    const reg = new ModelRegistry({ ttlMs: 10000, openaiClient }); // 10 second TTL

    // First refresh
    await reg.refresh(false);
    expect(listFn).toHaveBeenCalledTimes(1);

    // Second refresh within TTL - should skip
    await reg.refresh(false);
    expect(listFn).toHaveBeenCalledTimes(1); // Still 1

    // Force refresh ignores TTL
    await reg.refresh(true);
    expect(listFn).toHaveBeenCalledTimes(2);
  });
});
