/**
 * Integrity Enforcement Module
 * 
 * Enforces 4 deterministic invalidation rules to make tournaments scientifically defensible:
 * 1. Schema hash mismatch = INVALID
 * 2. Silent model fallback = INVALID
 * 3. Truncation = INVALID
 * 4. Missing artifacts = INVALID
 * 
 * This is what makes it "real science" instead of vibes.
 */

import { preflightSchemaHashCheck } from './schemaHashValidator';
import fs from 'fs';
import path from 'path';

export interface IntegrityConfig {
  requireSchemaHashMatch: boolean;
  rejectSilentModelFallback: boolean;
  rejectTruncation: boolean;
  rejectMissingArtifacts: boolean;
}

export interface IntegrityViolation {
  type: 'SCHEMA_HASH_MISMATCH' | 'MODEL_FALLBACK' | 'TRUNCATION' | 'MISSING_ARTIFACTS';
  message: string;
  details: any;
}

export interface IntegrityCheckResult {
  valid: boolean;
  violations: IntegrityViolation[];
  message: string;
}

/**
 * Load integrity config from baseline
 */
export function loadIntegrityConfig(baselinePath: string): IntegrityConfig | null {
  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    return baseline.integrity || null;
  } catch (error) {
    console.error('[IntegrityEnforcement] Failed to load baseline:', error);
    return null;
  }
}

/**
 * Step 1: Enforce schema hash matching at runtime (hard fail)
 * 
 * Run this at tournament runner startup BEFORE any API calls.
 */
export function enforceSchemaHashMatch(baselinePath: string): IntegrityCheckResult {
  const config = loadIntegrityConfig(baselinePath);
  
  if (!config?.requireSchemaHashMatch) {
    return {
      valid: true,
      violations: [],
      message: '✅ Schema hash enforcement disabled',
    };
  }

  try {
    const validation = preflightSchemaHashCheck(baselinePath, true);
    
    if (!validation.valid) {
      return {
        valid: false,
        violations: [{
          type: 'SCHEMA_HASH_MISMATCH',
          message: 'Schema hash mismatch detected',
          details: validation.mismatches,
        }],
        message: `❌ [INTEGRITY] Schema hash mismatch — refusing to run.\n${validation.message}`,
      };
    }

    return {
      valid: true,
      violations: [],
      message: '✅ Schema hash match verified',
    };
  } catch (error: any) {
    return {
      valid: false,
      violations: [{
        type: 'SCHEMA_HASH_MISMATCH',
        message: error.message,
        details: {},
      }],
      message: `❌ [INTEGRITY] ${error.message}`,
    };
  }
}

/**
 * Step 2: Enforce MODEL_LOCK = Scientific contract (binding enforcement)
 * 
 * Check per specialist call: requestedModelId must equal resolvedModelId.
 */
export function enforceModelLock(
  requestedModelId: string,
  resolvedModelId: string,
  baselinePath: string
): IntegrityCheckResult {
  const config = loadIntegrityConfig(baselinePath);
  
  if (!config?.rejectSilentModelFallback) {
    return {
      valid: true,
      violations: [],
      message: '✅ Model fallback enforcement disabled',
    };
  }

  if (requestedModelId !== resolvedModelId) {
    return {
      valid: false,
      violations: [{
        type: 'MODEL_FALLBACK',
        message: 'Silent model fallback detected',
        details: { requested: requestedModelId, resolved: resolvedModelId },
      }],
      message: `❌ [INTEGRITY] MODEL_LOCK violation: requested ${requestedModelId}, got ${resolvedModelId}`,
    };
  }

  return {
    valid: true,
    violations: [],
    message: '✅ MODEL_LOCK verified',
  };
}

/**
 * Step 3: Reject truncation globally
 * 
 * Check per specialist call: finishReason must not be 'length'.
 */
export function rejectTruncation(
  finishReason: string,
  jsonOutput: any,
  baselinePath: string
): IntegrityCheckResult {
  const config = loadIntegrityConfig(baselinePath);
  
  if (!config?.rejectTruncation) {
    return {
      valid: true,
      violations: [],
      message: '✅ Truncation rejection disabled',
    };
  }

  // Check finish reason
  if (finishReason === 'length') {
    return {
      valid: false,
      violations: [{
        type: 'TRUNCATION',
        message: 'Truncation detected (finishReason=length)',
        details: { finishReason },
      }],
      message: `❌ [INTEGRITY] Truncation detected: finishReason='length'`,
    };
  }

  // Check for JSON truncation (missing closing braces/brackets)
  const jsonStr = JSON.stringify(jsonOutput);
  const openBraces = (jsonStr.match(/{/g) || []).length;
  const closeBraces = (jsonStr.match(/}/g) || []).length;
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/]/g) || []).length;

  if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
    return {
      valid: false,
      violations: [{
        type: 'TRUNCATION',
        message: 'JSON truncation detected (mismatched braces/brackets)',
        details: { openBraces, closeBraces, openBrackets, closeBrackets },
      }],
      message: `❌ [INTEGRITY] JSON truncation detected: {${openBraces}/${closeBraces}, [${openBrackets}/${closeBrackets}]`,
    };
  }

  return {
    valid: true,
    violations: [],
    message: '✅ No truncation detected',
  };
}

/**
 * Step 4: Require full artifact set or invalidate
 * 
 * Check after run completion: all expected artifacts must be present.
 */
export function validateArtifacts(
  runDir: string,
  expectedArtifacts: string[],
  baselinePath: string
): IntegrityCheckResult {
  const config = loadIntegrityConfig(baselinePath);
  
  if (!config?.rejectMissingArtifacts) {
    return {
      valid: true,
      violations: [],
      message: '✅ Artifact validation disabled',
    };
  }

  const missingArtifacts: string[] = [];

  for (const artifact of expectedArtifacts) {
    const artifactPath = path.join(runDir, artifact);
    if (!fs.existsSync(artifactPath)) {
      missingArtifacts.push(artifact);
    }
  }

  if (missingArtifacts.length > 0) {
    return {
      valid: false,
      violations: [{
        type: 'MISSING_ARTIFACTS',
        message: 'Missing expected artifacts',
        details: { missing: missingArtifacts, expected: expectedArtifacts },
      }],
      message: `❌ [INTEGRITY] Missing artifacts: ${missingArtifacts.join(', ')}`,
    };
  }

  return {
    valid: true,
    violations: [],
    message: '✅ All artifacts present',
  };
}

/**
 * Run all integrity checks at tournament startup
 * 
 * This is the single entry point for all integrity enforcement.
 * Call this BEFORE any API calls.
 */
export function enforceIntegrityAtStartup(baselinePath: string): IntegrityCheckResult {
  console.log('\n🔒 [INTEGRITY] Running startup checks...\n');

  // Step 1: Schema hash match
  const schemaCheck = enforceSchemaHashMatch(baselinePath);
  console.log(`  ${schemaCheck.message}`);
  
  if (!schemaCheck.valid) {
    return schemaCheck;
  }

  console.log('\n✅ [INTEGRITY] All startup checks passed\n');

  return {
    valid: true,
    violations: [],
    message: '✅ Integrity checks passed',
  };
}

/**
 * Run per-call integrity checks
 * 
 * Call this after each specialist call to validate MODEL_LOCK and truncation.
 */
export function enforceIntegrityPerCall(
  requestedModelId: string,
  resolvedModelId: string,
  finishReason: string,
  jsonOutput: any,
  baselinePath: string
): IntegrityCheckResult {
  const violations: IntegrityViolation[] = [];

  // Step 2: MODEL_LOCK
  const modelCheck = enforceModelLock(requestedModelId, resolvedModelId, baselinePath);
  if (!modelCheck.valid) {
    violations.push(...modelCheck.violations);
  }

  // Step 3: Truncation
  const truncationCheck = rejectTruncation(finishReason, jsonOutput, baselinePath);
  if (!truncationCheck.valid) {
    violations.push(...truncationCheck.violations);
  }

  if (violations.length > 0) {
    return {
      valid: false,
      violations,
      message: `❌ [INTEGRITY] ${violations.length} violation(s): ${violations.map(v => v.type).join(', ')}`,
    };
  }

  return {
    valid: true,
    violations: [],
    message: '✅ Per-call integrity checks passed',
  };
}

/**
 * Run post-run integrity checks
 * 
 * Call this after run completion to validate artifacts.
 */
export function enforceIntegrityPostRun(
  runDir: string,
  expectedArtifacts: string[],
  baselinePath: string
): IntegrityCheckResult {
  // Step 4: Artifacts
  return validateArtifacts(runDir, expectedArtifacts, baselinePath);
}
