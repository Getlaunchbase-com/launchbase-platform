/**
 * Section-Specific Cap Enforcement
 * 
 * Enforces strict limits based on section contracts AFTER schema validation.
 * Schema allows broad limits (e.g., 120 chars), this enforces exact caps (e.g., headline 80 chars).
 */

import type { CopyProposal, CopyVariant } from "./contracts/types";

// ============================================
// TYPES
// ============================================

export type CapViolationResult =
  | { ok: true }
  | { ok: false; code: "cap_violation"; errors: string[] };

// ============================================
// SECTION-SPECIFIC CAPS
// ============================================

const SECTION_CAPS = {
  "hero.headline": 80,
  "hero.subheadline": 140,
  "hero.cta": 60,
  "trust.items": 120, // per item
  "services.items": {
    name: 60,
    line: 120,
    maxCount: 5,
    minCount: 3,
  },
  "socialProof.reviews": {
    text: 240,
    author: 60,
    maxCount: 5,
    minCount: 3,
  },
  "socialProof.outcomes": {
    metric: 20,
    label: 120,
    maxCount: 5,
    minCount: 3,
  },
  "socialProof.credentials": {
    item: 120,
    maxCount: 5,
    minCount: 3,
  },
} as const;

// ============================================
// VALIDATION FUNCTIONS
// ============================================

function checkStringLength(
  value: string,
  maxLength: number,
  path: string
): string | null {
  if (value.length > maxLength) {
    return `${path}: exceeds ${maxLength} chars (got ${value.length})`;
  }
  return null;
}

function checkArrayCount(
  arr: unknown[],
  min: number,
  max: number,
  path: string
): string | null {
  if (arr.length < min) {
    return `${path}: must have at least ${min} items (got ${arr.length})`;
  }
  if (arr.length > max) {
    return `${path}: must have at most ${max} items (got ${arr.length})`;
  }
  return null;
}

/**
 * Enforce section-specific caps on a single variant
 */
function enforceVariantCaps(variant: CopyVariant, index: number): string[] {
  const errors: string[] = [];
  const { targetKey, value } = variant;
  const path = `variants[${index}]`;

  // Hero section
  if (targetKey === "hero.headline" && typeof value === "string") {
    const err = checkStringLength(value, SECTION_CAPS["hero.headline"], `${path}.value`);
    if (err) errors.push(err);
  }

  if (targetKey === "hero.subheadline" && typeof value === "string") {
    const err = checkStringLength(value, SECTION_CAPS["hero.subheadline"], `${path}.value`);
    if (err) errors.push(err);
  }

  if (targetKey === "hero.cta" && typeof value === "string") {
    const err = checkStringLength(value, SECTION_CAPS["hero.cta"], `${path}.value`);
    if (err) errors.push(err);
  }

  // Trust section
  if (targetKey === "trust.items" && Array.isArray(value)) {
    const caps = SECTION_CAPS["trust.items"];
    value.forEach((item, i) => {
      if (typeof item === "string") {
        const err = checkStringLength(item, caps, `${path}.value[${i}]`);
        if (err) errors.push(err);
      }
    });
  }

  // Services section
  if (targetKey === "services.items" && Array.isArray(value)) {
    const caps = SECTION_CAPS["services.items"];
    
    const countErr = checkArrayCount(value, caps.minCount, caps.maxCount, `${path}.value`);
    if (countErr) errors.push(countErr);

    value.forEach((item, i) => {
      if (typeof item === "object" && item !== null && "name" in item && "line" in item) {
        const nameErr = checkStringLength(item.name as string, caps.name, `${path}.value[${i}].name`);
        if (nameErr) errors.push(nameErr);

        const lineErr = checkStringLength(item.line as string, caps.line, `${path}.value[${i}].line`);
        if (lineErr) errors.push(lineErr);
      }
    });
  }

  // Social proof - reviews
  if (targetKey === "socialProof.reviews" && typeof value === "object" && value !== null && "reviews" in value) {
    const caps = SECTION_CAPS["socialProof.reviews"];
    const reviews = (value as { reviews: unknown[] }).reviews;

    const countErr = checkArrayCount(reviews, caps.minCount, caps.maxCount, `${path}.value.reviews`);
    if (countErr) errors.push(countErr);

    reviews.forEach((review, i) => {
      if (typeof review === "object" && review !== null && "text" in review && "author" in review) {
        const textErr = checkStringLength((review as { text: string }).text, caps.text, `${path}.value.reviews[${i}].text`);
        if (textErr) errors.push(textErr);

        const authorErr = checkStringLength((review as { author: string }).author, caps.author, `${path}.value.reviews[${i}].author`);
        if (authorErr) errors.push(authorErr);
      }
    });
  }

  // Social proof - outcomes
  if (targetKey === "socialProof.outcomes" && typeof value === "object" && value !== null && "outcomes" in value) {
    const caps = SECTION_CAPS["socialProof.outcomes"];
    const outcomes = (value as { outcomes: unknown[] }).outcomes;

    const countErr = checkArrayCount(outcomes, caps.minCount, caps.maxCount, `${path}.value.outcomes`);
    if (countErr) errors.push(countErr);

    outcomes.forEach((outcome, i) => {
      if (typeof outcome === "object" && outcome !== null && "metric" in outcome && "label" in outcome) {
        const metricErr = checkStringLength((outcome as { metric: string }).metric, caps.metric, `${path}.value.outcomes[${i}].metric`);
        if (metricErr) errors.push(metricErr);

        const labelErr = checkStringLength((outcome as { label: string }).label, caps.label, `${path}.value.outcomes[${i}].label`);
        if (labelErr) errors.push(labelErr);
      }
    });
  }

  // Social proof - credentials
  if (targetKey === "socialProof.credentials" && typeof value === "object" && value !== null && "credentials" in value) {
    const caps = SECTION_CAPS["socialProof.credentials"];
    const credentials = (value as { credentials: unknown[] }).credentials;

    const countErr = checkArrayCount(credentials, caps.minCount, caps.maxCount, `${path}.value.credentials`);
    if (countErr) errors.push(countErr);

    credentials.forEach((cred, i) => {
      if (typeof cred === "string") {
        const err = checkStringLength(cred, caps.item, `${path}.value.credentials[${i}]`);
        if (err) errors.push(err);
      }
    });
  }

  return errors;
}

/**
 * Enforce section-specific caps on CopyProposal
 * 
 * Call this AFTER validateAiOutput() passes.
 * 
 * @param proposal - Validated CopyProposal
 * @returns The proposal payload (unchanged if valid, or throws if caps violated)
 * 
 * @example
 * const schemaResult = validateAiOutput<CopyProposal>("copy_proposal", payload);
 * if (!schemaResult.ok) throw new Error("Schema validation failed");
 * 
 * const capped = enforceSectionCaps(schemaResult.data);
 * // Safe to use capped proposal
 */
export function enforceSectionCaps(proposal: CopyProposal): CopyProposal {
  // Defensive guards
  if (!proposal || typeof proposal !== "object") return proposal;
  
  if (!("variants" in proposal) || !Array.isArray(proposal.variants)) {
    return proposal; // schema validation handles missing variants
  }

  const errors: string[] = [];

  proposal.variants.forEach((variant, index) => {
    const variantErrors = enforceVariantCaps(variant, index);
    errors.push(...variantErrors);
  });

  if (errors.length > 0) {
    throw new Error(`Cap violations: ${errors.join("; ")}`);
  }

  return proposal;
}

/**
 * Get section-specific caps for a target key
 * (Useful for error messages or UI hints)
 */
export function getSectionCaps(targetKey: string): unknown {
  return SECTION_CAPS[targetKey as keyof typeof SECTION_CAPS];
}
