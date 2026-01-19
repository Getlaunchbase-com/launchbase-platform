import { describe, it, expect } from "vitest";
import { ModelRegistry } from "../../ai/modelRouting/modelRegistry";

describe("ModelRegistry mock", () => {
  it("returns deterministic models", () => {
    const r = new ModelRegistry({} as any);
    expect(r.getModels().length).toBeGreaterThan(0);
    expect(r.getModels()[0].provider).toBe("memory");
  });
});
