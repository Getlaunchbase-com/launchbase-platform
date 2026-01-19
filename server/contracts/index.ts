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
export { FailurePacketV1, validateFailurePacket, EXAMPLE_FAILURE_PACKET } from "./failurePacket";
export { RepairPacketV1, validateRepairPacket, EXAMPLE_REPAIR_PACKET } from "./repairPacket";

// Other contracts
export * from "./scoreCard";
export * from "./pagePlan";
