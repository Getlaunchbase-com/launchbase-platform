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
import { getDb } from "../db";
import { agentRuntimeStatus } from "../db/schema";
import { eq } from "drizzle-orm";

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
 * Deep-sort an object's keys for stable JSON serialization.
 * Arrays preserve order; objects get sorted keys recursively.
 */
function sortDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortDeep);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortDeep((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Stable SHA-256 hash of any JSON-serializable object.
 * Keys are deep-sorted to ensure deterministic output regardless of
 * insertion order. This is the canonical hash function for all contracts.
 */
export function stableHash(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(sortDeep(obj))).digest("hex");
}

/**
 * Compute SHA-256 hash of a contract schema file.
 * Uses stableHash (sorted-key JSON) to guarantee deterministic output
 * regardless of JSON formatting or key order in the file.
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
  const parsed = JSON.parse(content);
  const hash = stableHash(parsed);

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
    manifest_hash: getManifestHash(),
    contracts: registry.contracts.map((c) => ({
      name: c.name,
      version: c.version,
      status: c.status,
      schema_hash: computeSchemaHash(c.schema_file),
    })),
  };
}

/**
 * Compute a stable hash of the full contract manifest (registry + all schema hashes).
 * This is the single authoritative fingerprint for the entire contract surface.
 */
export function getManifestHash(): string {
  const registry = loadRegistry();
  const manifest = {
    vertex: registry.vertex,
    version: registry.version,
    contracts: registry.contracts.map((c) => ({
      name: c.name,
      version: c.version,
      schema_hash: computeSchemaHash(c.schema_file),
    })),
  };
  return stableHash(manifest);
}

/**
 * Log a handshake mismatch to the database (best-effort, never throws).
 */
export async function logHandshakeMismatch(
  agentId: string,
  agentVersion: string,
  result: HandshakeResult
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Upsert agent runtime status to "mismatch"
    const [existing] = await db
      .select({ id: agentRuntimeStatus.id })
      .from(agentRuntimeStatus)
      .where(eq(agentRuntimeStatus.vertex, result.vertex))
      .limit(1);

    const data = {
      vertex: result.vertex,
      version: result.vertex_version,
      schemaHash: getManifestHash(),
      handshakeOk: false,
      status: "mismatch" as const,
      lastSeen: new Date(),
      violations: result.mismatches.map((m) => ({
        type: "contract_mismatch",
        message: `${m.name} [${m.field}]: expected "${m.expected}", received "${m.received}"`,
        detectedAt: new Date().toISOString(),
      })),
      metadata: { agentId, agentVersion } as Record<string, unknown>,
    };

    if (existing) {
      await db.update(agentRuntimeStatus).set(data).where(eq(agentRuntimeStatus.id, existing.id));
    } else {
      await db.insert(agentRuntimeStatus).values(data);
    }
  } catch {
    // best-effort logging
  }
}
