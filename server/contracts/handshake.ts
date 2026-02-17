/**
 * Contract Handshake — Cross-system integrity enforcement
 *
 * At agent/worker boot, callers POST their known contract versions and
 * schema hashes. The platform compares against the freeze registry and
 * returns a pass/fail verdict.
 *
 * If any contract is mismatched, the agent MUST refuse to dispatch frozen
 * tools and exit. This prevents silent drift between platform and agent.
 *
 * Usage:
 *   1. Agent startup → POST /api/contracts/handshake with its known contracts
 *   2. Platform validates each { name, version, schema_hash }
 *   3. Returns { ok: true } or { ok: false, mismatches: [...] }
 */

import { createHash } from "crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContractClaim {
  name: string;
  version: string;
  schema_hash: string;
}

export interface HandshakeRequest {
  agent_id: string;
  agent_version: string;
  contracts: ContractClaim[];
}

export interface ContractMismatch {
  name: string;
  field: "version" | "schema_hash" | "unknown_contract";
  expected: string;
  received: string;
}

export interface HandshakeResult {
  ok: boolean;
  timestamp: string;
  vertex: string;
  vertex_version: string;
  mismatches: ContractMismatch[];
}

// ---------------------------------------------------------------------------
// Schema hash computation (deterministic)
// ---------------------------------------------------------------------------

const _hashCache = new Map<string, string>();

/**
 * Compute SHA-256 hash of a contract schema file.
 * Cached per filename for the lifetime of the process.
 */
export function computeSchemaHash(schemaFilename: string): string {
  const cached = _hashCache.get(schemaFilename);
  if (cached) return cached;

  const schemaPath = path.resolve(__dirname, schemaFilename);

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Contract schema file not found: ${schemaPath}`);
  }

  const content = fs.readFileSync(schemaPath, "utf-8");
  // Normalize: parse and re-stringify to ignore formatting differences
  const normalized = JSON.stringify(JSON.parse(content));
  const hash = createHash("sha256").update(normalized).digest("hex");

  _hashCache.set(schemaFilename, hash);
  return hash;
}

// ---------------------------------------------------------------------------
// Registry loader
// ---------------------------------------------------------------------------

interface FreezeContract {
  name: string;
  version: string;
  schema_file: string;
  status: string;
}

interface FreezeRegistry {
  vertex: string;
  version: string;
  status: string;
  contracts: FreezeContract[];
}

let _registry: FreezeRegistry | null = null;

function loadRegistry(): FreezeRegistry {
  if (_registry) return _registry;
  const p = path.resolve(__dirname, "./vertex_freeze_registry.json");
  _registry = JSON.parse(fs.readFileSync(p, "utf-8")) as FreezeRegistry;
  return _registry;
}

// ---------------------------------------------------------------------------
// Handshake validation
// ---------------------------------------------------------------------------

/**
 * Validate an agent's contract claims against the freeze registry.
 *
 * Returns { ok: true } if all contracts match, or { ok: false, mismatches }
 * if any version or schema hash disagrees.
 */
export function validateHandshake(req: HandshakeRequest): HandshakeResult {
  const registry = loadRegistry();
  const mismatches: ContractMismatch[] = [];

  for (const claim of req.contracts) {
    const registered = registry.contracts.find((c) => c.name === claim.name);

    if (!registered) {
      mismatches.push({
        name: claim.name,
        field: "unknown_contract",
        expected: "(not in registry)",
        received: `${claim.name}@${claim.version}`,
      });
      continue;
    }

    // Version check
    if (registered.version !== claim.version) {
      mismatches.push({
        name: claim.name,
        field: "version",
        expected: registered.version,
        received: claim.version,
      });
    }

    // Schema hash check (only if contract is locked)
    if (registered.status === "locked") {
      const expectedHash = computeSchemaHash(registered.schema_file);
      if (expectedHash !== claim.schema_hash) {
        mismatches.push({
          name: claim.name,
          field: "schema_hash",
          expected: expectedHash,
          received: claim.schema_hash,
        });
      }
    }
  }

  // Check for contracts in registry that the agent didn't claim
  for (const reg of registry.contracts) {
    if (reg.status === "locked" && !req.contracts.some((c) => c.name === reg.name)) {
      mismatches.push({
        name: reg.name,
        field: "unknown_contract",
        expected: `${reg.name}@${reg.version} (required)`,
        received: "(not claimed by agent)",
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    timestamp: new Date().toISOString(),
    vertex: registry.vertex,
    vertex_version: registry.version,
    mismatches,
  };
}

/**
 * Get contract info for a specific contract (used by agents to self-check).
 */
export function getContractInfo(contractName: string) {
  const registry = loadRegistry();
  const contract = registry.contracts.find((c) => c.name === contractName);

  if (!contract) return null;

  return {
    name: contract.name,
    version: contract.version,
    status: contract.status,
    schema_hash: computeSchemaHash(contract.schema_file),
    vertex: registry.vertex,
    vertex_version: registry.version,
  };
}

/**
 * Get all contract info (used by agents on startup).
 */
export function getAllContractInfo() {
  const registry = loadRegistry();

  return {
    vertex: registry.vertex,
    vertex_version: registry.version,
    status: registry.status,
    contracts: registry.contracts.map((c) => ({
      name: c.name,
      version: c.version,
      status: c.status,
      schema_hash: computeSchemaHash(c.schema_file),
    })),
  };
}
