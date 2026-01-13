/**
 * Feature Alias Layer
 * 
 * Maps internal capability names to vendor-specific feature strings.
 * This makes the system provider-agnostic: when vendors rename features
 * or new providers are added, only this file needs to be updated.
 * 
 * Example:
 * - Internal: "json_schema"
 * - AIML: "openai/chat-completion.response-format"
 * - Anthropic: "anthropic/structured-output" (future)
 * - OpenAI: "json_schema" (future direct integration)
 */

export const FEATURE_ALIASES: Record<string, string[]> = {
  /**
   * JSON Schema Support
   * 
   * Ability to constrain model output to a JSON schema.
   * Used for structured data extraction and validation.
   */
  json_schema: [
    "json_schema", // OpenAI direct
    "openai/chat-completion.response-format", // AIML OpenAI proxy
    "anthropic/structured-output", // Anthropic (future)
  ],

  /**
   * Structured Outputs
   * 
   * Vendor-specific structured output capabilities.
   * May have different semantics than json_schema.
   */
  structured_outputs: [
    "structured_outputs", // OpenAI direct
    "openai/chat-completion.response-format", // AIML OpenAI proxy
  ],

  /**
   * Function Calling
   * 
   * Ability to call functions/tools with structured parameters.
   */
  function_calling: [
    "function_calling", // OpenAI direct
    "openai/chat-completion.tools", // AIML OpenAI proxy
    "anthropic/tool-use", // Anthropic
  ],

  /**
   * Vision (Image Understanding)
   * 
   * Ability to process and understand images.
   */
  vision: [
    "vision", // OpenAI direct
    "openai/chat-completion.vision", // AIML OpenAI proxy
    "anthropic/vision", // Anthropic
  ],
};

/**
 * Resolve internal capability name to all known vendor aliases.
 * 
 * @param capability Internal capability name (e.g., "json_schema")
 * @returns Array of vendor-specific feature strings
 * 
 * @example
 * resolveFeatureAliases("json_schema")
 * // Returns: ["json_schema", "openai/chat-completion.response-format", "anthropic/structured-output"]
 */
export function resolveFeatureAliases(capability: string): string[] {
  return FEATURE_ALIASES[capability] ?? [capability];
}

/**
 * Check if a model's features match a required capability.
 * 
 * @param modelFeatures Array of feature strings from the model registry
 * @param requiredCapability Internal capability name to check
 * @returns True if the model has any alias of the required capability
 * 
 * @example
 * const modelFeatures = ["openai/chat-completion.response-format", "vision"];
 * hasCapability(modelFeatures, "json_schema") // true
 * hasCapability(modelFeatures, "function_calling") // false
 */
export function hasCapability(modelFeatures: string[], requiredCapability: string): boolean {
  const aliases = resolveFeatureAliases(requiredCapability);
  return modelFeatures.some((feature) => aliases.includes(feature));
}

/**
 * Check if a model's features match all required capabilities.
 * 
 * @param modelFeatures Array of feature strings from the model registry
 * @param requiredCapabilities Array of internal capability names to check
 * @returns True if the model has all required capabilities
 * 
 * @example
 * const modelFeatures = ["openai/chat-completion.response-format", "vision"];
 * hasAllCapabilities(modelFeatures, ["json_schema", "vision"]) // true
 * hasAllCapabilities(modelFeatures, ["json_schema", "function_calling"]) // false
 */
export function hasAllCapabilities(modelFeatures: string[], requiredCapabilities: string[]): boolean {
  return requiredCapabilities.every((cap) => hasCapability(modelFeatures, cap));
}
