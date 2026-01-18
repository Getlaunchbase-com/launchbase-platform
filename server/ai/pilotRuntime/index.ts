/**
 * Pilot Runtime Façade
 * 
 * Centralized exports for pilot scripts to avoid deep imports and circular dependencies.
 * All exports are Node-safe (no Next/React/window dependencies).
 */

// Specialist calling
export { callSpecialistWithRetry, callSpecialistAIML } from '../engine/specialists/aimlSpecialist';
export type {
  SpecialistInput,
  SpecialistOutput,
  SpecialistRoleConfig,
  SpecialistStopReason,
} from '../engine/specialists/aimlSpecialist';

// Validation
export { validateAiOutput } from '../validateAiOutput';

// Scoring
export { calculateDesignerTruthPenalty, calculateCriticTruthPenalty } from '../engine/scoring/truthPenalty';
export type { TruthPenaltyResult, PenaltyBreakdown } from '../engine/scoring/truthPenalty';
export { scoreDesign } from '../../services/design/scoreDesign';
export { scoreDesignRun } from '../../services/design/scoreTournament';

// Types
export type { ArtifactV1 } from '../engine/types';
