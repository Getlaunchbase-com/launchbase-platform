#!/usr/bin/env node
/**
 * Smoke test for preflight validation
 * Tests all tier + addon combinations
 */

import { runPreflight } from '../../server/ai/orchestration/runPreflight.js';

const TIERS = ['standard', 'growth', 'premium'];

const ADDON_COMBOS = [
  [],
  ['inbox_engine'],
  ['phone_engine'],
  ['social_engine'],
  ['ads_engine'],
  ['books_engine'],
  ['inbox_engine', 'phone_engine'], // Comms Pack
  ['social_engine'], // Marketing Pack
  ['ads_engine'], // Ads Pack
  ['books_engine'], // Ops Pack
];

async function testPreflight() {
  console.log('=== SMOKE TEST: Preflight Validation ===\n');
  
  let passCount = 0;
  let failCount = 0;
  
  for (const tier of TIERS) {
    console.log(`\n📋 Testing tier: ${tier.toUpperCase()}`);
    
    for (const addons of ADDON_COMBOS) {
      const testName = `${tier} + ${addons.length ? addons.join(', ') : 'no addons'}`;
      
      try {
        // Create synthetic intake
        const intake = {
          id: Math.floor(Math.random() * 1000000),
          rawPayload: {
            businessName: 'Test Business',
            location: 'San Francisco, CA',
            services: 'Web design, SEO, Marketing',
            idealCustomer: 'Small businesses',
            primaryGoal: 'more leads',
            cta: 'book',
            addons,
            // Conditionally add tier-specific fields
            ...(tier === 'growth' || tier === 'premium' ? {
              leadHandling: 'email',
              reviews: 'https://google.com/reviews/test',
            } : {}),
            ...(tier === 'premium' ? {
              currentTools: 'QuickBooks, Google Workspace',
              automationPriorities: 'invoicing, email',
              accessMethod: 'oauth',
            } : {}),
          },
        };
        
        const result = await runPreflight({ intake, tier });
        
        // Validate result structure
        if (!result.validation || !result.addonPlan || !result.repairPacket) {
          throw new Error('Missing required fields in preflight result');
        }
        
        // Check status
        const expectedStatus = 'PASS'; // All required fields provided
        if (result.validation.status !== expectedStatus) {
          throw new Error(`Expected status ${expectedStatus}, got ${result.validation.status}`);
        }
        
        // Check tier-aware addon eligibility
        if (tier === 'standard') {
          if (result.addonPlan.addonsEligibleByTier.social_engine) {
            throw new Error('Standard tier should not be eligible for social_engine');
          }
        }
        
        if (tier === 'premium') {
          if (!result.addonPlan.addonsEligibleByTier.ads_engine) {
            throw new Error('Premium tier should be eligible for ads_engine');
          }
        }
        
        // Check minimal questions
        if (result.repairPacket.questions.length > 0) {
          throw new Error(`Expected 0 questions for complete intake, got ${result.repairPacket.questions.length}`);
        }
        
        console.log(`  ✅ ${testName}`);
        passCount++;
        
      } catch (error) {
        console.log(`  ❌ ${testName}: ${error.message}`);
        failCount++;
      }
    }
  }
  
  console.log(`\n\n=== RESULTS ===`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Total: ${passCount + failCount}`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

testPreflight().catch(err => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
