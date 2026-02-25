/**
 * EstimateChainV1 Contract Validator
 *
 * Runtime validation of agent estimate output against EstimateChainV1 schema.
 * Rejects invalid payloads before storing in the database.
 *
 * AI output MUST be validated against this schema before entering the
 * deterministic system. If the swarm prompt changes, this validator
 * prevents silent data corruption.
 */

import { createHash } from "crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationError {
  path: string;
  message: string;
  received?: unknown;
}

export interface EstimateValidationResult {
  valid: boolean;
  errors: ValidationError[];
  contractName?: string;
  contractVersion?: string;
  schemaHash?: string;
}

// ---------------------------------------------------------------------------
// Schema hash
// ---------------------------------------------------------------------------

let _cachedHash: string | null = null;

export function getEstimateSchemaHash(): string {
  if (_cachedHash) return _cachedHash;
  const schemaPath = path.resolve(__dirname, "EstimateChainV1.schema.json");
  const content = fs.readFileSync(schemaPath, "utf-8");
  _cachedHash = createHash("sha256").update(content).digest("hex");
  return _cachedHash;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

/**
 * Validate agent output against the EstimateChainV1 contract.
 *
 * This MUST be called before storing any agent estimate output.
 * If validation fails, the output is rejected and the run marked as failed.
 */
export function validateEstimateChainV1(input: unknown): EstimateValidationResult {
  const errors: ValidationError[] = [];

  if (!isObject(input)) {
    return { valid: false, errors: [{ path: "$", message: "Input must be a JSON object" }] };
  }

  const data = input as Record<string, unknown>;

  // Required top-level fields
  const required = ["contract", "context", "assumptions", "line_items", "rollups", "quality", "errors"];
  for (const field of required) {
    if (!(field in data)) {
      errors.push({ path: `$.${field}`, message: `Required field "${field}" is missing` });
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // --- contract ---
  let contractName: string | undefined;
  let contractVersion: string | undefined;
  let schemaHash: string | undefined;

  if (!isObject(data.contract)) {
    errors.push({ path: "$.contract", message: "must be an object" });
  } else {
    const c = data.contract as Record<string, unknown>;

    if (c.name !== "EstimateChainV1") {
      errors.push({ path: "$.contract.name", message: 'must be "EstimateChainV1"', received: c.name });
    } else {
      contractName = c.name as string;
    }

    if (typeof c.version !== "string" || !/^1\.[0-9]+\.[0-9]+$/.test(c.version)) {
      errors.push({ path: "$.contract.version", message: "must match ^1.x.x", received: c.version });
    } else {
      contractVersion = c.version as string;
    }

    if (typeof c.schema_hash !== "string" || c.schema_hash.length < 16) {
      errors.push({ path: "$.contract.schema_hash", message: "must be a string >= 16 chars", received: c.schema_hash });
    } else {
      schemaHash = c.schema_hash as string;
    }

    if (!isObject(c.producer)) {
      errors.push({ path: "$.contract.producer", message: "must be an object" });
    }
  }

  // --- context ---
  if (!isObject(data.context)) {
    errors.push({ path: "$.context", message: "must be an object" });
  } else {
    const ctx = data.context as Record<string, unknown>;
    if (typeof ctx.task_library_id !== "string") {
      errors.push({ path: "$.context.task_library_id", message: "must be a string" });
    }
  }

  // --- assumptions[] ---
  if (!Array.isArray(data.assumptions)) {
    errors.push({ path: "$.assumptions", message: "must be an array" });
  } else {
    for (let i = 0; i < data.assumptions.length; i++) {
      const a = data.assumptions[i];
      const p = `$.assumptions[${i}]`;
      if (!isObject(a)) {
        errors.push({ path: p, message: "must be an object" });
        continue;
      }
      const obj = a as Record<string, unknown>;
      if (typeof obj.id !== "string") errors.push({ path: `${p}.id`, message: "must be a string" });
      if (typeof obj.title !== "string") errors.push({ path: `${p}.title`, message: "must be a string" });
      if (typeof obj.locked !== "boolean") errors.push({ path: `${p}.locked`, message: "must be a boolean" });
    }
  }

  // --- line_items[] ---
  if (!Array.isArray(data.line_items)) {
    errors.push({ path: "$.line_items", message: "must be an array" });
  } else {
    // Validate first 50 items (cap to prevent huge error arrays)
    const limit = Math.min(data.line_items.length, 50);
    for (let i = 0; i < limit; i++) {
      const li = data.line_items[i];
      const p = `$.line_items[${i}]`;
      if (!isObject(li)) {
        errors.push({ path: p, message: "must be an object" });
        continue;
      }
      const obj = li as Record<string, unknown>;

      if (typeof obj.line_id !== "string") {
        errors.push({ path: `${p}.line_id`, message: "must be a string" });
      }
      if (typeof obj.canonical_type !== "string") {
        errors.push({ path: `${p}.canonical_type`, message: "must be a string" });
      }
      if (typeof obj.task_code !== "string") {
        errors.push({ path: `${p}.task_code`, message: "must be a string" });
      }

      // quantity
      if (isObject(obj.quantity)) {
        const q = obj.quantity as Record<string, unknown>;
        if (typeof q.count !== "number" || q.count < 0) {
          errors.push({ path: `${p}.quantity.count`, message: "must be a non-negative number" });
        }
      }

      // labor
      if (isObject(obj.labor)) {
        const l = obj.labor as Record<string, unknown>;
        if (typeof l.hours !== "number" || l.hours < 0) {
          errors.push({ path: `${p}.labor.hours`, message: "must be a non-negative number" });
        }
      }

      // confidence
      if (isObject(obj.confidence)) {
        const c = obj.confidence as Record<string, unknown>;
        if (typeof c.overall === "number" && (c.overall < 0 || c.overall > 1)) {
          errors.push({ path: `${p}.confidence.overall`, message: "must be between 0 and 1" });
        }
      }
    }
  }

  // --- rollups ---
  if (!isObject(data.rollups)) {
    errors.push({ path: "$.rollups", message: "must be an object" });
  } else {
    const r = data.rollups as Record<string, unknown>;
    if (typeof r.labor_total_hours !== "number") {
      errors.push({ path: "$.rollups.labor_total_hours", message: "must be a number" });
    }
    if (!Array.isArray(r.by_canonical_type)) {
      errors.push({ path: "$.rollups.by_canonical_type", message: "must be an array" });
    } else {
      for (let i = 0; i < r.by_canonical_type.length; i++) {
        const item = r.by_canonical_type[i];
        const p = `$.rollups.by_canonical_type[${i}]`;
        if (!isObject(item)) {
          errors.push({ path: p, message: "must be an object" });
          continue;
        }
        const obj = item as Record<string, unknown>;
        if (typeof obj.canonical_type !== "string") {
          errors.push({ path: `${p}.canonical_type`, message: "must be a string" });
        }
        if (typeof obj.count !== "number" || obj.count < 0) {
          errors.push({ path: `${p}.count`, message: "must be a non-negative number" });
        }
        if (typeof obj.labor_hours !== "number" || obj.labor_hours < 0) {
          errors.push({ path: `${p}.labor_hours`, message: "must be a non-negative number" });
        }
      }
    }
  }

  // --- quality ---
  if (!isObject(data.quality)) {
    errors.push({ path: "$.quality", message: "must be an object" });
  } else {
    const q = data.quality as Record<string, unknown>;
    if (!Array.isArray(q.unmapped_classes)) {
      errors.push({ path: "$.quality.unmapped_classes", message: "must be an array" });
    }
    if (!Array.isArray(q.low_confidence_items)) {
      errors.push({ path: "$.quality.low_confidence_items", message: "must be an array" });
    }
    if (!Array.isArray(q.gap_flags)) {
      errors.push({ path: "$.quality.gap_flags", message: "must be an array" });
    }
  }

  // --- errors[] ---
  if (!Array.isArray(data.errors)) {
    errors.push({ path: "$.errors", message: "must be an array" });
  } else {
    for (let i = 0; i < data.errors.length; i++) {
      const err = data.errors[i];
      const ep = `$.errors[${i}]`;
      if (!isObject(err)) {
        errors.push({ path: ep, message: "must be an object" });
        continue;
      }
      const e = err as Record<string, unknown>;
      if (typeof e.code !== "string") errors.push({ path: `${ep}.code`, message: "must be a string" });
      if (typeof e.message !== "string") errors.push({ path: `${ep}.message`, message: "must be a string" });
    }
  }

  return { valid: errors.length === 0, errors, contractName, contractVersion, schemaHash };
}
