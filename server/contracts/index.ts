/**
 * Contracts — Single Canonical Source
 *
 * ALL contract definitions, validators, schemas, and governance live in
 * this directory. This is the ONLY authoritative source for contracts.
 *
 * Agent-stack MUST validate via the /api/contracts/handshake endpoint
 * at startup. If schema hashes diverge, the handshake rejects and the
 * agent refuses to dispatch frozen tools.
 *
 * Contract files:
 *   - BlueprintParseV1.schema.json   → Parse output schema
 *   - EstimateChainV1.schema.json    → Estimate output schema
 *   - IBEW_LV_TaskLibrary_v1.json    → Task library (rates, materials)
 *   - vertex_freeze_registry.json    → Frozen contract versions
 *
 * Validators:
 *   - validateBlueprintParse.ts      → BlueprintParseV1 runtime validator
 *   - validateEstimateChainV1.ts     → EstimateChainV1 runtime validator
 *   - handshake.ts                   → Cross-repo handshake + hash check
 *   - freeze_governance.ts           → Mutation gate for frozen contracts
 *   - gap_detection_rules.ts         → Gap detection validators
 *
 * RULE: If you need a contract type or validator, import from here.
 * Do NOT create contract files in any other directory.
 */

// Blueprint parse contract
export {
  validateBlueprintParseV1,
  getSchemaHash as getBlueprintSchemaHash,
} from "./validateBlueprintParse";
export type {
  BlueprintParseV1Output,
  BlueprintParseV1Contract,
  BlueprintParseV1Page,
  BlueprintParseV1TextBlock,
  BlueprintParseV1LegendCandidate,
  BlueprintParseV1ScaleCandidate,
  BlueprintParseV1Error,
  BlueprintParseV1BBox,
  ValidationResult,
} from "./validateBlueprintParse";

// Estimate chain contract
export {
  validateEstimateChainV1,
  getEstimateSchemaHash,
} from "./validateEstimateChainV1";
export type { EstimateValidationResult } from "./validateEstimateChainV1";

// Handshake + hash verification
export {
  validateHandshake,
  computeSchemaHash,
  getAllContractInfo,
} from "./handshake";

// Freeze governance
export { getFreezeStatus, enforceFreezeGate } from "./freeze_governance";
