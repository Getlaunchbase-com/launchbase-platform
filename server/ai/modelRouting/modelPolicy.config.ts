/**
 * Model Policy Configuration
 * 
 * Defines task → model constraints + preferred ordering.
 */

import { ModelConstraints } from "./modelRouting.types";

export type TaskPolicy = {
  task: string;
  // ranked model id preferences. Supports wildcard suffix "*"
  preferredModelIds?: string[];
  constraints: ModelConstraints;
  fallbackLimit?: number; // default 5
};

export const MODEL_POLICIES: TaskPolicy[] = [
  {
    task: "chat",
    preferredModelIds: ["gpt-*-latest", "gpt-4.1*", "gpt-4o*"],
    constraints: {
      type: "text",
      requiredFeatures: [],
      minContextLength: 16000,
      preferPinned: false,
    },
    fallbackLimit: 5,
  },
  {
    task: "json",
    preferredModelIds: ["gpt-*-latest", "gpt-4.1*", "gpt-4o-mini*"],
    constraints: {
      type: "chat-completion",
      // Use internal capability name; featureAliases.ts maps to vendor strings
      requiredFeatures: ["json_schema"],
      minContextLength: 16000,
      preferPinned: false, // AIML doesn't expose pinned status, disable filter
    },
    fallbackLimit: 5,
  },
  {
    task: "embedding",
    preferredModelIds: ["text-embedding-*"],
    constraints: {
      type: "embedding",
    },
    fallbackLimit: 3,
  },
];
