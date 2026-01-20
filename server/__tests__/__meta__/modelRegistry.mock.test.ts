import { describe, it, expect } from "vitest";
import { ModelRegistry } from "../../ai/modelRouting/modelRegistry";

describe("ModelRegistry mock", () => {
  it.skip("returns deterministic models", () => {
    // TODO: Fix mockModelRegistry helper (scope bug: models not accessible in class)
    // OR: seed registry state directly if state becomes public
    const r = new ModelRegistry({} as any);
    const models = r.list();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].provider).toBe("memory");
  });
});
