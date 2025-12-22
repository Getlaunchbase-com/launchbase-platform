/**
 * Module Setup Configuration
 * Defines the setup steps for each LaunchBase Suite module
 * 
 * Philosophy: Customer already gave core info during intake.
 * Each module only asks for INCREMENTAL info specific to that module.
 */

export type ModuleKey = "social_media_intelligence" | "quickbooks_sync" | "google_business";

export interface SetupStep {
  key: string;
  order: number;
  title: string;
  description: string;
  // What we need from customer
  customerAction: string;
  // What we (LaunchBase) do
  launchbaseAction: string;
  // Is this step optional?
  optional?: boolean;
  // Estimated time to complete
  estimatedMinutes: number;
}

export interface ModuleConfig {
  key: ModuleKey;
  name: string;
  tagline: string;
  // What's already known from intake (no need to ask again)
  inheritedFromIntake: string[];
  // Additional info needed for this module
  additionalInfoNeeded: string[];
  // Setup steps
  steps: SetupStep[];
  // Pricing
  setupFee: number;
  monthlyFee: number | { low: number; medium: number; high: number };
}

/**
 * Social Media Intelligence Module
 * Automated posting based on weather, sports, community, and trends
 */
export const socialMediaIntelligenceConfig: ModuleConfig = {
  key: "social_media_intelligence",
  name: "Social Media Intelligence",
  tagline: "Automated posts that feel human, timed to what matters locally.",
  inheritedFromIntake: [
    "Business name",
    "Services offered",
    "Service area / location",
    "Brand voice / tone",
  ],
  additionalInfoNeeded: [
    "Facebook Page access",
    "Posting preferences (times, frequency)",
    "Photo library (optional)",
  ],
  setupFee: 249,
  monthlyFee: { low: 79, medium: 129, high: 199 },
  steps: [
    {
      key: "connect_facebook",
      order: 1,
      title: "Connect Your Facebook Page",
      description: "Link your business Facebook Page so we can post on your behalf.",
      customerAction: "Click 'Connect Facebook' and authorize LaunchBase to manage your Page.",
      launchbaseAction: "We securely store your Page access and never post without your approval (in Guided mode).",
      estimatedMinutes: 2,
    },
    {
      key: "set_preferences",
      order: 2,
      title: "Set Posting Preferences",
      description: "Tell us when you want posts to go out and how often.",
      customerAction: "Choose your preferred posting times and quiet hours.",
      launchbaseAction: "We configure your posting schedule and respect your business hours.",
      estimatedMinutes: 3,
    },
    {
      key: "review_first_post",
      order: 3,
      title: "Review Your First Scheduled Post",
      description: "See how we write posts for your business before anything goes live.",
      customerAction: "Review the sample post and approve, edit, or request changes.",
      launchbaseAction: "We generate a sample post based on current conditions and your business.",
      estimatedMinutes: 5,
    },
  ],
};

/**
 * QuickBooks Sync Module
 * Automated invoicing, customer sync, and payment tracking
 */
export const quickbooksSyncConfig: ModuleConfig = {
  key: "quickbooks_sync",
  name: "QuickBooks Sync",
  tagline: "Quotes → Invoices → Payments → Tax records. Almost no admin.",
  inheritedFromIntake: [
    "Business name",
    "Contact email",
    "Services offered",
  ],
  additionalInfoNeeded: [
    "QuickBooks Online login",
    "Chart of accounts mapping",
    "Invoice template preferences",
    "Payment terms (Net 15, Net 30, etc.)",
  ],
  setupFee: 499,
  monthlyFee: 79,
  steps: [
    {
      key: "connect_quickbooks",
      order: 1,
      title: "Connect QuickBooks Online",
      description: "Link your QuickBooks account so we can sync customers and invoices.",
      customerAction: "Click 'Connect QuickBooks' and sign in to authorize LaunchBase.",
      launchbaseAction: "We securely connect to your QuickBooks and never modify data without your approval.",
      estimatedMinutes: 3,
    },
    {
      key: "map_accounts",
      order: 2,
      title: "Map Your Chart of Accounts",
      description: "Tell us which accounts to use for income, expenses, and services.",
      customerAction: "Review our suggested mappings and adjust if needed.",
      launchbaseAction: "We auto-detect your existing accounts and suggest the best mappings.",
      estimatedMinutes: 5,
    },
    {
      key: "import_customers",
      order: 3,
      title: "Import Existing Customers",
      description: "Bring in your current customer list so everything is in sync.",
      customerAction: "Confirm which customers to import (or import all).",
      launchbaseAction: "We pull your customer list and sync it with your LaunchBase CRM.",
      optional: true,
      estimatedMinutes: 2,
    },
    {
      key: "setup_invoice_template",
      order: 4,
      title: "Set Up Invoice Template",
      description: "Customize how your invoices look when sent to customers.",
      customerAction: "Choose your payment terms and review the invoice preview.",
      launchbaseAction: "We apply your branding and set up automatic invoice generation.",
      estimatedMinutes: 5,
    },
  ],
};

/**
 * Google Business Module
 * Review management, listing optimization, and local SEO
 */
export const googleBusinessConfig: ModuleConfig = {
  key: "google_business",
  name: "Google Business Assistant",
  tagline: "Reviews answered. Listings optimized. Local SEO handled.",
  inheritedFromIntake: [
    "Business name",
    "Services offered",
    "Service area / location",
    "Contact info",
  ],
  additionalInfoNeeded: [
    "Google Business Profile access",
    "Review response preferences",
    "Business hours (if different from intake)",
  ],
  setupFee: 249,
  monthlyFee: 49,
  steps: [
    {
      key: "connect_google",
      order: 1,
      title: "Connect Google Business Profile",
      description: "Link your Google Business Profile so we can manage reviews and listings.",
      customerAction: "Click 'Connect Google' and authorize LaunchBase to manage your profile.",
      launchbaseAction: "We securely connect and sync your current listing information.",
      estimatedMinutes: 3,
    },
    {
      key: "set_review_preferences",
      order: 2,
      title: "Set Review Response Preferences",
      description: "Tell us how you want to handle customer reviews.",
      customerAction: "Choose your response style (professional, friendly, etc.) and approval mode.",
      launchbaseAction: "We draft responses matching your brand voice. You approve before posting.",
      estimatedMinutes: 3,
    },
    {
      key: "verify_listing",
      order: 3,
      title: "Verify & Optimize Listing",
      description: "Make sure your Google listing is complete and optimized for local search.",
      customerAction: "Review our optimization suggestions and approve changes.",
      launchbaseAction: "We audit your listing and suggest improvements for better visibility.",
      estimatedMinutes: 5,
    },
  ],
};

/**
 * All module configurations
 */
export const moduleConfigs: Record<ModuleKey, ModuleConfig> = {
  social_media_intelligence: socialMediaIntelligenceConfig,
  quickbooks_sync: quickbooksSyncConfig,
  google_business: googleBusinessConfig,
};

/**
 * Get total steps for a module
 */
export function getTotalSteps(moduleKey: ModuleKey): number {
  return moduleConfigs[moduleKey].steps.length;
}

/**
 * Get estimated total time for a module setup
 */
export function getEstimatedSetupTime(moduleKey: ModuleKey): number {
  return moduleConfigs[moduleKey].steps.reduce((acc, step) => acc + step.estimatedMinutes, 0);
}

/**
 * Calculate completion percentage
 */
export function calculateCompletion(completedSteps: number, totalSteps: number): number {
  if (totalSteps === 0) return 100;
  return Math.round((completedSteps / totalSteps) * 100);
}


/**
 * Get module configuration by key
 */
export function getModuleConfig(moduleKey: ModuleKey): ModuleConfig | undefined {
  return moduleConfigs[moduleKey];
}

/**
 * Calculate module progress from completed step keys
 */
export function calculateModuleProgress(
  moduleKey: ModuleKey,
  completedStepKeys: string[]
): { completed: number; total: number; percentage: number } {
  const config = moduleConfigs[moduleKey];
  if (!config) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const total = config.steps.length;
  const completed = config.steps.filter(s => completedStepKeys.includes(s.key)).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}

/**
 * Get the next incomplete step for a module
 */
export function getNextIncompleteStep(
  moduleKey: ModuleKey,
  completedStepKeys: string[]
): SetupStep | undefined {
  const config = moduleConfigs[moduleKey];
  if (!config) return undefined;

  // Find first step that's not in completedStepKeys
  return config.steps.find(s => !completedStepKeys.includes(s.key));
}

/**
 * Module pricing helper - normalized structure
 */
export interface ModulePricing {
  setupFee: number;
  monthlyBase: number;
  monthlyMax?: number;
}

/**
 * Get normalized pricing for a module
 */
export function getModulePricing(moduleKey: ModuleKey): ModulePricing {
  const config = moduleConfigs[moduleKey];
  if (!config) {
    return { setupFee: 0, monthlyBase: 0 };
  }

  if (typeof config.monthlyFee === "number") {
    return {
      setupFee: config.setupFee,
      monthlyBase: config.monthlyFee,
    };
  }

  return {
    setupFee: config.setupFee,
    monthlyBase: config.monthlyFee.low,
    monthlyMax: config.monthlyFee.high,
  };
}

// Re-export pricing helper for tests
export { getModulePricing as getPricing };

// Add pricing property to moduleConfigs for backward compatibility
Object.defineProperty(moduleConfigs.social_media_intelligence, 'pricing', {
  get() {
    return getModulePricing('social_media_intelligence');
  }
});

Object.defineProperty(moduleConfigs.quickbooks_sync, 'pricing', {
  get() {
    return getModulePricing('quickbooks_sync');
  }
});

Object.defineProperty(moduleConfigs.google_business, 'pricing', {
  get() {
    return getModulePricing('google_business');
  }
});
