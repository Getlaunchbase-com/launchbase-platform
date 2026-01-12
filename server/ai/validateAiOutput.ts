/**
 * AI Output Validation - Single Choke Point
 * 
 * All AI outputs MUST pass through this validator before being used.
 * Uses Ajv to enforce JSON Schema contracts.
 */

import Ajv, { type ErrorObject } from "ajv";
import copyProposalSchema from "./contracts/copy_proposal.schema.json";
import designTokensSchema from "./contracts/design_tokens.schema.json";
import intentParseSchema from "./contracts/intent_parse.schema.json";
import critiqueSchema from "./contracts/critique.schema.json";
import decisionCollapseSchema from "./contracts/decision_collapse.schema.json";

// ============================================
// TYPES
// ============================================

export type AiContractType =
  | "intent_parse"
  | "copy_proposal"
  | "design_tokens"
  | "critique"
  | "decision_collapse";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "invalid_json" | "schema_violation"; errors: string[] };

// ============================================
// AJV SETUP
// ============================================

const ajv = new Ajv({
  allErrors: true, // Collect all errors, not just first
  removeAdditional: false, // Reject extras instead of stripping silently
  strict: true, // Strict mode for safety
  verbose: false, // Don't include schema in errors
});

// Compile validators once at module load
const validators = {
  intent_parse: ajv.compile(intentParseSchema),
  copy_proposal: ajv.compile(copyProposalSchema),
  design_tokens: ajv.compile(designTokensSchema),
  critique: ajv.compile(critiqueSchema),
  decision_collapse: ajv.compile(decisionCollapseSchema),
};

// ============================================
// ERROR FORMATTING
// ============================================

/**
 * Convert Ajv errors into short, readable strings
 * Examples:
 * - "variants[0].value must be <= 80 chars"
 * - "additionalProperties 'foo' is not allowed"
 * - "requiresApproval must be true"
 */
function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) {
    return ["Unknown validation error"];
  }

  return errors.map((err) => {
    const path = err.instancePath || "(root)";
    const keyword = err.keyword;

    switch (keyword) {
      case "additionalProperties":
        return `${path}: additionalProperty '${err.params.additionalProperty}' is not allowed`;
      
      case "required":
        return `${path}: missing required property '${err.params.missingProperty}'`;
      
      case "maxLength":
        return `${path}: must be <= ${err.params.limit} chars`;
      
      case "minLength":
        return `${path}: must be >= ${err.params.limit} chars`;
      
      case "maximum":
        return `${path}: must be <= ${err.params.limit}`;
      
      case "minimum":
        return `${path}: must be >= ${err.params.limit}`;
      
      case "maxItems":
        return `${path}: must have <= ${err.params.limit} items`;
      
      case "minItems":
        return `${path}: must have >= ${err.params.limit} items`;
      
      case "enum":
        return `${path}: must be one of [${err.params.allowedValues?.join(", ")}]`;
      
      case "const":
        return `${path}: must be ${err.params.allowedValue}`;
      
      case "type":
        return `${path}: must be ${err.params.type}`;
      
      case "oneOf":
        return `${path}: must match exactly one schema`;
      
      case "pattern":
        return `${path}: must match pattern ${err.params.pattern}`;
      
      default:
        return `${path}: ${err.message || "validation failed"}`;
    }
  });
}

// ============================================
// VALIDATION FUNCTION
// ============================================

/**
 * Validate AI output against contract schema
 * 
 * @param type - Contract type (determines which schema to use)
 * @param payload - Unknown payload from AI (will be validated)
 * @returns ValidationResult with typed data or structured errors
 * 
 * @example
 * const result = validateAiOutput<CopyProposal>("copy_proposal", aiResponse);
 * if (result.ok) {
 *   // result.data is typed as CopyProposal
 *   console.log(result.data.variants);
 * } else {
 *   // result.errors contains readable error strings
 *   console.error(result.errors);
 * }
 */
export function validateAiOutput<T>(
  type: AiContractType,
  payload: unknown
): ValidationResult<T> {
  // Check if payload is valid JSON object
  if (typeof payload !== "object" || payload === null) {
    return {
      ok: false,
      code: "invalid_json",
      errors: ["Payload must be a JSON object"],
    };
  }

  // Get compiled validator for this contract type
  const validator = validators[type];
  
  // Run validation
  const valid = validator(payload);

  if (valid) {
    return {
      ok: true,
      data: payload as T,
    };
  }

  // Validation failed - format errors
  const errors = formatAjvErrors(validator.errors);

  return {
    ok: false,
    code: "schema_violation",
    errors,
  };
}

// ============================================
// LOGGING HELPERS
// ============================================

/**
 * Log validation failure (safe - no customer data)
 * 
 * @param type - Contract type
 * @param intakeId - Intake ID (if known)
 * @param errors - Validation errors
 * @param traceId - Trace ID for debugging
 */
export function logValidationFailure(
  type: AiContractType,
  intakeId: number | undefined,
  errors: string[],
  traceId: string
): void {
  console.error("[AI_OUTPUT_INVALID]", {
    contractType: type,
    intakeId,
    errorCount: errors.length,
    errors: errors.slice(0, 5), // Max 5 errors to prevent log spam
    traceId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log validation success (for monitoring)
 * 
 * @param type - Contract type
 * @param intakeId - Intake ID (if known)
 * @param traceId - Trace ID for debugging
 */
export function logValidationSuccess(
  type: AiContractType,
  intakeId: number | undefined,
  traceId: string
): void {
  console.log("[AI_OUTPUT_VALID]", {
    contractType: type,
    intakeId,
    traceId,
    timestamp: new Date().toISOString(),
  });
}
