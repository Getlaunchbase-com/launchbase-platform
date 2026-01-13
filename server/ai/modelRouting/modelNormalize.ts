/**
 * Pure Model Normalization Helpers
 * 
 * These functions have no side effects and don't depend on environment.
 * They are extracted for testability and reuse.
 */

/**
 * Normalize raw features from AIML/OpenAI API to canonical string array.
 * 
 * Handles multiple input formats:
 * - Array of strings: ["json_schema", "tool_calls"] → same
 * - Object with boolean values: {json_schema: true, tool_calls: false} → ["json_schema"]
 * - Undefined/null → []
 * 
 * @param rawFeatures Raw features from API (array, object, or undefined)
 * @returns Canonical array of feature strings
 */
export function normalizeFeatures(rawFeatures: any): string[] {
  if (!rawFeatures) return [];

  // Array format (AIML, OpenAI direct)
  if (Array.isArray(rawFeatures)) {
    return rawFeatures.filter((f) => typeof f === "string" && f.trim().length > 0);
  }

  // Object format {feature: true/false}
  if (typeof rawFeatures === "object") {
    return Object.entries(rawFeatures)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k);
  }

  // Unknown format
  return [];
}

/**
 * Infer model type from model ID when type is not provided.
 * 
 * @param modelId Model identifier (e.g., "gpt-4o-mini", "text-embedding-3-small")
 * @returns Inferred model type
 */
export function inferTypeFromId(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes("embedding")) return "embedding";
  if (lower.includes("whisper") || lower.includes("tts")) return "audio";
  if (lower.includes("dall-e") || lower.includes("stable-diffusion")) return "image";
  return "text"; // default fallback
}
