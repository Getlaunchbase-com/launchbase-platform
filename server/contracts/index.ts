/**
 * Barrel export for all contracts
 * Ensures all contract types and utilities are accessible from a single import
 * 
 * Note: Using explicit exports to avoid name collisions between preflight schemas
 * and full contract types (FailurePacketV1, RepairPacketV1)
 */

// Preflight contracts (Zod schemas for validation)
export * from "./preflight";

// Full contract types (from dedicated files)
export type { FailurePacketV1 } from "./failurePacket";
export { validateFailurePacket, EXAMPLE_FAILURE_PACKET } from "./failurePacket";
export type { RepairPacketV1 } from "./repairPacket";
export { validateRepairPacket, EXAMPLE_REPAIR_PACKET } from "./repairPacket";

// Other contracts
export * from "./scoreCard";
export * from "./pagePlan";
