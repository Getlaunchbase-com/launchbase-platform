import fs from 'node:fs';
import type { Intake } from '../../../drizzle/schema.js';
import {
  IntakeValidationV1Schema,
  AddonPlanV1Schema,
  RepairPacketV1Schema,
  type IntakeValidationV1,
  type AddonPlanV1,
  type RepairPacketV1,
  type PreflightResultV1,
} from '../../contracts/preflight.js';
import { writeFailurePacket, createFailurePacket } from '../../utils/fileLog.js';

const LOG_FILE = '/tmp/launchbase_preflight.log';

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

type Tier = 'standard' | 'growth' | 'premium';

interface PreflightInput {
  intake: Intake;
  tier: Tier;
}

/**
 * Run deterministic preflight validation on intake
 * NO LLM calls - pure rule-based validation
 */
export async function runPreflight(input: PreflightInput): Promise<PreflightResultV1> {
  const { intake, tier } = input;
  const runId = `preflight_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  
  log(`[runPreflight] START runId=${runId} tier=${tier} intakeId=${intake.id}`);
  
  try {
    // Parse intake payload
    const payload = intake.rawPayload as Record<string, unknown>;
    
    // 1. Detect capabilities
    const detectedCapabilities = {
      hasWebsiteUrl: !!payload.websiteUrl,
      hasBookingLink: !!payload.bookingLink,
      hasBrandColors: !!payload.brandColors,
      hasLogo: !!payload.logoUrl,
      hasReviews: !!payload.reviews || !!payload.reviewsUrl,
      hasGoogleAccount: !!payload.googleAccountEmail,
      hasQuickBooksAccount: !!payload.quickbooksConnected,
    };
    
    // 2. Derive metadata
    const derived = {
      vertical: (payload.industry as string) || undefined,
      websiteStatus: payload.websiteUrl ? 'existing' as const : 'none' as const,
      audience: (payload.idealCustomer as string) || undefined,
      language: 'en',
    };
    
    // 3. Validate completeness (tier-aware)
    const missingFields: string[] = [];
    
    // Universal fields (all tiers)
    if (!payload.businessName) missingFields.push('businessName');
    if (!payload.location) missingFields.push('location');
    if (!payload.services) missingFields.push('services');
    if (!payload.idealCustomer) missingFields.push('idealCustomer');
    if (!payload.primaryGoal) missingFields.push('primaryGoal');
    if (!payload.cta) missingFields.push('cta');
    
    // Growth tier adds
    if (tier === 'growth' || tier === 'premium') {
      if (!payload.leadHandling) missingFields.push('leadHandling');
      if (!payload.reviews && !payload.reviewsUrl) missingFields.push('reviews');
    }
    
    // Premium tier adds
    if (tier === 'premium') {
      if (!payload.currentTools) missingFields.push('currentTools');
      if (!payload.automationPriorities) missingFields.push('automationPriorities');
      if (!payload.accessMethod) missingFields.push('accessMethod');
    }
    
    // 4. Determine status
    const status: 'PASS' | 'NEEDS_INFO' | 'BLOCKED' = missingFields.length === 0 ? 'PASS' : 'NEEDS_INFO';
    const confidence = 1 - (missingFields.length * 0.1);
    
    // 5. Build validation
    const validation: IntakeValidationV1 = {
      version: 'intake_validation.v1',
      timestamp: new Date().toISOString(),
      status,
      tier,
      confidence: Math.max(0, Math.min(1, confidence)),
      derived,
      detectedCapabilities,
    };
    
    // 6. Build addon plan
    const addonsRequested = (payload.addons as string[]) || [];
    
    const addonPlan: AddonPlanV1 = {
      version: 'addon_plan.v1',
      timestamp: new Date().toISOString(),
      addonsRequested,
      addonsEligibleByTier: {
        inbox_engine: tier === 'growth' || tier === 'premium',
        phone_engine: tier === 'growth' || tier === 'premium',
        social_engine: tier === 'premium',
        ads_engine: tier === 'premium',
        books_engine: tier === 'premium',
      },
      integrationReadiness: {
        inbox_engine: detectedCapabilities.hasGoogleAccount ? 'READY' : 'NEEDS_OAUTH',
        phone_engine: 'NEEDS_ACCESS',
        social_engine: 'NEEDS_OAUTH',
        ads_engine: detectedCapabilities.hasGoogleAccount ? 'NEEDS_ACCESS' : 'NEEDS_OAUTH',
        books_engine: detectedCapabilities.hasQuickBooksAccount ? 'READY' : 'NEEDS_OAUTH',
      },
      recommendedAddons: [],
    };
    
    // 7. Build repair packet
    const questions = missingFields.map(field => {
      const questionMap: Record<string, { question: string; whyItMatters: string; requiredForTier?: Tier }> = {
        businessName: {
          question: 'What is your business name?',
          whyItMatters: 'We use this for branding and legal compliance.',
        },
        location: {
          question: 'Where is your business located?',
          whyItMatters: 'We optimize for local SEO and show your service area.',
        },
        services: {
          question: 'What are your top 3 services or products?',
          whyItMatters: 'We structure your site around what you sell.',
        },
        idealCustomer: {
          question: 'Who is your ideal customer?',
          whyItMatters: 'We tailor messaging and design to your audience.',
        },
        primaryGoal: {
          question: 'What is your primary goal? (more calls / bookings / leads / sales)',
          whyItMatters: 'We optimize your site for this specific outcome.',
        },
        cta: {
          question: 'What is your primary call-to-action? (call / book / quote / buy)',
          whyItMatters: 'We make this action prominent and easy.',
        },
        leadHandling: {
          question: 'Where do leads go today? (email / CRM / spreadsheet / phone)',
          whyItMatters: 'We integrate with your existing workflow.',
          requiredForTier: 'growth',
        },
        reviews: {
          question: 'Do you have reviews or testimonials? (link or paste)',
          whyItMatters: 'Social proof increases conversion by 30-50%.',
          requiredForTier: 'growth',
        },
        currentTools: {
          question: 'Which tools do you currently use? (QuickBooks, Google Workspace, etc.)',
          whyItMatters: 'We integrate with your existing systems.',
          requiredForTier: 'premium',
        },
        automationPriorities: {
          question: 'What do you want automated first? (invoicing, call forwarding, email, social, ads)',
          whyItMatters: 'We prioritize the automation that saves you the most time.',
          requiredForTier: 'premium',
        },
        accessMethod: {
          question: 'How should we connect? (OAuth / manager access)',
          whyItMatters: 'We need permission to automate on your behalf.',
          requiredForTier: 'premium',
        },
      };
      
      const q = questionMap[field] || {
        question: `Please provide: ${field}`,
        whyItMatters: 'Required for your tier.',
      };
      
      return {
        key: field,
        ...q,
      };
    });
    
    const repairPacket: RepairPacketV1 = {
      version: 'repair_packet.v1',
      timestamp: new Date().toISOString(),
      minimal: true,
      questions,
    };
    
    // 8. Validate schemas
    const validatedValidation = IntakeValidationV1Schema.parse(validation);
    const validatedAddonPlan = AddonPlanV1Schema.parse(addonPlan);
    const validatedRepairPacket = RepairPacketV1Schema.parse(repairPacket);
    
    const result: PreflightResultV1 = {
      version: 'preflight_result.v1',
      validation: validatedValidation,
      addonPlan: validatedAddonPlan,
      repairPacket: validatedRepairPacket,
    };
    
    log(`[runPreflight] DONE runId=${runId} status=${status} missingFields=${missingFields.length}`);
    
    return result;
    
  } catch (error) {
    log(`[runPreflight] ERROR runId=${runId} error=${(error as Error).message}`);
    
    const failurePacket = createFailurePacket(
      runId,
      'preflight',
      error as Error,
      { tier, intakeId: intake.id },
      intake.id
    );
    
    writeFailurePacket(failurePacket);
    
    throw error;
  }
}
