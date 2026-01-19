/**
 * Preflight Policy Check (Simplified)
 * 
 * Validates that all policies have the required structure before running tournaments.
 * 
 * Purpose: Prevent "fake tournament" runs where policies are malformed or missing roles.
 */

export interface PreflightResult {
  success: boolean;
  missingRoles: string[];
  validatedRoles: string[];
  totalRoles: number;
}

/**
 * Check if a policy has all required roles for a lane
 */
export function preflightPolicyCheck(
  policy: any,
  requiredRoles: string[]
): PreflightResult {
  const validatedRoles: string[] = [];
  const missingRoles: string[] = [];
  
  // Check each required role
  for (const roleName of requiredRoles) {
    const roleConfig = policy.roles?.[roleName];
    
    if (roleConfig && roleConfig.model) {
      validatedRoles.push(roleName);
      console.log(`[PREFLIGHT] ✅ ${roleName}: ${roleConfig.model}`);
    } else {
      missingRoles.push(roleName);
      console.error(`[PREFLIGHT] ❌ ${roleName}: missing or invalid`);
    }
  }
  
  const success = missingRoles.length === 0;
  const totalRoles = requiredRoles.length;
  
  if (success) {
    console.log(`[PREFLIGHT] ✅ All ${totalRoles} roles validated`);
  } else {
    console.error(`[PREFLIGHT] ❌ ${missingRoles.length}/${totalRoles} roles missing`);
  }
  
  return {
    success,
    missingRoles,
    validatedRoles,
    totalRoles,
  };
}

/**
 * Check multiple policies at once (for tournament scenarios)
 */
export function preflightMultiplePolicies(
  policies: Array<{ name: string; policy: any; requiredRoles: string[] }>
): { success: boolean; results: Map<string, PreflightResult> } {
  console.log(`[PREFLIGHT] Checking ${policies.length} policies...`);
  
  const results = new Map<string, PreflightResult>();
  let allSuccess = true;
  
  for (const { name, policy, requiredRoles } of policies) {
    console.log(`\n[PREFLIGHT] Policy: ${name}`);
    const result = preflightPolicyCheck(policy, requiredRoles);
    results.set(name, result);
    
    if (!result.success) {
      allSuccess = false;
    }
  }
  
  if (allSuccess) {
    console.log(`\n[PREFLIGHT] ✅ All ${policies.length} policies validated`);
  } else {
    console.error(`\n[PREFLIGHT] ❌ Some policies have missing roles`);
  }
  
  return { success: allSuccess, results };
}

/**
 * Pretty print preflight results
 */
export function printPreflightReport(results: Map<string, PreflightResult>): void {
  console.log("\n" + "=".repeat(60));
  console.log("PREFLIGHT POLICY CHECK REPORT");
  console.log("=".repeat(60));
  
  for (const [policyName, result] of Array.from(results.entries())) {
    console.log(`\n📦 Policy: ${policyName}`);
    console.log(`  Total roles: ${result.totalRoles}`);
    console.log(`  Validated: ${result.validatedRoles.length}`);
    console.log(`  Missing: ${result.missingRoles.length}`);
    
    if (result.missingRoles.length > 0) {
      console.log(`  ❌ Missing roles:`);
      for (const role of result.missingRoles) {
        console.log(`     - ${role}`);
      }
    } else {
      console.log(`  ✅ All roles found`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
}
