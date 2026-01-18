/**
 * Specialists Barrel Export
 * 
 * Single stable import path for specialist adapters.
 * Enables clean mocking in tests.
 */

export { callSpecialistAIML } from "./aimlSpecialist";
export type {
  SpecialistStopReason,
  SpecialistRoleConfig,
  SpecialistInput,
  SpecialistOutput,
} from "./aimlSpecialist";
