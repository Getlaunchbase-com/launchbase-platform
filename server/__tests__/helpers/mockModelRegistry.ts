import { vi } from "vitest";

/**
 * Opt-in mock for ModelRegistry - provides deterministic test data.
 * Call this at the TOP of test files that need a mock registry (before imports that use it).
 * 
 * Tests that want to exercise real ModelRegistry logic should NOT call this.
 */
export function useMockModelRegistry() {
  const models = [
    { id: "gpt-4o-mini", provider: "memory", features: ["json_schema"], contextLength: 128000 },
    { id: "gpt-4o", provider: "memory", features: ["json_schema"], contextLength: 128000 },
  ];

  // Mock the ModelRegistry class
  vi.mock("../../ai/modelRouting/modelRegistry", async () => {
    const actual = await vi.importActual<any>("../../ai/modelRouting/modelRegistry");
    class ModelRegistryMock {
      list() { return models; }
      get(id: string) { return models.find(m => m.id === id) ?? null; }
      async refresh() { return; }
      state = { models, stale: false, lastRefreshAt: Date.now() };
    }
    return { ...actual, ModelRegistry: ModelRegistryMock };
  });

  // Mock the singleton export
  vi.mock("../../ai/index", () => ({
    modelRegistry: {
      list: () => models,
      get: (id: string) => models.find(m => m.id === id) ?? null,
      refresh: async () => {},
      state: { models, stale: false, lastRefreshAt: Date.now() },
    },
  }));
}
