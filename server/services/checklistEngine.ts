/**
 * Checklist Engine
 *
 * Real checklist computation, step management, field locking, and diff operations.
 * Generates platform-specific setup checklists from intake context.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepStatus = "pending" | "complete" | "blocked";

interface ChecklistStep {
  id: string;
  stepId: string;
  label: string;
  status: StepStatus;
  dependsOn?: string[];
  completedAt?: string;
  completedBy?: string;
  fields?: Record<string, { value: unknown; locked: boolean; lockedBy?: string }>;
}

interface Checklist {
  steps: ChecklistStep[];
  fields: Record<string, { value: unknown; locked: boolean; lockedBy?: string }>;
  completedCount: number;
  totalCount: number;
}

interface ChecklistContext {
  intakeId: number;
  businessName: string;
  trades?: string[];
  primaryTrade?: string;
  email?: string;
  phone?: string;
  services?: string[];
  serviceArea?: string[];
  tagline?: string;
  tone?: string;
  zip?: string;
}

// ---------------------------------------------------------------------------
// computeChecklist
// ---------------------------------------------------------------------------

export function computeChecklist(
  ctx: ChecklistContext,
  previous?: Checklist,
): Checklist {
  const businessName = ctx.businessName || "Business";
  const services = ctx.services || [];
  const serviceArea = ctx.serviceArea || [];
  const primaryTrade = ctx.primaryTrade || "professional";

  // Build steps for each platform
  const steps: ChecklistStep[] = [];
  const fields: Record<string, { value: unknown; locked: boolean; lockedBy?: string }> = {};

  // ---- Google Business Profile Steps ----
  steps.push({
    id: "google_verify",
    stepId: "google_verify",
    label: "Verify Google Business ownership",
    status: "pending",
    fields: {},
  });

  steps.push({
    id: "google_info",
    stepId: "google_info",
    label: "Complete business information",
    status: "pending",
    dependsOn: ["google_verify"],
  });

  steps.push({
    id: "google_photos",
    stepId: "google_photos",
    label: "Upload photos to Google Business",
    status: "pending",
    dependsOn: ["google_info"],
  });

  steps.push({
    id: "google_services",
    stepId: "google_services",
    label: "Add services to Google Business",
    status: "pending",
    dependsOn: ["google_info"],
  });

  steps.push({
    id: "google_review",
    stepId: "google_review",
    label: "Set up review request template",
    status: "pending",
    dependsOn: ["google_info"],
  });

  // ---- Meta (Facebook/Instagram) Steps ----
  steps.push({
    id: "meta_page",
    stepId: "meta_page",
    label: "Create or connect Facebook Business Page",
    status: "pending",
  });

  steps.push({
    id: "meta_branding",
    stepId: "meta_branding",
    label: "Upload profile picture and cover photo",
    status: "pending",
    dependsOn: ["meta_page"],
  });

  steps.push({
    id: "meta_connect",
    stepId: "meta_connect",
    label: "Connect LaunchBase to Facebook Page",
    status: "pending",
    dependsOn: ["meta_page"],
  });

  steps.push({
    id: "meta_first_post",
    stepId: "meta_first_post",
    label: "Approve and publish first post",
    status: "pending",
    dependsOn: ["meta_connect"],
  });

  // ---- QuickBooks Steps ----
  steps.push({
    id: "quickbooks_signup",
    stepId: "quickbooks_signup",
    label: "Sign up for QuickBooks Online",
    status: "pending",
  });

  steps.push({
    id: "quickbooks_items",
    stepId: "quickbooks_items",
    label: "Add service items and pricing",
    status: "pending",
    dependsOn: ["quickbooks_signup"],
  });

  steps.push({
    id: "quickbooks_bank",
    stepId: "quickbooks_bank",
    label: "Connect bank account",
    status: "pending",
    dependsOn: ["quickbooks_signup"],
  });

  steps.push({
    id: "quickbooks_connect",
    stepId: "quickbooks_connect",
    label: "Connect LaunchBase to QuickBooks",
    status: "pending",
    dependsOn: ["quickbooks_signup"],
  });

  // Populate fields from context
  fields["google_businessName"] = { value: businessName, locked: false };
  fields["google_phone"] = { value: ctx.phone || "", locked: false };
  fields["google_email"] = { value: ctx.email || "", locked: false };
  fields["google_serviceArea"] = { value: serviceArea.join(", "), locked: false };
  fields["google_primaryCategory"] = { value: getPrimaryCategory(primaryTrade), locked: false };
  fields["google_shortDescription"] = {
    value: `${businessName} provides ${primaryTrade} services in ${serviceArea.join(", ") || "your area"}.`,
    locked: false,
  };
  fields["google_reviewTemplate"] = {
    value: `Thank you for choosing ${businessName}! We'd appreciate a review on Google.`,
    locked: false,
  };

  fields["meta_pageName"] = { value: businessName, locked: false };
  fields["meta_bio"] = {
    value: `${businessName} | ${ctx.tagline || `Professional ${primaryTrade} services`}`,
    locked: false,
  };
  fields["meta_aboutText"] = {
    value: `${businessName} provides quality ${primaryTrade} services. Contact us today!`,
    locked: false,
  };
  fields["meta_ctaUrl"] = {
    value: `https://${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.launchbase.site`,
    locked: false,
  };

  fields["quickbooks_companyName"] = { value: businessName, locked: false };
  fields["quickbooks_terms"] = { value: "Net 30", locked: false };
  fields["quickbooks_depositRules"] = {
    value: "50% deposit required for projects over $500",
    locked: false,
  };

  // Add service-specific fields
  for (const svc of services) {
    const key = svc.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    fields[`quickbooks_item_${key}`] = { value: svc, locked: false };
    fields[`google_service_${key}`] = { value: svc, locked: false };
  }

  // If we have a previous checklist, preserve completed states and locked fields
  if (previous) {
    const prevStepMap = new Map(previous.steps.map((s) => [s.id, s]));
    for (const step of steps) {
      const prev = prevStepMap.get(step.id);
      if (prev) {
        step.status = prev.status;
        step.completedAt = prev.completedAt;
        step.completedBy = prev.completedBy;
      }
    }

    // Preserve locked field values
    for (const [key, prevField] of Object.entries(previous.fields || {})) {
      if (prevField.locked && fields[key]) {
        fields[key] = prevField;
      } else if (prevField.value !== undefined && fields[key]) {
        fields[key].value = prevField.value;
        fields[key].locked = prevField.locked;
        fields[key].lockedBy = prevField.lockedBy;
      }
    }
  }

  // Resolve blocked states from dependencies
  resolveBlockedSteps(steps);

  const completedCount = steps.filter((s) => s.status === "complete").length;

  return {
    steps,
    fields,
    completedCount,
    totalCount: steps.length,
  };
}

// ---------------------------------------------------------------------------
// completeStep
// ---------------------------------------------------------------------------

export function completeStep(
  checklist: Checklist,
  stepId: string,
  actor: string,
): Checklist {
  const steps = checklist.steps.map((step) => {
    if (step.id === stepId || step.stepId === stepId) {
      return {
        ...step,
        status: "complete" as StepStatus,
        completedAt: new Date().toISOString(),
        completedBy: actor,
      };
    }
    return step;
  });

  // Unblock downstream steps
  resolveBlockedSteps(steps);

  const completedCount = steps.filter((s) => s.status === "complete").length;
  return { ...checklist, steps, completedCount };
}

// ---------------------------------------------------------------------------
// resetStep
// ---------------------------------------------------------------------------

export function resetStep(
  checklist: Checklist,
  stepId: string,
  cascade: boolean,
): Checklist {
  const resetIds = new Set<string>([stepId]);

  if (cascade) {
    // Find all steps that depend on this step (directly or transitively)
    let changed = true;
    while (changed) {
      changed = false;
      for (const step of checklist.steps) {
        if (resetIds.has(step.id)) continue;
        if (step.dependsOn?.some((dep) => resetIds.has(dep))) {
          resetIds.add(step.id);
          changed = true;
        }
      }
    }
  }

  const steps = checklist.steps.map((step) => {
    if (resetIds.has(step.id) || resetIds.has(step.stepId)) {
      const { completedAt, completedBy, ...rest } = step;
      return { ...rest, status: "pending" as StepStatus };
    }
    return step;
  });

  resolveBlockedSteps(steps);

  const completedCount = steps.filter((s) => s.status === "complete").length;
  return { ...checklist, steps, completedCount };
}

// ---------------------------------------------------------------------------
// lockField
// ---------------------------------------------------------------------------

export function lockField(
  checklist: Checklist,
  fieldKey: string,
  actor: string,
): Checklist {
  const fields = { ...checklist.fields };
  if (fields[fieldKey]) {
    fields[fieldKey] = { ...fields[fieldKey], locked: true, lockedBy: actor };
  } else {
    fields[fieldKey] = { value: null, locked: true, lockedBy: actor };
  }
  return { ...checklist, fields };
}

// ---------------------------------------------------------------------------
// updateFieldValue
// ---------------------------------------------------------------------------

export function updateFieldValue(
  checklist: Checklist,
  fieldKey: string,
  value: unknown,
  actor: string,
): Checklist {
  const fields = { ...checklist.fields };
  const existing = fields[fieldKey];

  if (existing?.locked) {
    throw new Error(
      `Field "${fieldKey}" is locked by ${existing.lockedBy || "unknown"} and cannot be updated`,
    );
  }

  fields[fieldKey] = { value, locked: true, lockedBy: actor };
  return { ...checklist, fields };
}

// ---------------------------------------------------------------------------
// diffChecklists
// ---------------------------------------------------------------------------

export function diffChecklists(
  before: Checklist | null,
  after: Checklist,
): { added: string[]; removed: string[]; changed: string[] } {
  if (!before) {
    return {
      added: after.steps.map((s) => s.id),
      removed: [],
      changed: [],
    };
  }

  const beforeIds = new Set(before.steps.map((s) => s.id));
  const afterIds = new Set(after.steps.map((s) => s.id));

  const added = after.steps
    .filter((s) => !beforeIds.has(s.id))
    .map((s) => s.id);
  const removed = before.steps
    .filter((s) => !afterIds.has(s.id))
    .map((s) => s.id);
  const changed = after.steps
    .filter((s) => {
      const prev = before.steps.find((b) => b.id === s.id);
      return prev && prev.status !== s.status;
    })
    .map((s) => s.id);

  return { added, removed, changed };
}

// ---------------------------------------------------------------------------
// Legacy exports for backward compatibility
// ---------------------------------------------------------------------------

export async function getChecklist(moduleId: number): Promise<any[]> {
  const checklist = computeChecklist({ intakeId: moduleId, businessName: "Business" });
  return checklist.steps;
}

export async function updateChecklistItem(
  itemId: number,
  status: string,
): Promise<any> {
  return { id: itemId, status, updatedAt: new Date().toISOString() };
}

export async function createChecklistItem(data: any): Promise<any> {
  return { id: Date.now(), ...data, createdAt: new Date().toISOString() };
}

export async function deleteChecklistItem(itemId: number): Promise<void> {
  // No-op: In production, would remove from DB
}

export async function reorderChecklist(
  moduleId: number,
  order: number[],
): Promise<void> {
  // No-op: In production, would update sort order in DB
}

export async function getChecklistSummary(moduleId: number): Promise<any> {
  const checklist = computeChecklist({ intakeId: moduleId, businessName: "Business" });
  return {
    moduleId,
    totalCount: checklist.totalCount,
    completedCount: checklist.completedCount,
    percentage:
      checklist.totalCount > 0
        ? Math.round((checklist.completedCount / checklist.totalCount) * 100)
        : 0,
  };
}

export async function completeChecklist(moduleId: number): Promise<Checklist> {
  let checklist = computeChecklist({ intakeId: moduleId, businessName: "Business" });
  for (const step of checklist.steps) {
    checklist = completeStep(checklist, step.id, "system");
  }
  return checklist;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveBlockedSteps(steps: ChecklistStep[]): void {
  const completedIds = new Set(
    steps.filter((s) => s.status === "complete").map((s) => s.id),
  );

  for (const step of steps) {
    if (step.status === "complete") continue;
    if (step.dependsOn && step.dependsOn.length > 0) {
      const allDepsComplete = step.dependsOn.every((dep) => completedIds.has(dep));
      step.status = allDepsComplete ? "pending" : "blocked";
    }
  }
}

function getPrimaryCategory(vertical: string): string {
  const categories: Record<string, string> = {
    trades: "Home Improvement",
    appointments: "Health & Wellness",
    professional: "Professional Services",
    roofing: "Roofing Contractor",
    hvac: "HVAC Contractor",
    plumbing: "Plumber",
  };
  return categories[vertical] || "Local Business";
}
