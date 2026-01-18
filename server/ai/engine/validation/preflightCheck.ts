/**
 * Preflight Check System
 * 
 * Validates tournament readiness using registrySnapshot and preflightRecords from baseline.
 * Prevents wasted runs by blocking stacks with missing models or known truncation risks.
 */

import fs from 'fs';

export interface PreflightResult {
  passed: boolean;
  blockedStacks: string[];
  missingModels: string[];
  truncationRisks: Array<{
    modelId: string;
    recommendation: string;
  }>;
  warnings: string[];
  message: string;
}

export interface ChallengerStack {
  name: string;
  models: {
    systems?: string;
    brand?: string;
    critic?: string;
  };
}

/**
 * Load baseline preflight records
 */
function loadPreflightRecords(baselinePath: string): any {
  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    return baseline.challengerCatalog?.preflightRecords || null;
  } catch (error) {
    console.error('[PreflightCheck] Failed to load baseline:', error);
    return null;
  }
}

/**
 * Load baseline registry snapshot
 */
function loadRegistrySnapshot(baselinePath: string): any {
  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    return baseline.challengerCatalog?.registrySnapshot || null;
  } catch (error) {
    console.error('[PreflightCheck] Failed to load baseline:', error);
    return null;
  }
}

/**
 * Check if a model is available in registry
 */
function isModelAvailable(modelId: string, registrySnapshot: any): boolean {
  if (!registrySnapshot) return false;
  
  const { verifiedAvailable, knownUnavailable, pendingVerification } = registrySnapshot;
  
  // Known unavailable → block
  if (knownUnavailable?.includes(modelId)) {
    return false;
  }
  
  // Verified available → allow
  if (verifiedAvailable?.includes(modelId)) {
    return true;
  }
  
  // Pending verification → warn but allow (will be tested in pilot)
  if (pendingVerification?.includes(modelId)) {
    return true;
  }
  
  // Unknown model → warn but allow
  return true;
}

/**
 * Check if a model has known truncation risk
 */
function hasTruncationRisk(modelId: string, registrySnapshot: any): boolean {
  if (!registrySnapshot) return false;
  return registrySnapshot.knownTruncationRisk?.includes(modelId) || false;
}

/**
 * Get truncation recommendation for a model
 */
function getTruncationRecommendation(modelId: string, preflightRecords: any): string | null {
  if (!preflightRecords?.truncationFailures) return null;
  
  const failure = preflightRecords.truncationFailures.find((f: any) => f.modelId === modelId);
  return failure?.recommendation || null;
}

/**
 * Validate a challenger stack against preflight records
 */
export function validateChallengerStack(
  stack: ChallengerStack,
  baselinePath: string
): PreflightResult {
  const preflightRecords = loadPreflightRecords(baselinePath);
  const registrySnapshot = loadRegistrySnapshot(baselinePath);
  
  if (!preflightRecords || !registrySnapshot) {
    return {
      passed: false,
      blockedStacks: [stack.name],
      missingModels: [],
      truncationRisks: [],
      warnings: [],
      message: '❌ PREFLIGHT FAILED: Could not load baseline preflight records or registry snapshot',
    };
  }

  const missingModels: string[] = [];
  const truncationRisks: Array<{ modelId: string; recommendation: string }> = [];
  const warnings: string[] = [];

  // Check each model in the stack
  for (const [role, modelId] of Object.entries(stack.models)) {
    if (!modelId) continue;

    // Check availability
    if (!isModelAvailable(modelId, registrySnapshot)) {
      missingModels.push(modelId);
      warnings.push(`Model ${modelId} (${role}) is not available in registry`);
    }

    // Check truncation risk
    if (hasTruncationRisk(modelId, registrySnapshot)) {
      const recommendation = getTruncationRecommendation(modelId, preflightRecords);
      if (recommendation) {
        truncationRisks.push({ modelId, recommendation });
        warnings.push(`Model ${modelId} (${role}) has known truncation risk: ${recommendation}`);
      }
    }
  }

  // Determine if stack is blocked
  const isBlocked = missingModels.length > 0 || preflightRecords.blockedStacks?.includes(stack.name);

  if (isBlocked) {
    return {
      passed: false,
      blockedStacks: [stack.name],
      missingModels,
      truncationRisks,
      warnings,
      message: `❌ PREFLIGHT FAILED: Stack "${stack.name}" is blocked\n  - Missing models: ${missingModels.join(', ') || 'none'}\n  - Blocked by baseline: ${preflightRecords.blockedStacks?.includes(stack.name) ? 'yes' : 'no'}`,
    };
  }

  if (truncationRisks.length > 0) {
    return {
      passed: true,
      blockedStacks: [],
      missingModels: [],
      truncationRisks,
      warnings,
      message: `⚠️  PREFLIGHT WARNING: Stack "${stack.name}" has truncation risks\n${truncationRisks.map(r => `  - ${r.modelId}: ${r.recommendation}`).join('\n')}\n\nProceed with caution or apply recommended maxTokens adjustments.`,
    };
  }

  return {
    passed: true,
    blockedStacks: [],
    missingModels: [],
    truncationRisks: [],
    warnings,
    message: `✅ PREFLIGHT PASSED: Stack "${stack.name}" is ready for tournament`,
  };
}

/**
 * Validate multiple challenger stacks
 */
export function validateChallengerStacks(
  stacks: ChallengerStack[],
  baselinePath: string
): PreflightResult {
  const results = stacks.map(stack => validateChallengerStack(stack, baselinePath));

  const allPassed = results.every(r => r.passed);
  const blockedStacks = results.flatMap(r => r.blockedStacks);
  const missingModels = [...new Set(results.flatMap(r => r.missingModels))];
  const truncationRisks = results.flatMap(r => r.truncationRisks);
  const warnings = results.flatMap(r => r.warnings);

  if (!allPassed) {
    return {
      passed: false,
      blockedStacks,
      missingModels,
      truncationRisks,
      warnings,
      message: `❌ PREFLIGHT FAILED: ${blockedStacks.length} stack(s) blocked\n  - Blocked stacks: ${blockedStacks.join(', ')}\n  - Missing models: ${missingModels.join(', ') || 'none'}`,
    };
  }

  if (truncationRisks.length > 0) {
    return {
      passed: true,
      blockedStacks: [],
      missingModels: [],
      truncationRisks,
      warnings,
      message: `⚠️  PREFLIGHT WARNING: ${truncationRisks.length} model(s) have truncation risks\n${truncationRisks.map(r => `  - ${r.modelId}: ${r.recommendation}`).join('\n')}`,
    };
  }

  return {
    passed: true,
    blockedStacks: [],
    missingModels: [],
    truncationRisks: [],
    warnings,
    message: `✅ PREFLIGHT PASSED: All ${stacks.length} stack(s) ready for tournament`,
  };
}
