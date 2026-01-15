/**
 * Schema Hash Validator
 * 
 * Enforces baseline integrity by validating current schema hashes against baseline.
 * Any mismatch marks the entire run batch as INVALID (drift) and stops execution.
 * 
 * This prevents contamination from silent schema changes.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface SchemaHashValidationResult {
  valid: boolean;
  mismatches: Array<{
    schema: string;
    expected: string;
    actual: string;
  }>;
  message: string;
}

export interface BaselineSchemaHashes {
  craftOutputSchemaFast: string;
  craftOutputSchema: string;
  criticOutputSchema: string;
  contentValidator: string;
  truthPenalty: string;
}

/**
 * Compute SHA-256 hash of a file
 */
function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get current schema hashes from implementation files
 */
export function getCurrentSchemaHashes(): BaselineSchemaHashes {
  const projectRoot = path.resolve(__dirname, '../../../..');
  
  return {
    craftOutputSchemaFast: computeFileHash(path.join(projectRoot, 'server/ai/engine/specialists/aimlSpecialist.ts')),
    craftOutputSchema: computeFileHash(path.join(projectRoot, 'server/ai/engine/specialists/aimlSpecialist.ts')),
    criticOutputSchema: computeFileHash(path.join(projectRoot, 'server/ai/engine/specialists/aimlSpecialist.ts')),
    contentValidator: computeFileHash(path.join(projectRoot, 'server/ai/engine/specialists/contentValidator.ts')),
    truthPenalty: computeFileHash(path.join(projectRoot, 'server/ai/engine/scoring/truthPenalty.ts')),
  };
}

/**
 * Validate current schema hashes against baseline
 * 
 * @param baselineHashes - Expected hashes from baseline_truth_v1.2.json
 * @returns Validation result with mismatches if any
 */
export function validateSchemaHashes(baselineHashes: BaselineSchemaHashes): SchemaHashValidationResult {
  const currentHashes = getCurrentSchemaHashes();
  const mismatches: Array<{ schema: string; expected: string; actual: string }> = [];

  // Check each schema hash
  for (const [schema, expectedHash] of Object.entries(baselineHashes)) {
    const actualHash = currentHashes[schema as keyof BaselineSchemaHashes];
    if (actualHash !== expectedHash) {
      mismatches.push({
        schema,
        expected: expectedHash,
        actual: actualHash,
      });
    }
  }

  if (mismatches.length > 0) {
    const mismatchDetails = mismatches
      .map(m => `  - ${m.schema}: expected ${m.expected.substring(0, 12)}..., got ${m.actual.substring(0, 12)}...`)
      .join('\n');
    
    return {
      valid: false,
      mismatches,
      message: `❌ SCHEMA DRIFT DETECTED: ${mismatches.length} schema(s) changed since baseline:\n${mismatchDetails}\n\nThis run batch is INVALID. Update baseline_truth_v1.2.json or revert schema changes.`,
    };
  }

  return {
    valid: true,
    mismatches: [],
    message: '✅ Schema hash validation passed: All schemas match baseline',
  };
}

/**
 * Load baseline schema hashes from baseline_truth_v1.2.json
 */
export function loadBaselineSchemaHashes(baselinePath: string): BaselineSchemaHashes | null {
  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    
    if (!baseline.inputs?.schemaHashes) {
      console.error('[SchemaHashValidator] baseline_truth_v1.2.json missing inputs.schemaHashes');
      return null;
    }

    return baseline.inputs.schemaHashes as BaselineSchemaHashes;
  } catch (error) {
    console.error('[SchemaHashValidator] Failed to load baseline:', error);
    return null;
  }
}

/**
 * Preflight check: Validate schema hashes before tournament execution
 * 
 * @param baselinePath - Path to baseline_truth_v1.2.json
 * @param requireMatch - If true, throw error on mismatch (default: true)
 * @returns Validation result
 * @throws Error if requireMatch=true and validation fails
 */
export function preflightSchemaHashCheck(
  baselinePath: string,
  requireMatch: boolean = true
): SchemaHashValidationResult {
  const baselineHashes = loadBaselineSchemaHashes(baselinePath);
  
  if (!baselineHashes) {
    const result: SchemaHashValidationResult = {
      valid: false,
      mismatches: [],
      message: '❌ PREFLIGHT FAILED: Could not load baseline schema hashes',
    };
    
    if (requireMatch) {
      throw new Error(result.message);
    }
    
    return result;
  }

  const result = validateSchemaHashes(baselineHashes);
  
  if (!result.valid && requireMatch) {
    throw new Error(result.message);
  }

  return result;
}
