/**
 * Preflight Validation for FailurePackets
 * 
 * Goal: If the FailurePacket is bad, we fail in <100ms, write a clear stopReason, and never spend API money.
 * 
 * Three-step validation:
 * 1. normalizeFailurePacket - Fix common issues (logs: string → array, missing fields)
 * 2. validateFailurePacketOrThrow - Enforce required fields, file existence, path allowlist
 * 3. preflightFailurePacket - Orchestrate normalize → validate → return result
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { FailurePacketV1 } from "./failurePacket";
import { validateTestCommandsOrThrow } from "./testCommandValidation";
import { normalizeTestCommandsFromFailurePacket } from "./normalizeTestCommands";

/**
 * Preflight validation result
 */
export type PreflightResult =
  | { ok: true }
  | { ok: false; stopReason: string; errors: string[] };

/**
 * Stop reasons for preflight failures
 */
export const PREFLIGHT_STOP_REASONS = {
  PACKET_INVALID: "packet_invalid",
  TARGET_MISSING: "target_missing",
  TARGET_FORBIDDEN: "target_forbidden",
  TEST_COMMANDS_INVALID: "test_commands_invalid",
} as const;

/**
 * Path allowlist patterns (glob-style)
 * ✅ Allowed: client/**, server/**, tsconfig.json, package.json
 * ❌ Forbidden: .env*, drizzle/**, secrets, lockfiles
 */
const ALLOWED_PATH_PATTERNS = [
  /^client\//,
  /^server\//,
  /^scripts\//,
  /^docs\//,
  /^tsconfig\.json$/,
  /^package\.json$/,
  /^vitest\.config\.ts$/,
  /^README\.md$/,
];

const FORBIDDEN_PATH_PATTERNS = [
  /^\.env/,
  /^drizzle\//,
  /^node_modules\//,
  /^\.git\//,
  /secrets/i,
  /password/i,
  /pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
];

/**
 * 1. normalizeFailurePacket
 * 
 * Fixes common issues with FailurePacket structure:
 * - context.logs: string → [string]; missing → []
 * - context.command: missing → "unknown"
 * - testCommands: missing → [] (mark as invalid)
 */
export function normalizeFailurePacket(pkt: any): any {
  const normalized = { ...pkt };

  // Normalize context
  if (!normalized.context) {
    normalized.context = {};
  }

  // Normalize logs: string → array, missing → []
  if (typeof normalized.context.logs === "string") {
    normalized.context.logs = [normalized.context.logs];
  } else if (!Array.isArray(normalized.context.logs)) {
    normalized.context.logs = [];
  }

  // Normalize command
  if (!normalized.context.command) {
    normalized.context.command = "unknown";
  }

  // Normalize testCommands: prose → commands, missing → defaults
  normalized.testCommands = normalizeTestCommandsFromFailurePacket(normalized);

  return normalized;
}

/**
 * 2. validateFailurePacketOrThrow
 * 
 * Enforces:
 * - Required fields: version, failure, context, environment
 * - File existence: every target file must exist
 * - Path allowlist: every path must match allowed globs
 * - Test commands: must be string[], reject prose
 * 
 * Throws with descriptive error message on validation failure.
 */
export function validateFailurePacketOrThrow(pkt: any): asserts pkt is FailurePacketV1 {
  const errors: string[] = [];

  // 1. Required fields
  if (!pkt.version || pkt.version !== "failurepacket.v1") {
    errors.push("Missing or invalid version (expected 'failurepacket.v1')");
  }

  if (!pkt.failure?.type) {
    errors.push("Missing failure.type");
  }

  if (!pkt.failure?.errorMessage) {
    errors.push("Missing failure.errorMessage");
  }

  if (!pkt.failure?.stopReason) {
    errors.push("Missing failure.stopReason");
  }

  if (!pkt.context) {
    errors.push("Missing context object");
  }

  if (!pkt.environment) {
    errors.push("Missing environment object");
  }

  // 2. File existence checks (if targets provided)
  if (pkt.targets && Array.isArray(pkt.targets)) {
    const repoRoot = pkt.environment?.cwd || process.cwd();
    
    for (const target of pkt.targets) {
      if (!target.path) {
        errors.push("Target missing 'path' field");
        continue;
      }

      const fullPath = resolve(repoRoot, target.path);
      
      if (!existsSync(fullPath)) {
        errors.push(`Target file does not exist: ${target.path}`);
      }
    }
  }

  // 3. Path allowlist validation (if targets provided)
  if (pkt.targets && Array.isArray(pkt.targets)) {
    for (const target of pkt.targets) {
      if (!target.path) continue;

      const path = target.path;

      // Check forbidden patterns first
      const isForbidden = FORBIDDEN_PATH_PATTERNS.some(pattern => pattern.test(path));
      if (isForbidden) {
        errors.push(`Target path is forbidden: ${path} (matches denylist)`);
        continue;
      }

      // Check allowed patterns
      const isAllowed = ALLOWED_PATH_PATTERNS.some(pattern => pattern.test(path));
      if (!isAllowed) {
        errors.push(`Target path not in allowlist: ${path}`);
      }
    }
  }

  // 4. Test commands validation (whitelist-based)
  // Note: testCommands are already normalized by normalizeFailurePacket()
  try {
    validateTestCommandsOrThrow(pkt.testCommands ?? []);
  } catch (err: any) {
    errors.push(err.message);
  }

  // Throw if any errors
  if (errors.length > 0) {
    throw new Error(`FailurePacket validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
}

/**
 * 3. preflightFailurePacket
 * 
 * Orchestrates normalize → validate → return result.
 * 
 * Returns:
 * - { ok: true } if validation passes
 * - { ok: false, stopReason, errors[] } if validation fails
 */
export function preflightFailurePacket(pkt: any): PreflightResult {
  try {
    // Step 1: Normalize
    const normalized = normalizeFailurePacket(pkt);

    // Step 2: Validate
    validateFailurePacketOrThrow(normalized);

    // Step 3: Success
    return { ok: true };
  } catch (error) {
    // Extract errors from validation error message
    const message = error instanceof Error ? error.message : String(error);
    const errors = message
      .split('\n')
      .slice(1) // Skip first line ("FailurePacket validation failed:")
      .map(line => line.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);

    // Determine stopReason based on error types
    let stopReason: string = PREFLIGHT_STOP_REASONS.PACKET_INVALID;

    if (errors.some(e => e.includes("does not exist"))) {
      stopReason = PREFLIGHT_STOP_REASONS.TARGET_MISSING;
    } else if (errors.some(e => e.includes("forbidden") || e.includes("not in allowlist"))) {
      stopReason = PREFLIGHT_STOP_REASONS.TARGET_FORBIDDEN;
    } else if (errors.some(e => e.includes("testCommands"))) {
      stopReason = PREFLIGHT_STOP_REASONS.TEST_COMMANDS_INVALID;
    }

    return {
      ok: false,
      stopReason,
      errors,
    };
  }
}

/**
 * Check if a path matches the allowlist
 * (Exported for testing)
 */
export function isPathAllowed(path: string): boolean {
  // Check forbidden first
  if (FORBIDDEN_PATH_PATTERNS.some(pattern => pattern.test(path))) {
    return false;
  }

  // Check allowed
  return ALLOWED_PATH_PATTERNS.some(pattern => pattern.test(path));
}
