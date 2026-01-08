/**
 * Template Version Management
 * 
 * Single source of truth for the current template bundle version.
 * 
 * WHEN TO BUMP:
 * - Layout changes that affect existing sites
 * - Component structure changes
 * - Breaking changes to generated HTML/CSS
 * - New features that change site behavior
 * 
 * DO NOT BUMP FOR:
 * - Copy/content changes
 * - Bug fixes that don't change output
 * - Internal refactoring
 * - New optional features
 */

/**
 * Current template version for new deployments
 * Format: YYYY-MM-DD.N (where N is the iteration for that day)
 */
export const TEMPLATE_VERSION_CURRENT = "2026-01-07.1";

/**
 * Baseline version for existing deployments (backfill value)
 */
export const TEMPLATE_VERSION_BASELINE = "v1";

/**
 * All known template versions (for validation)
 */
export const TEMPLATE_VERSIONS = [
  TEMPLATE_VERSION_BASELINE,
  TEMPLATE_VERSION_CURRENT,
] as const;

export type TemplateVersion = typeof TEMPLATE_VERSIONS[number];
