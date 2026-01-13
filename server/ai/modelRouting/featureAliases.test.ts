/**
 * Feature Alias Layer Tests
 * 
 * Regression protection: ensures internal capabilities map to vendor strings correctly.
 */

import { describe, it, expect } from "vitest";
import { resolveFeatureAliases, hasCapability, hasAllCapabilities } from "./featureAliases";

describe("Feature Alias Layer", () => {
  describe("resolveFeatureAliases", () => {
    it("should resolve json_schema to multiple vendor aliases", () => {
      const aliases = resolveFeatureAliases("json_schema");
      
      expect(aliases).toContain("json_schema"); // OpenAI direct
      expect(aliases).toContain("openai/chat-completion.response-format"); // AIML OpenAI proxy
      expect(aliases).toContain("anthropic/structured-output"); // Anthropic (future)
    });

    it("should resolve structured_outputs to vendor aliases", () => {
      const aliases = resolveFeatureAliases("structured_outputs");
      
      expect(aliases).toContain("structured_outputs");
      expect(aliases).toContain("openai/chat-completion.response-format");
    });

    it("should return the capability itself if no aliases defined", () => {
      const aliases = resolveFeatureAliases("unknown_capability");
      
      expect(aliases).toEqual(["unknown_capability"]);
    });
  });

  describe("hasCapability", () => {
    it("should match direct feature name", () => {
      const modelFeatures = ["json_schema", "vision"];
      
      expect(hasCapability(modelFeatures, "json_schema")).toBe(true);
      expect(hasCapability(modelFeatures, "vision")).toBe(true);
    });

    it("should match vendor-specific alias", () => {
      const modelFeatures = ["openai/chat-completion.response-format", "vision"];
      
      // json_schema resolves to ["json_schema", "openai/chat-completion.response-format", ...]
      expect(hasCapability(modelFeatures, "json_schema")).toBe(true);
    });

    it("should return false for missing capability", () => {
      const modelFeatures = ["vision"];
      
      expect(hasCapability(modelFeatures, "json_schema")).toBe(false);
      expect(hasCapability(modelFeatures, "function_calling")).toBe(false);
    });

    it("should handle AIML vendor strings correctly", () => {
      // Regression test: AIML returns "openai/chat-completion.response-format"
      const aimlModelFeatures = [
        "openai/chat-completion.response-format",
        "openai/chat-completion.tools",
        "openai/chat-completion.vision",
      ];
      
      expect(hasCapability(aimlModelFeatures, "json_schema")).toBe(true);
      expect(hasCapability(aimlModelFeatures, "structured_outputs")).toBe(true);
      expect(hasCapability(aimlModelFeatures, "function_calling")).toBe(true);
      expect(hasCapability(aimlModelFeatures, "vision")).toBe(true);
    });
  });

  describe("hasAllCapabilities", () => {
    it("should return true when all capabilities are present", () => {
      const modelFeatures = ["openai/chat-completion.response-format", "openai/chat-completion.vision"];
      
      expect(hasAllCapabilities(modelFeatures, ["json_schema", "vision"])).toBe(true);
    });

    it("should return false when any capability is missing", () => {
      const modelFeatures = ["openai/chat-completion.response-format"];
      
      expect(hasAllCapabilities(modelFeatures, ["json_schema", "vision"])).toBe(false);
    });

    it("should return true for empty requirements", () => {
      const modelFeatures = ["vision"];
      
      expect(hasAllCapabilities(modelFeatures, [])).toBe(true);
    });

    it("should handle mixed direct and vendor-specific features", () => {
      const modelFeatures = [
        "json_schema", // Direct OpenAI
        "openai/chat-completion.tools", // AIML vendor string
      ];
      
      expect(hasAllCapabilities(modelFeatures, ["json_schema", "function_calling"])).toBe(true);
    });
  });

  describe("Regression: Phase 1.3 Bug Prevention", () => {
    it("should prevent feature name mismatch between policy and registry", () => {
      // Bug: Policy config used "json_schema" but AIML returned "openai/chat-completion.response-format"
      // Fix: Alias layer maps internal names to vendor strings
      
      const policyRequires = ["json_schema"]; // Internal capability
      const aimlProvides = ["openai/chat-completion.response-format"]; // Vendor string
      
      // This should match via alias resolution
      expect(hasAllCapabilities(aimlProvides, policyRequires)).toBe(true);
    });

    it("should prevent silent breakage when vendors rename features", () => {
      // Scenario: Anthropic renames "anthropic/structured-output" to "anthropic/json-schema"
      // Solution: Update FEATURE_ALIASES, no policy config changes needed
      
      const modelFeatures = ["anthropic/structured-output"]; // Current name
      
      // Policy still uses internal name
      expect(hasCapability(modelFeatures, "json_schema")).toBe(true);
    });
  });
});
