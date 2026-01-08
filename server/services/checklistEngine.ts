/**
 * Checklist Engine - Single Source of Truth
 * 
 * LaunchBase Rule:
 * We prepare first.
 * We automate second.
 * We always show our work.
 * 
 * Engine produces the canonical checklist state.
 * API routes are thin wrappers around:
 * - computeChecklist(businessContext, existingChecklist?)
 * - validateChecklist(checklist)
 * - diffChecklists(before, after)
 */

// ============================================
// CORE TYPES
// ============================================

export type EvidenceSource =
  | "intake"
  | "manual"
  | "inferred"
  | "template"
  | "integration"
  | "system";

export type EvidencedField<T> = {
  key: string;                 // e.g. "meta.pageBio"
  label: string;               // UI display
  value: T | null;             // current (may be override)
  suggestedValue?: T | null;   // what engine would set if unlocked
  confidence: number;          // 0..1
  source: EvidenceSource;
  evidence?: string;           // short human-readable why
  version: string;             // engine version
  updatedAt: string;

  // lock semantics
  isLocked: boolean;
  lockedBy?: "customer" | "admin" | "system";
  lockedAt?: string;
};

export type StepStatus =
  | "pending"
  | "ready"
  | "in_progress"
  | "complete"
  | "skipped"
  | "needs_attention"
  | "blocked";

export type ChecklistStep = {
  stepId: string;              // "gbp.create_profile"
  title: string;
  description?: string;
  instructions?: string;
  deepLink?: string;
  platform: "gbp" | "meta" | "quickbooks";
  prereqs: string[];
  status: StepStatus;
  completedAt?: string;
  completedBy?: "customer" | "admin" | "system";

  // validation rules are declarative
  validation?: {
    requiredFields?: string[];
    maxLen?: Record<string, number>;
    minLen?: Record<string, number>;
  };

  // engine output
  blockers?: Blocker[];
};

export type Blocker = {
  code: string;                // "META_TOKEN_MISSING"
  message: string;             // human readable
  fix: string;                 // how to resolve
  severity: "info" | "warn" | "error";
  createdAt: string;
  resolvedAt?: string;
};

// ============================================
// ENGINE INPUTS
// ============================================

export type BusinessContext = {
  intakeId: number;
  businessName: string;
  zip?: string;
  trades: string[];
  primaryTrade: string;
  phone?: string;
  address?: string;
  hours?: string;
  website?: string;
  email?: string;
  services?: string[];
  serviceArea?: string[];
  tagline?: string;
  tone?: "conservative" | "balanced" | "opportunistic";
  season?: { name: "winter" | "spring" | "summer" | "fall"; reason: string; confidence: number };
  integrations?: {
    meta?: { pageId?: string; hasToken?: boolean };
    gbp?: { isConnected?: boolean };
    quickbooks?: { isConnected?: boolean };
  };
};

// ============================================
// ENGINE OUTPUTS
// ============================================

export type Checklist = {
  intakeId: number;
  computedAt: string;
  engineVersion: string;
  fields: Record<string, EvidencedField<any>>;
  steps: ChecklistStep[];
  blockers: Blocker[];
  nextAction?: { stepId: string; label: string };
};

export type ChecklistDiff = {
  updatedFields: string[];
  lockedFieldsSkipped: string[];
  updatedSteps: string[];
  blockersAdded: string[];
  blockersResolved: string[];
  beforeComputedAt: string;
  afterComputedAt: string;
};

// ============================================
// CONSTANTS
// ============================================

const ENGINE_VERSION = "1.0.0";

// Platform guardrails
const GUARDRAILS = {
  gbp: {
    descriptionMaxLen: 750,
    descriptionMinLen: 250,
    shortNameMaxLen: 32,
  },
  meta: {
    bioMaxLen: 255,
    aboutMaxLen: 2000,
  },
  quickbooks: {
    itemNameMaxLen: 100,
    descriptionMaxLen: 4000,
  },
};

// Step registry - static definitions
const STEP_REGISTRY: Record<string, Omit<ChecklistStep, "status" | "blockers">> = {
  // Google Business Profile
  "gbp.claim_profile": {
    stepId: "gbp.claim_profile",
    platform: "gbp",
    title: "Claim or Create Business Profile",
    description: "Search for your business on Google. If it exists, claim it. If not, create a new profile.",
    instructions: "Go to business.google.com/create and follow the steps to claim or create your listing.",
    deepLink: "https://business.google.com/create",
    prereqs: [],
    validation: {},
  },
  "gbp.verify": {
    stepId: "gbp.verify",
    platform: "gbp",
    title: "Verify Business Ownership",
    description: "Complete Google's verification process (postcard, phone, or video call).",
    prereqs: ["gbp.claim_profile"],
    validation: {},
  },
  "gbp.add_info": {
    stepId: "gbp.add_info",
    platform: "gbp",
    title: "Add Business Information",
    description: "Fill in business name, address, phone, website, and hours.",
    deepLink: "https://business.google.com/edit",
    prereqs: ["gbp.claim_profile"],
    validation: {
      requiredFields: ["gbp.businessName", "gbp.phone"],
    },
  },
  "gbp.set_category": {
    stepId: "gbp.set_category",
    platform: "gbp",
    title: "Set Primary Category",
    description: "Select your primary business category. This affects how you appear in search.",
    prereqs: ["gbp.add_info"],
    validation: {
      requiredFields: ["gbp.primaryCategory"],
    },
  },
  "gbp.add_description": {
    stepId: "gbp.add_description",
    platform: "gbp",
    title: "Add Business Description",
    description: "Copy the description below (max 750 characters). Avoid promotional language.",
    prereqs: ["gbp.add_info"],
    validation: {
      requiredFields: ["gbp.description"],
      maxLen: { "gbp.description": 750 },
      minLen: { "gbp.description": 100 },
    },
  },
  "gbp.upload_photos": {
    stepId: "gbp.upload_photos",
    platform: "gbp",
    title: "Upload Photos",
    description: "Add logo, cover photo, and at least 3 work photos.",
    prereqs: ["gbp.claim_profile"],
    validation: {},
  },
  "gbp.add_services": {
    stepId: "gbp.add_services",
    platform: "gbp",
    title: "Add Services",
    description: "Add your service list with descriptions.",
    prereqs: ["gbp.set_category"],
    validation: {},
  },

  // Meta (Facebook/Instagram)
  "meta.create_page": {
    stepId: "meta.create_page",
    platform: "meta",
    title: "Create or Access Business Page",
    description: "Create a new Facebook Business Page or access your existing one.",
    deepLink: "https://www.facebook.com/pages/create",
    prereqs: [],
    validation: {},
  },
  "meta.complete_info": {
    stepId: "meta.complete_info",
    platform: "meta",
    title: "Complete Page Information",
    description: "Add business name, category, bio, and contact information.",
    prereqs: ["meta.create_page"],
    validation: {
      requiredFields: ["meta.pageBio"],
      maxLen: { "meta.pageBio": 255 },
    },
  },
  "meta.upload_photos": {
    stepId: "meta.upload_photos",
    platform: "meta",
    title: "Upload Profile & Cover Photos",
    description: "Profile: 170x170px, Cover: 820x312px. Use your logo for profile.",
    prereqs: ["meta.create_page"],
    validation: {},
  },
  "meta.set_cta": {
    stepId: "meta.set_cta",
    platform: "meta",
    title: "Set Call-to-Action Button",
    description: "Choose 'Call Now', 'Book Now', or 'Contact Us' based on your business type.",
    prereqs: ["meta.complete_info"],
    validation: {},
  },
  "meta.connect_instagram": {
    stepId: "meta.connect_instagram",
    platform: "meta",
    title: "Connect Instagram (Optional)",
    description: "Link your Instagram business account for cross-posting.",
    deepLink: "https://business.facebook.com/settings/instagram-accounts",
    prereqs: ["meta.create_page"],
    validation: {},
  },
  "meta.first_post": {
    stepId: "meta.first_post",
    platform: "meta",
    title: "Publish First Post",
    description: "Use the starter post copy below. Pin it to your page.",
    prereqs: ["meta.upload_photos"],
    validation: {},
  },

  // QuickBooks
  "qbo.create_account": {
    stepId: "qbo.create_account",
    platform: "quickbooks",
    title: "Create or Access QuickBooks Account",
    description: "Sign up for QuickBooks Online or log in to your existing account.",
    deepLink: "https://quickbooks.intuit.com/",
    prereqs: [],
    validation: {},
  },
  "qbo.setup_company": {
    stepId: "qbo.setup_company",
    platform: "quickbooks",
    title: "Set Up Company Profile",
    description: "Add business name, address, phone, and logo.",
    prereqs: ["qbo.create_account"],
    validation: {},
  },
  "qbo.add_services": {
    stepId: "qbo.add_services",
    platform: "quickbooks",
    title: "Add Service Items",
    description: "Create service items with rates. Use the list below as a starting point.",
    prereqs: ["qbo.setup_company"],
    validation: {},
  },
  "qbo.customize_invoice": {
    stepId: "qbo.customize_invoice",
    platform: "quickbooks",
    title: "Customize Invoice Template",
    description: "Add logo, set payment terms, and customize footer message.",
    prereqs: ["qbo.setup_company"],
    validation: {},
  },
  "qbo.setup_payments": {
    stepId: "qbo.setup_payments",
    platform: "quickbooks",
    title: "Set Up Payment Methods",
    description: "Enable online payments (credit card, ACH) to get paid faster.",
    prereqs: ["qbo.create_account"],
    validation: {},
  },
  "qbo.add_customer_types": {
    stepId: "qbo.add_customer_types",
    platform: "quickbooks",
    title: "Add Customer Types",
    description: "Create customer categories for better organization.",
    prereqs: ["qbo.setup_company"],
    validation: {},
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSeasonContext(): { name: "winter" | "spring" | "summer" | "fall"; reason: string; confidence: number } {
  const month = new Date().getMonth() + 1;
  if (month >= 11 || month <= 3) {
    return { name: "winter", reason: "December-March", confidence: 0.9 };
  } else if (month >= 4 && month <= 5) {
    return { name: "spring", reason: "April-May", confidence: 0.9 };
  } else if (month >= 6 && month <= 8) {
    return { name: "summer", reason: "June-August", confidence: 0.9 };
  } else {
    return { name: "fall", reason: "September-October", confidence: 0.9 };
  }
}

function applyGuardrails(value: string, maxLen: number, minLen?: number): string {
  let result = value;
  if (result.length > maxLen) {
    result = result.slice(0, maxLen - 3) + "...";
  }
  return result;
}

function createField<T>(
  key: string,
  label: string,
  value: T | null,
  source: EvidenceSource,
  confidence: number,
  evidence?: string
): EvidencedField<T> {
  return {
    key,
    label,
    value,
    suggestedValue: value,
    confidence,
    source,
    evidence,
    version: ENGINE_VERSION,
    updatedAt: new Date().toISOString(),
    isLocked: false,
  };
}

// ============================================
// FIELD GENERATORS
// ============================================

function generateGBPFields(ctx: BusinessContext): Record<string, EvidencedField<any>> {
  const season = ctx.season || getSeasonContext();
  const services = ctx.services || [];
  const serviceArea = ctx.serviceArea || [];

  // Season-aware description
  let seasonalNote = "";
  if (season.name === "winter" && ctx.primaryTrade?.toLowerCase().includes("snow")) {
    seasonalNote = " Now booking winter service appointments.";
  } else if (season.name === "spring") {
    seasonalNote = " Book your spring maintenance today.";
  }

  const description = applyGuardrails(
    `${ctx.businessName} provides ${services.slice(0, 3).join(", ") || "professional services"}${serviceArea.length ? ` in ${serviceArea[0]}` : ""}. ${ctx.tagline || "Quality work, fair prices."}${seasonalNote}`,
    GUARDRAILS.gbp.descriptionMaxLen
  );

  const primaryCategory = ctx.primaryTrade === "trades" ? "Contractor" :
    ctx.primaryTrade === "appointments" ? "Service Establishment" : "Professional Services";

  return {
    "gbp.businessName": createField("gbp.businessName", "Business Name", ctx.businessName, "intake", 0.95, "from intake form"),
    "gbp.phone": createField("gbp.phone", "Phone", ctx.phone || null, ctx.phone ? "intake" : "template", ctx.phone ? 0.9 : 0, "from intake form"),
    "gbp.address": createField("gbp.address", "Address", ctx.address || null, ctx.address ? "intake" : "template", ctx.address ? 0.85 : 0, "from intake form"),
    "gbp.website": createField("gbp.website", "Website", ctx.website || null, ctx.website ? "intake" : "template", ctx.website ? 0.9 : 0, "from intake form"),
    "gbp.description": createField("gbp.description", "Business Description", description, "inferred", 0.75, "generated from services + tagline"),
    "gbp.primaryCategory": createField("gbp.primaryCategory", "Primary Category", primaryCategory, "inferred", 0.7, "inferred from trade type"),
    "gbp.services": createField("gbp.services", "Services", services, "intake", 0.85, "from intake form"),
  };
}

function generateMetaFields(ctx: BusinessContext): Record<string, EvidencedField<any>> {
  const services = ctx.services || [];
  
  const bio = applyGuardrails(
    `${ctx.businessName} | ${services.slice(0, 2).join(" & ") || "Professional Services"} | ${ctx.tagline || "Quality service you can trust"}`,
    GUARDRAILS.meta.bioMaxLen
  );

  const aboutText = `${ctx.businessName} provides professional ${services.join(", ") || "services"}. ${ctx.tagline || ""}`;

  const firstPost = `🚀 Welcome to ${ctx.businessName}!\n\n${ctx.tagline || "We're here to help with all your needs."}\n\n📞 Call us: ${ctx.phone || "[Add phone]"}\n🌐 Visit: ${ctx.website || "[Add website]"}\n\n#${ctx.businessName.replace(/\s+/g, "")} #LocalBusiness`;

  return {
    "meta.pageName": createField("meta.pageName", "Page Name", ctx.businessName, "intake", 0.95, "from intake form"),
    "meta.pageBio": createField("meta.pageBio", "Page Bio (255 chars)", bio, "inferred", 0.75, "generated from business info"),
    "meta.aboutText": createField("meta.aboutText", "About Section", aboutText, "inferred", 0.7, "generated from services"),
    "meta.ctaType": createField("meta.ctaType", "CTA Button Type", "Call Now", "template", 0.6, "default for trades"),
    "meta.firstPost": createField("meta.firstPost", "First Post", firstPost, "inferred", 0.65, "generated welcome post"),
    "meta.hashtags": createField("meta.hashtags", "Hashtags", `#${ctx.businessName.replace(/\s+/g, "")} #LocalBusiness #SmallBusiness`, "template", 0.5, "default hashtags"),
  };
}

function generateQuickBooksFields(ctx: BusinessContext): Record<string, EvidencedField<any>> {
  const services = ctx.services || [];
  
  const serviceItems = services.map(s => ({ name: s, rate: null }));
  const invoiceFooter = `Thank you for choosing ${ctx.businessName}! Questions? Call ${ctx.phone || "[phone]"}`;

  return {
    "qbo.companyName": createField("qbo.companyName", "Company Name", ctx.businessName, "intake", 0.95, "from intake form"),
    "qbo.serviceItems": createField("qbo.serviceItems", "Service Items", serviceItems, "intake", 0.8, "from intake services"),
    "qbo.paymentTerms": createField("qbo.paymentTerms", "Payment Terms", "Due on receipt", "template", 0.5, "default terms"),
    "qbo.invoiceFooter": createField("qbo.invoiceFooter", "Invoice Footer", invoiceFooter, "inferred", 0.7, "generated from business info"),
    "qbo.customerTypes": createField("qbo.customerTypes", "Customer Types", ["Residential", "Commercial", "Emergency"], "template", 0.5, "default types"),
  };
}

// ============================================
// MAIN ENGINE FUNCTIONS
// ============================================

/**
 * Compute a fresh checklist from business context
 * If existingChecklist provided, respects locked fields
 */
export function computeChecklist(
  ctx: BusinessContext,
  existingChecklist?: Checklist
): Checklist {
  const now = new Date().toISOString();
  
  // Add season context if not provided
  if (!ctx.season) {
    ctx.season = getSeasonContext();
  }

  // Generate suggested fields for all platforms
  const suggestedFields: Record<string, EvidencedField<any>> = {
    ...generateGBPFields(ctx),
    ...generateMetaFields(ctx),
    ...generateQuickBooksFields(ctx),
  };

  // Merge with existing, respecting locks
  const fields: Record<string, EvidencedField<any>> = {};
  
  for (const [key, suggested] of Object.entries(suggestedFields)) {
    const existing = existingChecklist?.fields[key];
    
    if (existing?.isLocked) {
      // Keep locked field as-is, but update suggestedValue
      fields[key] = {
        ...existing,
        suggestedValue: suggested.value,
        version: ENGINE_VERSION,
      };
    } else if (existing && existing.source === "manual") {
      // Manual edits become locked
      fields[key] = {
        ...existing,
        suggestedValue: suggested.value,
        isLocked: true,
        lockedBy: "customer",
        lockedAt: existing.updatedAt,
        version: ENGINE_VERSION,
      };
    } else {
      // Use suggested value
      fields[key] = suggested;
    }
  }

  // Build steps with status
  const steps: ChecklistStep[] = [];
  const allBlockers: Blocker[] = [];

  for (const stepDef of Object.values(STEP_REGISTRY)) {
    const step: ChecklistStep = {
      ...stepDef,
      status: "pending",
      blockers: [],
    };

    // Check prereqs
    const prereqsMet = step.prereqs.every(prereqId => {
      const prereqStep = steps.find(s => s.stepId === prereqId);
      return prereqStep?.status === "complete";
    });

    // Check existing completion
    const existingStep = existingChecklist?.steps.find(s => s.stepId === step.stepId);
    if (existingStep?.status === "complete") {
      step.status = "complete";
      step.completedAt = existingStep.completedAt;
      step.completedBy = existingStep.completedBy;
    } else if (!prereqsMet) {
      step.status = "pending";
    } else {
      // Check validation
      const stepBlockers: Blocker[] = [];
      
      if (step.validation?.requiredFields) {
        for (const fieldKey of step.validation.requiredFields) {
          const field = fields[fieldKey];
          if (!field?.value) {
            stepBlockers.push({
              code: `MISSING_${fieldKey.toUpperCase().replace(".", "_")}`,
              message: `${field?.label || fieldKey} is required`,
              fix: `Add ${field?.label || fieldKey} to continue`,
              severity: "error",
              createdAt: now,
            });
          }
        }
      }

      if (step.validation?.maxLen) {
        for (const [fieldKey, maxLen] of Object.entries(step.validation.maxLen)) {
          const field = fields[fieldKey];
          if (field?.value && typeof field.value === "string" && field.value.length > maxLen) {
            stepBlockers.push({
              code: `EXCEEDS_MAX_LEN_${fieldKey.toUpperCase().replace(".", "_")}`,
              message: `${field.label} exceeds ${maxLen} characters`,
              fix: `Shorten ${field.label} to ${maxLen} characters or less`,
              severity: "warn",
              createdAt: now,
            });
          }
        }
      }

      if (stepBlockers.length > 0) {
        step.status = "needs_attention";
        step.blockers = stepBlockers;
        allBlockers.push(...stepBlockers);
      } else {
        step.status = "ready";
      }
    }

    steps.push(step);
  }

  // Add platform-level blockers
  if (!ctx.phone) {
    allBlockers.push({
      code: "MISSING_PHONE",
      message: "Phone number is required for most integrations",
      fix: "Add a phone number to your business profile",
      severity: "warn",
      createdAt: now,
    });
  }

  // Find next action
  const readyStep = steps.find(s => s.status === "ready");
  const attentionStep = steps.find(s => s.status === "needs_attention");
  const nextAction = readyStep 
    ? { stepId: readyStep.stepId, label: readyStep.title }
    : attentionStep 
      ? { stepId: attentionStep.stepId, label: `Fix: ${attentionStep.title}` }
      : undefined;

  return {
    intakeId: ctx.intakeId,
    computedAt: now,
    engineVersion: ENGINE_VERSION,
    fields,
    steps,
    blockers: allBlockers,
    nextAction,
  };
}

/**
 * Validate a checklist and return any blockers
 */
export function validateChecklist(checklist: Checklist): Blocker[] {
  const blockers: Blocker[] = [];
  const now = new Date().toISOString();

  // Check GBP description length
  const gbpDesc = checklist.fields["gbp.description"];
  if (gbpDesc?.value && typeof gbpDesc.value === "string") {
    if (gbpDesc.value.length > GUARDRAILS.gbp.descriptionMaxLen) {
      blockers.push({
        code: "GBP_DESCRIPTION_TOO_LONG",
        message: `GBP description exceeds ${GUARDRAILS.gbp.descriptionMaxLen} characters`,
        fix: `Shorten to ${GUARDRAILS.gbp.descriptionMaxLen} characters`,
        severity: "error",
        createdAt: now,
      });
    }
  }

  // Check Meta bio length
  const metaBio = checklist.fields["meta.pageBio"];
  if (metaBio?.value && typeof metaBio.value === "string") {
    if (metaBio.value.length > GUARDRAILS.meta.bioMaxLen) {
      blockers.push({
        code: "META_BIO_TOO_LONG",
        message: `Meta bio exceeds ${GUARDRAILS.meta.bioMaxLen} characters`,
        fix: `Shorten to ${GUARDRAILS.meta.bioMaxLen} characters`,
        severity: "error",
        createdAt: now,
      });
    }
  }

  return blockers;
}

/**
 * Compute diff between two checklists
 */
export function diffChecklists(before: Checklist | null, after: Checklist): ChecklistDiff {
  const updatedFields: string[] = [];
  const lockedFieldsSkipped: string[] = [];
  const updatedSteps: string[] = [];
  const blockersAdded: string[] = [];
  const blockersResolved: string[] = [];

  // Compare fields
  for (const [key, afterField] of Object.entries(after.fields)) {
    const beforeField = before?.fields[key];
    
    if (afterField.isLocked && beforeField?.suggestedValue !== afterField.suggestedValue) {
      lockedFieldsSkipped.push(key);
    } else if (!beforeField || beforeField.value !== afterField.value) {
      updatedFields.push(key);
    }
  }

  // Compare steps
  for (const afterStep of after.steps) {
    const beforeStep = before?.steps.find(s => s.stepId === afterStep.stepId);
    if (!beforeStep || beforeStep.status !== afterStep.status) {
      updatedSteps.push(afterStep.stepId);
    }
  }

  // Compare blockers
  const beforeBlockerCodes = new Set(before?.blockers.map(b => b.code) || []);
  const afterBlockerCodes = new Set(after.blockers.map(b => b.code));

  Array.from(afterBlockerCodes).forEach(code => {
    if (!beforeBlockerCodes.has(code)) {
      blockersAdded.push(code);
    }
  });

  Array.from(beforeBlockerCodes).forEach(code => {
    if (!afterBlockerCodes.has(code)) {
      blockersResolved.push(code);
    }
  });

  return {
    updatedFields,
    lockedFieldsSkipped,
    updatedSteps,
    blockersAdded,
    blockersResolved,
    beforeComputedAt: before?.computedAt || "",
    afterComputedAt: after.computedAt,
  };
}

/**
 * Get steps for a specific platform
 */
export function getStepsForPlatform(platform: "gbp" | "meta" | "quickbooks"): ChecklistStep[] {
  return Object.values(STEP_REGISTRY)
    .filter(step => step.platform === platform)
    .map(step => ({ ...step, status: "pending" as StepStatus, blockers: [] }));
}

/**
 * Mark a step as complete
 */
export function completeStep(
  checklist: Checklist,
  stepId: string,
  completedBy: "customer" | "admin" | "system" = "customer"
): Checklist {
  const now = new Date().toISOString();
  
  return {
    ...checklist,
    steps: checklist.steps.map(step => 
      step.stepId === stepId
        ? { ...step, status: "complete" as StepStatus, completedAt: now, completedBy }
        : step
    ),
  };
}

/**
 * Reset a step to pending, optionally cascading to dependent steps
 */
export function resetStep(
  checklist: Checklist,
  stepId: string,
  cascade: boolean = false
): Checklist {
  const getDependentSteps = (id: string): string[] => {
    const dependents: string[] = [];
    for (const step of checklist.steps) {
      if (step.prereqs.includes(id)) {
        dependents.push(step.stepId);
        if (cascade) {
          dependents.push(...getDependentSteps(step.stepId));
        }
      }
    }
    return dependents;
  };

  const stepsToReset = [stepId, ...(cascade ? getDependentSteps(stepId) : [])];

  return {
    ...checklist,
    steps: checklist.steps.map(step => 
      stepsToReset.includes(step.stepId)
        ? { ...step, status: "pending" as StepStatus, completedAt: undefined, completedBy: undefined }
        : step
    ),
  };
}

/**
 * Lock a field to prevent recompute from changing it
 */
export function lockField(
  checklist: Checklist,
  fieldKey: string,
  lockedBy: "customer" | "admin" | "system" = "customer"
): Checklist {
  const now = new Date().toISOString();
  
  return {
    ...checklist,
    fields: {
      ...checklist.fields,
      [fieldKey]: {
        ...checklist.fields[fieldKey],
        isLocked: true,
        lockedBy,
        lockedAt: now,
      },
    },
  };
}

/**
 * Unlock a field to allow recompute to update it
 */
export function unlockField(checklist: Checklist, fieldKey: string): Checklist {
  return {
    ...checklist,
    fields: {
      ...checklist.fields,
      [fieldKey]: {
        ...checklist.fields[fieldKey],
        isLocked: false,
        lockedBy: undefined,
        lockedAt: undefined,
      },
    },
  };
}

/**
 * Update a field value manually (auto-locks the field)
 */
export function updateFieldValue(
  checklist: Checklist,
  fieldKey: string,
  newValue: any,
  updatedBy: "customer" | "admin" = "customer"
): Checklist {
  const now = new Date().toISOString();
  const existingField = checklist.fields[fieldKey];
  
  if (!existingField) {
    return checklist;
  }

  return {
    ...checklist,
    fields: {
      ...checklist.fields,
      [fieldKey]: {
        ...existingField,
        value: newValue,
        source: "manual",
        isLocked: true,
        lockedBy: updatedBy,
        lockedAt: now,
        updatedAt: now,
      },
    },
  };
}
