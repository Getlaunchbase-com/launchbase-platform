/**
 * TypeScript types generated from AI contract schemas
 * These types enforce strict validation for all AI outputs
 */

// ============================================
// WHITELISTED KEYS (v1)
// ============================================

export type WhitelistedKey =
  | "hero.headline"
  | "hero.subheadline"
  | "hero.cta"
  | "trust.items"
  | "services.items"
  | "socialProof.reviews"
  | "socialProof.outcomes"
  | "socialProof.credentials"
  | "design.tokens";

// ============================================
// COPY PROPOSAL
// ============================================

export type CopyValue =
  | string // For hero.headline, hero.subheadline, hero.cta
  | TrustItem[]
  | ServiceItem[]
  | Review[]
  | Outcome[];

export interface TrustItem {
  text: string; // max 120 chars
}

export interface ServiceItem {
  name: string; // max 60 chars
  line: string; // max 120 chars
}

export interface Review {
  text: string; // max 240 chars
  author: string; // max 60 chars
}

export interface Outcome {
  metric: string; // max 20 chars
  label: string; // max 120 chars
}

export interface CopyVariant {
  targetKey: WhitelistedKey;
  value: CopyValue;
  rationale: string; // max 200 chars
  confidence: number; // 0-1
  risks?: string[]; // max 3 items, 120 chars each
}

export interface CopyProposal {
  schemaVersion: "v1";
  variants: CopyVariant[]; // 1-3 variants
  requiresApproval: true;
  confidence: number; // 0-1
  risks: string[]; // max 5 items, 120 chars each
  assumptions: string[]; // max 5 items, 120 chars each
}

// ============================================
// DESIGN TOKENS
// ============================================

export interface DesignTokens {
  maxWidth?: string; // e.g., '1200px', '80rem'
  sectionGap?: string; // e.g., '4rem', '64px'
  radius?: "none" | "sm" | "md" | "lg" | "xl";
  cardStyle?: "flat" | "bordered" | "elevated" | "outlined";
  trustLayout?: "grid" | "list" | "carousel" | "stacked";
  ctaStyle?: "solid" | "outline" | "ghost" | "gradient";
  typographyScale?: "compact" | "comfortable" | "spacious";
  spacing?: "tight" | "normal" | "relaxed";
}

export interface DesignTokensProposal {
  schemaVersion: "v1";
  tokens: DesignTokens;
  rationale: string; // max 300 chars
  requiresApproval: true;
  confidence: number; // 0-1
  risks: string[]; // max 3 items, 120 chars each
  assumptions: string[]; // max 3 items, 120 chars each
}

// ============================================
// INTENT PARSE
// ============================================

export type IntentType =
  | "COPY_CHANGE"
  | "DESIGN_PRESENTATION"
  | "ADD_SECTION"
  | "REMOVE_SECTION"
  | "SERVICE_CHANGE"
  | "OTHER";

export interface IntentParse {
  schemaVersion: "v1";
  intentType: IntentType;
  targetKeys: WhitelistedKey[]; // 0-5 keys
  userText: string; // max 500 chars
  proposedDirection: string; // max 200 chars
  needsHuman: boolean;
  needsHumanReason?: string; // max 200 chars
  confidence: number; // 0-1
  requiresApproval: true;
  assumptions?: string[]; // max 3 items, 120 chars each
}

// ============================================
// CRITIQUE
// ============================================

export type IssueSeverity = "critical" | "major" | "minor";

export interface Issue {
  severity: IssueSeverity;
  description: string; // max 200 chars
  affectedKey?: string;
}

export interface SuggestedFix {
  targetKey: string;
  fix: string; // max 200 chars
  rationale: string; // max 150 chars
}

export interface EvaluationCriteria {
  clarity?: number; // 0-1
  trust?: number; // 0-1
  scanability?: number; // 0-1
  mobileFold?: number; // 0-1
  sectionContractCompliance?: number; // 0-1
}

export interface Critique {
  schemaVersion: "v1";
  pass: boolean;
  issues: Issue[]; // max 3 items
  suggestedFixes: SuggestedFix[]; // max 3 items
  confidence: number; // 0-1
  requiresApproval: true;
  evaluationCriteria?: EvaluationCriteria;
}

// ============================================
// DECISION COLLAPSE
// ============================================

export type SelectedProposal =
  | {
      type: "copy";
      targetKey: WhitelistedKey;
      value: CopyValue;
    }
  | {
      type: "design";
      tokens: DesignTokens;
    }
  | null; // null if needsHuman=true

export interface DecisionCollapse {
  schemaVersion: "v1";
  selectedProposal: SelectedProposal;
  reason: string; // max 300 chars
  approvalText: string; // max 200 chars
  previewRecommended: boolean;
  needsHuman: boolean;
  needsHumanReason?: string; // max 200 chars
  confidence: number; // 0-1
  requiresApproval: true;
  roundLimit: number; // max 2
  costCapUsd: number; // max 10
  actualRounds?: number; // 0-2
  estimatedCostUsd?: number;
  assumptions?: string[]; // max 5 items, 120 chars each
}

// ============================================
// VALIDATION HELPERS
// ============================================

export const WHITELISTED_KEYS: WhitelistedKey[] = [
  "hero.headline",
  "hero.subheadline",
  "hero.cta",
  "trust.items",
  "services.items",
  "socialProof.reviews",
  "socialProof.outcomes",
  "socialProof.credentials",
  "design.tokens",
];

export const MAX_LENGTHS = {
  headline: 80,
  subheadline: 120,
  cta: 120,
  trustItem: 120,
  serviceName: 60,
  serviceLine: 120,
  reviewText: 240,
  reviewAuthor: 60,
  outcomeMetric: 20,
  outcomeLabel: 120,
  rationale: 200,
  reason: 300,
  approvalText: 200,
  userText: 500,
  proposedDirection: 200,
  issueDescription: 200,
  fix: 200,
  fixRationale: 150,
  assumption: 120,
  risk: 120,
} as const;

export const HARD_CAPS = {
  maxVariants: 3,
  maxRounds: 2,
  maxCostUsd: 10,
  maxIssues: 3,
  maxFixes: 3,
  maxAssumptions: 5,
  maxRisks: 5,
  minServices: 3,
  maxServices: 5,
} as const;

// ============================================
// TYPE GUARDS
// ============================================

export function isWhitelistedKey(key: string): key is WhitelistedKey {
  return WHITELISTED_KEYS.includes(key as WhitelistedKey);
}

export function isCopyProposal(obj: unknown): obj is CopyProposal {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Partial<CopyProposal>;
  return (
    p.schemaVersion === "v1" &&
    Array.isArray(p.variants) &&
    p.variants.length >= 1 &&
    p.variants.length <= HARD_CAPS.maxVariants &&
    p.requiresApproval === true &&
    typeof p.confidence === "number" &&
    p.confidence >= 0 &&
    p.confidence <= 1 &&
    Array.isArray(p.risks) &&
    Array.isArray(p.assumptions)
  );
}

export function isDesignTokensProposal(obj: unknown): obj is DesignTokensProposal {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Partial<DesignTokensProposal>;
  return (
    p.schemaVersion === "v1" &&
    typeof p.tokens === "object" &&
    p.tokens !== null &&
    p.requiresApproval === true &&
    typeof p.confidence === "number" &&
    p.confidence >= 0 &&
    p.confidence <= 1 &&
    Array.isArray(p.risks) &&
    Array.isArray(p.assumptions)
  );
}

export function isIntentParse(obj: unknown): obj is IntentParse {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Partial<IntentParse>;
  return (
    p.schemaVersion === "v1" &&
    typeof p.intentType === "string" &&
    Array.isArray(p.targetKeys) &&
    typeof p.userText === "string" &&
    typeof p.proposedDirection === "string" &&
    typeof p.needsHuman === "boolean" &&
    p.requiresApproval === true &&
    typeof p.confidence === "number" &&
    p.confidence >= 0 &&
    p.confidence <= 1
  );
}

export function isCritique(obj: unknown): obj is Critique {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Partial<Critique>;
  return (
    p.schemaVersion === "v1" &&
    typeof p.pass === "boolean" &&
    Array.isArray(p.issues) &&
    p.issues.length <= HARD_CAPS.maxIssues &&
    Array.isArray(p.suggestedFixes) &&
    p.suggestedFixes.length <= HARD_CAPS.maxFixes &&
    p.requiresApproval === true &&
    typeof p.confidence === "number" &&
    p.confidence >= 0 &&
    p.confidence <= 1
  );
}

export function isDecisionCollapse(obj: unknown): obj is DecisionCollapse {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Partial<DecisionCollapse>;
  return (
    p.schemaVersion === "v1" &&
    (p.selectedProposal === null || typeof p.selectedProposal === "object") &&
    typeof p.reason === "string" &&
    typeof p.approvalText === "string" &&
    typeof p.previewRecommended === "boolean" &&
    typeof p.needsHuman === "boolean" &&
    p.requiresApproval === true &&
    typeof p.confidence === "number" &&
    p.confidence >= 0 &&
    p.confidence <= 1 &&
    typeof p.roundLimit === "number" &&
    p.roundLimit >= 0 &&
    p.roundLimit <= HARD_CAPS.maxRounds &&
    typeof p.costCapUsd === "number" &&
    p.costCapUsd >= 0 &&
    p.costCapUsd <= HARD_CAPS.maxCostUsd
  );
}
