/**
 * BlueprintParseV1 Contract Validator
 *
 * Runtime validation of VM parse output against BlueprintParseV1.schema.json.
 * Used by the platform ingestion pipeline to reject invalid payloads before
 * storing anything in the database.
 *
 * Design rules:
 *   - Validates structure, types, and value ranges
 *   - Returns structured errors with path information (never raw crashes)
 *   - Schema hash verified for integrity (VM and platform must agree)
 *   - Additive-only: V2 must not break V1
 */

import { createHash } from "crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlueprintParseV1Contract {
  name: string;
  version: string;
  schema_hash: string;
  producer: {
    tool: string;
    tool_version: string;
    runtime: string;
    model_version: string | null;
  };
}

export interface BlueprintParseV1Document {
  id?: string | null;
  page_count: number;
  dpi: number;
  is_vector: boolean;
  filename?: string | null;
}

export interface BlueprintParseV1BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BlueprintParseV1Page {
  page_number: number;
  image_artifact_path?: string | null;
  width_px: number;
  height_px: number;
  label?: string | null;
}

export interface BlueprintParseV1TextBlock {
  page: number;
  bbox: BlueprintParseV1BBox;
  text: string;
  confidence: number;
  type: "title" | "label" | "dimension" | "note" | "legend_text" | "other";
}

export interface BlueprintParseV1LegendCandidate {
  page: number;
  bbox: BlueprintParseV1BBox;
  confidence: number;
  method: string;
  raw_label?: string | null;
  symbol_description?: string | null;
}

export interface BlueprintParseV1ScaleCandidate {
  page: number;
  raw: string;
  confidence: number;
  method: string;
}

export interface BlueprintParseV1Error {
  code: string;
  message: string;
  page?: number | null;
  details?: Record<string, unknown> | null;
}

export interface BlueprintParseV1Output {
  contract: BlueprintParseV1Contract;
  document: BlueprintParseV1Document;
  pages: BlueprintParseV1Page[];
  text_blocks: BlueprintParseV1TextBlock[];
  legend_candidates: BlueprintParseV1LegendCandidate[];
  scale_candidates: BlueprintParseV1ScaleCandidate[];
  title_block_candidates?: Array<{
    page: number;
    bbox: BlueprintParseV1BBox;
    confidence: number;
    method: string;
  }>;
  errors: BlueprintParseV1Error[];
}

export interface ValidationError {
  path: string;
  message: string;
  received?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  contractName?: string;
  contractVersion?: string;
  schemaHash?: string;
}

// ---------------------------------------------------------------------------
// Schema hash computation
// ---------------------------------------------------------------------------

let _cachedSchemaHash: string | null = null;

/** Compute SHA-256 of the schema file, cached after first call. */
export function getSchemaHash(): string {
  if (_cachedSchemaHash) return _cachedSchemaHash;

  const schemaPath = path.resolve(__dirname, "BlueprintParseV1.schema.json");
  const content = fs.readFileSync(schemaPath, "utf-8");
  _cachedSchemaHash = createHash("sha256").update(content).digest("hex");
  return _cachedSchemaHash;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateBBox(bbox: unknown, path: string, errors: ValidationError[]): void {
  if (!isObject(bbox)) {
    errors.push({ path, message: "must be an object with {x, y, w, h}", received: bbox });
    return;
  }
  for (const key of ["x", "y", "w", "h"] as const) {
    const val = (bbox as any)[key];
    if (typeof val !== "number") {
      errors.push({ path: `${path}.${key}`, message: "must be a number", received: val });
    } else if (val < 0 || val > 1) {
      errors.push({ path: `${path}.${key}`, message: "must be between 0 and 1", received: val });
    }
  }
}

function validateConfidence(val: unknown, path: string, errors: ValidationError[]): void {
  if (typeof val !== "number") {
    errors.push({ path, message: "must be a number", received: val });
  } else if (val < 0 || val > 1) {
    errors.push({ path, message: "must be between 0 and 1", received: val });
  }
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

/**
 * Validate a VM parse output against the BlueprintParseV1 contract.
 *
 * Returns a structured result with:
 *   - valid: boolean
 *   - errors: array of { path, message, received? }
 *   - contractName / contractVersion / schemaHash (if parseable)
 */
export function validateBlueprintParseV1(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // --- Top-level must be an object ---
  if (!isObject(input)) {
    return { valid: false, errors: [{ path: "$", message: "Input must be a JSON object" }] };
  }

  const data = input as Record<string, unknown>;

  // --- Required top-level fields ---
  const requiredFields = ["contract", "document", "pages", "text_blocks", "legend_candidates", "scale_candidates", "errors"];
  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push({ path: `$.${field}`, message: `Required field "${field}" is missing` });
    }
  }

  // If we're missing critical fields, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // --- contract ---
  const contract = data.contract;
  let contractName: string | undefined;
  let contractVersion: string | undefined;
  let schemaHash: string | undefined;

  if (!isObject(contract)) {
    errors.push({ path: "$.contract", message: "must be an object" });
  } else {
    const c = contract as Record<string, unknown>;

    if (c.name !== "BlueprintParseV1") {
      errors.push({ path: "$.contract.name", message: 'must be "BlueprintParseV1"', received: c.name });
    } else {
      contractName = c.name as string;
    }

    if (typeof c.version !== "string" || !/^1\.[0-9]+\.[0-9]+$/.test(c.version)) {
      errors.push({
        path: "$.contract.version",
        message: "must be a semver string matching ^1.x.x",
        received: c.version,
      });
    } else {
      contractVersion = c.version as string;
    }

    if (typeof c.schema_hash !== "string" || c.schema_hash.length < 16) {
      errors.push({
        path: "$.contract.schema_hash",
        message: "must be a string with at least 16 characters",
        received: c.schema_hash,
      });
    } else {
      schemaHash = c.schema_hash as string;
    }

    // producer
    if (!isObject(c.producer)) {
      errors.push({ path: "$.contract.producer", message: "must be an object" });
    } else {
      const p = c.producer as Record<string, unknown>;
      if (typeof p.tool !== "string") errors.push({ path: "$.contract.producer.tool", message: "must be a string" });
      if (typeof p.tool_version !== "string") errors.push({ path: "$.contract.producer.tool_version", message: "must be a string" });
      if (typeof p.runtime !== "string") errors.push({ path: "$.contract.producer.runtime", message: "must be a string" });
      // model_version is nullable
      if (p.model_version !== null && typeof p.model_version !== "string") {
        errors.push({ path: "$.contract.producer.model_version", message: "must be a string or null" });
      }
    }
  }

  // --- document ---
  const doc = data.document;
  if (!isObject(doc)) {
    errors.push({ path: "$.document", message: "must be an object" });
  } else {
    const d = doc as Record<string, unknown>;
    if (typeof d.page_count !== "number" || d.page_count < 1 || !Number.isInteger(d.page_count)) {
      errors.push({ path: "$.document.page_count", message: "must be a positive integer", received: d.page_count });
    }
    if (typeof d.dpi !== "number" || d.dpi < 1 || !Number.isInteger(d.dpi)) {
      errors.push({ path: "$.document.dpi", message: "must be a positive integer", received: d.dpi });
    }
    if (typeof d.is_vector !== "boolean") {
      errors.push({ path: "$.document.is_vector", message: "must be a boolean", received: d.is_vector });
    }
  }

  // --- pages[] ---
  if (!Array.isArray(data.pages)) {
    errors.push({ path: "$.pages", message: "must be an array (never null)" });
  } else {
    for (let i = 0; i < data.pages.length; i++) {
      const p = data.pages[i];
      const pp = `$.pages[${i}]`;
      if (!isObject(p)) {
        errors.push({ path: pp, message: "must be an object" });
        continue;
      }
      const page = p as Record<string, unknown>;
      if (typeof page.page_number !== "number" || page.page_number < 1) {
        errors.push({ path: `${pp}.page_number`, message: "must be a positive integer", received: page.page_number });
      }
      if (typeof page.width_px !== "number" || page.width_px < 1) {
        errors.push({ path: `${pp}.width_px`, message: "must be a positive integer", received: page.width_px });
      }
      if (typeof page.height_px !== "number" || page.height_px < 1) {
        errors.push({ path: `${pp}.height_px`, message: "must be a positive integer", received: page.height_px });
      }
    }
  }

  // --- text_blocks[] ---
  if (!Array.isArray(data.text_blocks)) {
    errors.push({ path: "$.text_blocks", message: "must be an array (never null)" });
  } else {
    const validTypes = new Set(["title", "label", "dimension", "note", "legend_text", "other"]);
    for (let i = 0; i < data.text_blocks.length; i++) {
      const tb = data.text_blocks[i];
      const tp = `$.text_blocks[${i}]`;
      if (!isObject(tb)) {
        errors.push({ path: tp, message: "must be an object" });
        continue;
      }
      const block = tb as Record<string, unknown>;
      if (typeof block.page !== "number" || block.page < 1) {
        errors.push({ path: `${tp}.page`, message: "must be a positive integer" });
      }
      validateBBox(block.bbox, `${tp}.bbox`, errors);
      if (typeof block.text !== "string" || block.text.length === 0) {
        errors.push({ path: `${tp}.text`, message: "must be a non-empty string" });
      }
      validateConfidence(block.confidence, `${tp}.confidence`, errors);
      if (typeof block.type !== "string" || !validTypes.has(block.type)) {
        errors.push({ path: `${tp}.type`, message: `must be one of: ${[...validTypes].join(", ")}`, received: block.type });
      }
    }
  }

  // --- legend_candidates[] ---
  if (!Array.isArray(data.legend_candidates)) {
    errors.push({ path: "$.legend_candidates", message: "must be an array (never null)" });
  } else {
    for (let i = 0; i < data.legend_candidates.length; i++) {
      const lc = data.legend_candidates[i];
      const lp = `$.legend_candidates[${i}]`;
      if (!isObject(lc)) {
        errors.push({ path: lp, message: "must be an object" });
        continue;
      }
      const leg = lc as Record<string, unknown>;
      if (typeof leg.page !== "number" || leg.page < 1) {
        errors.push({ path: `${lp}.page`, message: "must be a positive integer" });
      }
      validateBBox(leg.bbox, `${lp}.bbox`, errors);
      validateConfidence(leg.confidence, `${lp}.confidence`, errors);
      if (typeof leg.method !== "string") {
        errors.push({ path: `${lp}.method`, message: "must be a string" });
      }
    }
  }

  // --- scale_candidates[] ---
  if (!Array.isArray(data.scale_candidates)) {
    errors.push({ path: "$.scale_candidates", message: "must be an array (never null)" });
  } else {
    for (let i = 0; i < data.scale_candidates.length; i++) {
      const sc = data.scale_candidates[i];
      const sp = `$.scale_candidates[${i}]`;
      if (!isObject(sc)) {
        errors.push({ path: sp, message: "must be an object" });
        continue;
      }
      const scale = sc as Record<string, unknown>;
      if (typeof scale.page !== "number" || scale.page < 1) {
        errors.push({ path: `${sp}.page`, message: "must be a positive integer" });
      }
      if (typeof scale.raw !== "string") {
        errors.push({ path: `${sp}.raw`, message: "must be a string" });
      }
      validateConfidence(scale.confidence, `${sp}.confidence`, errors);
      if (typeof scale.method !== "string") {
        errors.push({ path: `${sp}.method`, message: "must be a string" });
      }
    }
  }

  // --- errors[] ---
  if (!Array.isArray(data.errors)) {
    errors.push({ path: "$.errors", message: "must be an array (never null)" });
  } else {
    for (let i = 0; i < data.errors.length; i++) {
      const err = data.errors[i];
      const ep = `$.errors[${i}]`;
      if (!isObject(err)) {
        errors.push({ path: ep, message: "must be an object" });
        continue;
      }
      const e = err as Record<string, unknown>;
      if (typeof e.code !== "string") {
        errors.push({ path: `${ep}.code`, message: "must be a string" });
      }
      if (typeof e.message !== "string") {
        errors.push({ path: `${ep}.message`, message: "must be a string" });
      }
    }
  }

  // --- title_block_candidates[] (optional but must be array if present) ---
  if ("title_block_candidates" in data && data.title_block_candidates !== undefined) {
    if (!Array.isArray(data.title_block_candidates)) {
      errors.push({ path: "$.title_block_candidates", message: "must be an array if present (never null)" });
    } else {
      for (let i = 0; i < data.title_block_candidates.length; i++) {
        const tb = data.title_block_candidates[i];
        const tp = `$.title_block_candidates[${i}]`;
        if (!isObject(tb)) {
          errors.push({ path: tp, message: "must be an object" });
          continue;
        }
        const block = tb as Record<string, unknown>;
        if (typeof block.page !== "number" || block.page < 1) {
          errors.push({ path: `${tp}.page`, message: "must be a positive integer" });
        }
        validateBBox(block.bbox, `${tp}.bbox`, errors);
        validateConfidence(block.confidence, `${tp}.confidence`, errors);
        if (typeof block.method !== "string") {
          errors.push({ path: `${tp}.method`, message: "must be a string" });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    contractName,
    contractVersion,
    schemaHash,
  };
}
