/**
 * Freeze Governance Gate
 *
 * Enforces the vertex freeze protocol. Any mutation that would change
 * frozen contract behavior, schema shapes, confidence math, or task
 * library defaults must be routed through:
 *   1. A feedback item
 *   2. An improvement proposal (reviewed + approved)
 *   3. A new contract version (V2)
 *
 * Never a hot patch.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FreezeStatus {
  frozen: boolean;
  vertex: string | null;
  version: string | null;
  frozenAt: string | null;
  allowedActions: string[];
  blockedActions: string[];
  changeRoutes: string[];
}

interface FreezeRegistry {
  vertex: string;
  version: string;
  status: string;
  frozen_at: string;
  contracts: Array<{ name: string; status: string }>;
  not_allowed_until_v2: string[];
  allowed_after_freeze: string[];
  governance: { change_routes: string[]; hot_patches: string };
}

// ---------------------------------------------------------------------------
// Registry loader (cached)
// ---------------------------------------------------------------------------

let _cached: FreezeRegistry | null = null;

function loadRegistry(): FreezeRegistry {
  if (_cached) return _cached;
  const p = path.resolve(__dirname, "./vertex_freeze_registry.json");
  _cached = JSON.parse(fs.readFileSync(p, "utf-8")) as FreezeRegistry;
  return _cached;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a specific contract is frozen.
 */
export function isContractFrozen(contractName: string): boolean {
  const reg = loadRegistry();
  if (reg.status !== "frozen") return false;
  return reg.contracts.some((c) => c.name === contractName && c.status === "locked");
}

/**
 * Get the full freeze status for display / governance.
 */
export function getFreezeStatus(): FreezeStatus {
  const reg = loadRegistry();
  return {
    frozen: reg.status === "frozen",
    vertex: reg.vertex,
    version: reg.version,
    frozenAt: reg.frozen_at,
    allowedActions: reg.allowed_after_freeze,
    blockedActions: reg.not_allowed_until_v2,
    changeRoutes: reg.governance.change_routes,
  };
}

/**
 * Enforce the freeze gate on a mutation. Throws if the contract is frozen
 * and the caller has not provided an approved proposal ID or version bump.
 *
 * @param contractName - The contract being modified
 * @param opts - Optional bypass with approvedProposalId or newVersion flag
 */
export function enforceFreezeGate(
  contractName: string,
  opts?: { approvedProposalId?: number; isNewContractVersion?: boolean }
): void {
  if (!isContractFrozen(contractName)) return;

  // Allowed bypass: approved improvement proposal
  if (opts?.approvedProposalId) return;

  // Allowed bypass: creating a new contract version (V2)
  if (opts?.isNewContractVersion) return;

  throw new FreezeViolationError(
    contractName,
    `Contract '${contractName}' is frozen (IBEW_LV v1.0.0). ` +
    `Changes must go through: feedback item → improvement proposal → approval, ` +
    `or create a new contract version. Hot patches are never allowed.`
  );
}

/**
 * Custom error for freeze violations.
 */
export class FreezeViolationError extends Error {
  public readonly contractName: string;
  public readonly changeRoutes: string[];

  constructor(contractName: string, message: string) {
    super(message);
    this.name = "FreezeViolationError";
    this.contractName = contractName;
    this.changeRoutes = loadRegistry().governance.change_routes;
  }
}
