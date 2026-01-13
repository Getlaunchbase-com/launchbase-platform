/**
 * Model Normalization Tests (Pure, No AIML/Env)
 * 
 * Regression protection for feature normalization and type inference.
 */

import { describe, it, expect } from "vitest";
import { normalizeFeatures, inferTypeFromId } from "./modelNormalize";

describe("normalizeFeatures", () => {
  describe("Array format (AIML, OpenAI direct)", () => {
    it("should preserve valid feature strings", () => {
      const input = ["openai/chat-completion.response-format", "tool_calls", "vision"];
      const result = normalizeFeatures(input);
      
      expect(result).toEqual(["openai/chat-completion.response-format", "tool_calls", "vision"]);
    });

    it("should filter out non-string values", () => {
      const input = ["json_schema", null, undefined, 123, true, "vision"];
      const result = normalizeFeatures(input);
      
      expect(result).toEqual(["json_schema", "vision"]);
    });

    it("should filter out empty strings", () => {
      const input = ["json_schema", "", "   ", "vision"];
      const result = normalizeFeatures(input);
      
      expect(result).toEqual(["json_schema", "vision"]);
    });

    it("should handle empty array", () => {
      const result = normalizeFeatures([]);
      
      expect(result).toEqual([]);
    });
  });

  describe("Object format (alternative API format)", () => {
    it("should extract keys where value is truthy", () => {
      const input = {
        json_schema: true,
        tool_calls: 1,
        vision: "yes",
        deprecated: false,
        removed: 0,
        missing: null,
      };
      const result = normalizeFeatures(input);
      
      expect(result).toContain("json_schema");
      expect(result).toContain("tool_calls");
      expect(result).toContain("vision");
      expect(result).not.toContain("deprecated");
      expect(result).not.toContain("removed");
      expect(result).not.toContain("missing");
    });

    it("should handle empty object", () => {
      const result = normalizeFeatures({});
      
      expect(result).toEqual([]);
    });

    it("should handle object with all false values", () => {
      const input = { feature1: false, feature2: 0, feature3: null };
      const result = normalizeFeatures(input);
      
      expect(result).toEqual([]);
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined", () => {
      const result = normalizeFeatures(undefined);
      
      expect(result).toEqual([]);
    });

    it("should handle null", () => {
      const result = normalizeFeatures(null);
      
      expect(result).toEqual([]);
    });

    it("should handle primitive values", () => {
      expect(normalizeFeatures("string")).toEqual([]);
      expect(normalizeFeatures(123)).toEqual([]);
      expect(normalizeFeatures(true)).toEqual([]);
    });
  });

  describe("Regression: Phase 1.3 Bug", () => {
    it("should not convert array to numeric indices", () => {
      // Bug: Object.entries(["a", "b"]) returns [["0", "a"], ["1", "b"]]
      // Fix: Check Array.isArray() first
      
      const input = ["openai/chat-completion.response-format"];
      const result = normalizeFeatures(input);
      
      expect(result).toEqual(["openai/chat-completion.response-format"]);
      expect(result).not.toContain("0");
      expect(result).not.toContain("1");
    });
  });
});

describe("inferTypeFromId", () => {
  it("should infer embedding type", () => {
    expect(inferTypeFromId("text-embedding-3-small")).toBe("embedding");
    expect(inferTypeFromId("text-embedding-ada-002")).toBe("embedding");
  });

  it("should infer audio type", () => {
    expect(inferTypeFromId("whisper-1")).toBe("audio");
    expect(inferTypeFromId("tts-1")).toBe("audio");
    expect(inferTypeFromId("tts-1-hd")).toBe("audio");
  });

  it("should infer image type", () => {
    expect(inferTypeFromId("dall-e-3")).toBe("image");
    expect(inferTypeFromId("dall-e-2")).toBe("image");
    expect(inferTypeFromId("stable-diffusion-xl")).toBe("image");
  });

  it("should default to text for chat models", () => {
    expect(inferTypeFromId("gpt-4o-mini")).toBe("text");
    expect(inferTypeFromId("gpt-4.1-turbo")).toBe("text");
    expect(inferTypeFromId("claude-3-opus")).toBe("text");
  });

  it("should be case-insensitive", () => {
    expect(inferTypeFromId("TEXT-EMBEDDING-3-SMALL")).toBe("embedding");
    expect(inferTypeFromId("WHISPER-1")).toBe("audio");
    expect(inferTypeFromId("DALL-E-3")).toBe("image");
  });

  it("should handle unknown model IDs", () => {
    expect(inferTypeFromId("unknown-model-xyz")).toBe("text");
    expect(inferTypeFromId("")).toBe("text");
  });
});
