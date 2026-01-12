/**
 * Model Routing Types
 * 
 * Types for model registry, policy resolution, and routing.
 */

export type ModelType = "text" | "image" | "video" | "audio" | "embedding" | "other";

export type NormalizedModel = {
  id: string;
  type: ModelType;
  developer?: string;
  name?: string;
  description?: string;
  contextLength?: number;
  features: string[];
  url?: string;
  raw?: unknown;
};

export type ModelRegistryState = {
  models: Map<string, NormalizedModel>;
  lastRefreshAt?: number; // epoch ms
  stale: boolean;
  lastError?: string;
};

export type ModelConstraints = {
  type: ModelType;
  minContextLength?: number;
  requiredFeatures?: string[];
  developerAllowlist?: string[];
  developerDenylist?: string[];
  preferPinned?: boolean;
};

export type ModelResolution = {
  primary: NormalizedModel;
  fallbacks: NormalizedModel[];
  reason: {
    task: string;
    appliedConstraints: ModelConstraints;
    candidatesConsidered: number;
    filteredOut: Record<string, number>; // reason -> count
    ranking: string[];
  };
};
