/**
 * Content Contract Validator
 * 
 * Validates that specialist output meets content quality contracts:
 * - Designers: EXACTLY 8 changes with valid keys + anchors
 * - Critic: ≥10 issues + ≥10 fixes + pass=false
 * 
 * This catches "silent non-compliance" where stopReason="ok" but output is wrong-shaped.
 * Failed validation triggers ladder retry.
 */

export interface ContentValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate that a targetKey matches the expected pattern and prefix
 */
function validateKey(key: string, prefix: "design" | "brand"): boolean {
  if (!key || typeof key !== "string") return false;
  if (!key.startsWith(`${prefix}.`)) return false;
  // Must match: design.* or brand.* with at least one segment after prefix
  const regex = /^(design|brand)\.[a-zA-Z0-9]+(\.[ a-zA-Z0-9]+)*$/;
  return regex.test(key);
}

/**
 * Check if a value contains implementability anchors (A/B/C types)
 * 
 * Type A (Quantitative): numbers, breakpoints
 * Type B (UI Primitive): button, card, CTA, hero, navbar, grid, modal, tabs
 * Type C (Structural Move): verb (add/move/merge/split) + object (headline/pricing/FAQ/CTA)
 */
function hasImplementabilityAnchor(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  
  const lowerValue = value.toLowerCase();
  
  // Type A: Quantitative anchors
  // Numbers with units (px, rem, %, etc.)
  if (/\d+\s*(px|rem|%|em|vh|vw|ms|s|col|column)/.test(lowerValue)) return true;
  
  // Breakpoints
  if (/(mobile|tablet|desktop|sm|md|lg|xl|breakpoint|responsive)/i.test(lowerValue)) return true;
  
  // Type B: UI Primitives / Components
  const uiPrimitives = [
    "button", "card", "hero", "cta", "nav", "navbar", "header", "footer",
    "section", "container", "grid", "flex", "modal", "drawer", "tabs",
    "accordion", "chip", "badge", "pricing table", "sticky", "stack",
    "two-column", "three-column", "sidebar", "panel", "widget"
  ];
  if (uiPrimitives.some(prim => lowerValue.includes(prim))) return true;
  
  // Color/design tokens
  if (/#[0-9a-f]{3,8}|rgb|hsl|oklch|color|primary|secondary|accent/i.test(lowerValue)) return true;
  if (/(font|weight|size|spacing|gap|padding|margin|border|radius|shadow)/i.test(lowerValue)) return true;
  
  // Type C: Structural Move (verb + object)
  const structuralVerbs = [
    "add", "move", "merge", "split", "reorder", "group", "place",
    "remove", "compress", "expand", "rename", "promote", "demote",
    "position", "align", "stack", "nest", "separate", "combine"
  ];
  
  const structuralObjects = [
    "headline", "tagline", "subheadline", "pricing", "faq", "suite",
    "how it works", "trust", "proof", "testimonial", "feature",
    "benefit", "above the fold", "mid-page", "below fold", "section",
    "cta", "navigation", "menu", "logo", "image", "visual", "icon"
  ];
  
  const hasVerb = structuralVerbs.some(verb => lowerValue.includes(verb));
  const hasObject = structuralObjects.some(obj => lowerValue.includes(obj));
  
  if (hasVerb && hasObject) return true;
  
  return false;
}

/**
 * Validate designer output (systems or brand)
 */
function validateDesignerOutput(role: string, payload: any): ContentValidationResult {
  const prefix = role.includes("systems") ? "design" : "brand";
  
  // Check proposedChanges exists and is array
  if (!payload?.proposedChanges || !Array.isArray(payload.proposedChanges)) {
    return {
      valid: false,
      reason: `Missing or invalid proposedChanges array`,
    };
  }
  
  const changes = payload.proposedChanges;
  
  // EXACTLY 8 changes required (fast mode contract)
  if (changes.length !== 8) {
    return {
      valid: false,
      reason: `Expected EXACTLY 8 changes, got ${changes.length}`,
    };
  }
  
  // Validate each change (keys + values exist)
  let anchoredCount = 0;
  
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    
    // Check targetKey
    if (!validateKey(change.targetKey, prefix)) {
      return {
        valid: false,
        reason: `Invalid targetKey at index ${i}: "${change.targetKey}" (must start with ${prefix}.)`,
      };
    }
    
    // Check value exists
    if (!change.value || typeof change.value !== "string") {
      return {
        valid: false,
        reason: `Missing or invalid value at index ${i}`,
      };
    }
    
    // Count anchored changes (set-level threshold, not per-change requirement)
    if (hasImplementabilityAnchor(change.value)) {
      anchoredCount++;
    }
  }
  
  // Set-level threshold: ≥5 of 8 changes must have implementability anchors
  if (anchoredCount < 5) {
    return {
      valid: false,
      reason: `Only ${anchoredCount}/8 changes have implementability anchors (need ≥5)`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate critic output
 */
function validateCriticOutput(payload: any): ContentValidationResult {
  // Check issues exists and is array
  if (!payload?.issues || !Array.isArray(payload.issues)) {
    return {
      valid: false,
      reason: `Missing or invalid issues array`,
    };
  }
  
  // Check suggestedFixes exists and is array
  if (!payload?.suggestedFixes || !Array.isArray(payload.suggestedFixes)) {
    return {
      valid: false,
      reason: `Missing or invalid suggestedFixes array`,
    };
  }
  
  const issues = payload.issues;
  const fixes = payload.suggestedFixes;
  
  // ≥10 issues required
  if (issues.length < 10) {
    return {
      valid: false,
      reason: `Expected ≥10 issues, got ${issues.length}`,
    };
  }
  
  // ≥10 fixes required
  if (fixes.length < 10) {
    return {
      valid: false,
      reason: `Expected ≥10 fixes, got ${fixes.length}`,
    };
  }
  
  // pass must be false (ruthless mode)
  if (payload.pass !== false) {
    return {
      valid: false,
      reason: `Expected pass=false (ruthless mode), got pass=${payload.pass}`,
    };
  }
  
  return { valid: true };
}

/**
 * Main validation dispatcher
 */
export function validateContentContract(
  role: string,
  payload: any
): ContentValidationResult {
  // Skip validation if no payload
  if (!payload) {
    return {
      valid: false,
      reason: "No payload returned",
    };
  }
  
  // Designer validation
  if (role.includes("designer")) {
    return validateDesignerOutput(role, payload);
  }
  
  // Critic validation
  if (role.includes("critic")) {
    return validateCriticOutput(payload);
  }
  
  // Unknown role - pass through
  return { valid: true };
}
