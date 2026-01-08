#!/usr/bin/env node
/**
 * Stripe Product Auto-Creation Script
 * 
 * Run this ONCE to create all Social Media Intelligence products in Stripe.
 * After running, copy the Price IDs and add them to your environment variables.
 * 
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/create-stripe-products.mjs
 * 
 * Or if STRIPE_SECRET_KEY is already in your environment:
 *   node scripts/create-stripe-products.mjs
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const products = [
  // Cadence Tiers (Subscriptions)
  {
    name: 'Social Media Intelligence - Low Cadence',
    description: 'Stay visible without noise. 1-2 posts per week based on weather and local context.',
    metadata: {
      module: 'social_media_intelligence',
      type: 'cadence',
      cadence_level: 'low',
    },
    price: {
      unit_amount: 7900, // $79.00
      currency: 'usd',
      recurring: { interval: 'month' },
    },
    envVar: 'PRICE_CADENCE_LOW',
  },
  {
    name: 'Social Media Intelligence - Medium Cadence',
    description: 'Balanced, timely presence. 2-3 posts per week with optimal timing.',
    metadata: {
      module: 'social_media_intelligence',
      type: 'cadence',
      cadence_level: 'medium',
    },
    price: {
      unit_amount: 12900, // $129.00
      currency: 'usd',
      recurring: { interval: 'month' },
    },
    envVar: 'PRICE_CADENCE_MED',
  },
  {
    name: 'Social Media Intelligence - High Cadence',
    description: 'High visibility during important moments. 4-6 posts per week.',
    metadata: {
      module: 'social_media_intelligence',
      type: 'cadence',
      cadence_level: 'high',
    },
    price: {
      unit_amount: 19900, // $199.00
      currency: 'usd',
      recurring: { interval: 'month' },
    },
    envVar: 'PRICE_CADENCE_HIGH',
  },

  // Context Layer Add-ons (Subscriptions)
  {
    name: 'Local Context - Sports & Events',
    description: 'Reference local sports games, concerts, and community events in your posts.',
    metadata: {
      module: 'social_media_intelligence',
      type: 'layer',
      layer_key: 'sports',
    },
    price: {
      unit_amount: 2900, // $29.00
      currency: 'usd',
      recurring: { interval: 'month' },
    },
    envVar: 'PRICE_LAYER_SPORTS',
  },
  {
    name: 'Local Context - Community & Schools',
    description: 'Reference school schedules, closings, and community calendar events.',
    metadata: {
      module: 'social_media_intelligence',
      type: 'layer',
      layer_key: 'community',
    },
    price: {
      unit_amount: 3900, // $39.00
      currency: 'usd',
      recurring: { interval: 'month' },
    },
    envVar: 'PRICE_LAYER_COMMUNITY',
  },
  {
    name: 'Local Context - Local Trends',
    description: 'Reference Google Trends, local news, and trending topics in your area.',
    metadata: {
      module: 'social_media_intelligence',
      type: 'layer',
      layer_key: 'trends',
    },
    price: {
      unit_amount: 4900, // $49.00
      currency: 'usd',
      recurring: { interval: 'month' },
    },
    envVar: 'PRICE_LAYER_TRENDS',
  },

  // Setup Fees (One-time)
  {
    name: 'Social Media Intelligence - Base Setup',
    description: 'One-time setup fee for Social Media Intelligence module. Includes Facebook connection, posting preferences, and first post review.',
    metadata: {
      module: 'social_media_intelligence',
      type: 'setup',
      setup_type: 'base',
    },
    price: {
      unit_amount: 24900, // $249.00
      currency: 'usd',
    },
    envVar: 'PRICE_SETUP_BASE',
  },
  {
    name: 'Context Layer Setup Fee',
    description: 'One-time setup fee per additional context layer. Includes configuration and integration.',
    metadata: {
      module: 'social_media_intelligence',
      type: 'setup',
      setup_type: 'layer',
    },
    price: {
      unit_amount: 9900, // $99.00
      currency: 'usd',
    },
    envVar: 'PRICE_SETUP_LAYER',
  },
];

async function createProducts() {
  console.log('🚀 Creating Stripe products for Social Media Intelligence...\n');

  const results = [];

  for (const productDef of products) {
    try {
      // Create the product
      const product = await stripe.products.create({
        name: productDef.name,
        description: productDef.description,
        metadata: productDef.metadata,
      });

      console.log(`✅ Created product: ${product.name}`);

      // Create the price
      const priceData = {
        product: product.id,
        unit_amount: productDef.price.unit_amount,
        currency: productDef.price.currency,
        metadata: productDef.metadata,
      };

      if (productDef.price.recurring) {
        priceData.recurring = productDef.price.recurring;
      }

      const price = await stripe.prices.create(priceData);

      console.log(`   Price ID: ${price.id}`);
      console.log(`   Amount: $${(price.unit_amount / 100).toFixed(2)}${price.recurring ? '/mo' : ' (one-time)'}`);
      console.log('');

      results.push({
        envVar: productDef.envVar,
        priceId: price.id,
        productId: product.id,
        name: productDef.name,
        amount: price.unit_amount / 100,
        recurring: !!price.recurring,
      });

    } catch (error) {
      console.error(`❌ Failed to create ${productDef.name}:`, error.message);
    }
  }

  // Output summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 COPY THESE TO YOUR ENVIRONMENT VARIABLES:');
  console.log('='.repeat(60) + '\n');

  for (const result of results) {
    console.log(`${result.envVar}=${result.priceId}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(60));
  console.log(`Total products created: ${results.length}`);
  console.log(`Recurring subscriptions: ${results.filter(r => r.recurring).length}`);
  console.log(`One-time payments: ${results.filter(r => !r.recurring).length}`);
  console.log('\n✨ Done! Add the environment variables above to your LaunchBase secrets.');

  return results;
}

// Run the script
createProducts().catch(console.error);
