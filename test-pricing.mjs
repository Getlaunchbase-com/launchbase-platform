import { computePricing } from "./client/src/lib/computePricing.ts";

console.log("Testing computePricing logic...\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}\n`);
    failed++;
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) {
        throw new Error(`Expected ${expected}, got ${value}`);
      }
    },
    toBeGreaterThan(expected) {
      if (value <= expected) {
        throw new Error(`Expected ${value} to be greater than ${expected}`);
      }
    },
  };
}

// Test 1: Website + Email
test("Website + Email pricing", () => {
  const result = computePricing({
    website: true,
    emailService: true,
    socialMediaTier: null,
    enrichmentLayer: false,
    googleBusiness: false,
    quickBooksSync: false,
  });
  expect(result.setupTotalCents).toBe(49900 + 9900);
  expect(result.monthlyTotalCents).toBe(4900 + 1900);
});

// Test 2: Social Media LOW tier
test("Social Media LOW tier", () => {
  const result = computePricing({
    website: false,
    emailService: false,
    socialMediaTier: "LOW",
    enrichmentLayer: false,
    googleBusiness: false,
    quickBooksSync: false,
  });
  expect(result.setupTotalCents).toBe(29900);
  expect(result.monthlyTotalCents).toBe(7900);
});

// Test 3: Bundle discount (Website + Social)
test("Bundle discount: Website + Social", () => {
  const result = computePricing({
    website: true,
    emailService: true,
    socialMediaTier: "LOW",
    enrichmentLayer: false,
    googleBusiness: false,
    quickBooksSync: false,
  });
  expect(result.setupDiscountCents).toBe(14950); // 50% of $299
  expect(result.setupTotalCents).toBe(49900 + 9900 + 29900 - 14950);
});

// Test 4: Bundle discount (Social + Enrichment)
test("Bundle discount: Social + Enrichment", () => {
  const result = computePricing({
    website: false,
    emailService: false,
    socialMediaTier: "MEDIUM",
    enrichmentLayer: true,
    googleBusiness: false,
    quickBooksSync: false,
  });
  expect(result.setupDiscountCents).toBe(14950);
  expect(result.setupTotalCents).toBe(29900 + 19900 - 14950);
});

// Test 5: NO bundle discount (only 1 service)
test("NO bundle discount when only 1 service", () => {
  const result = computePricing({
    website: true,
    emailService: true,
    socialMediaTier: null,
    enrichmentLayer: false,
    googleBusiness: false,
    quickBooksSync: false,
  });
  expect(result.setupDiscountCents).toBe(0);
});

// Test 6: NO bundle discount (no social)
test("NO bundle discount when social not selected", () => {
  const result = computePricing({
    website: true,
    emailService: true,
    socialMediaTier: null,
    enrichmentLayer: false,
    googleBusiness: true,
    quickBooksSync: true,
  });
  expect(result.setupDiscountCents).toBe(0);
});

// Test 7: Founder promo with code
test("Founder promo with BETA-FOUNDERS code", () => {
  const result = computePricing({
    website: true,
    emailService: true,
    socialMediaTier: "HIGH",
    enrichmentLayer: true,
    googleBusiness: true,
    quickBooksSync: true,
    promoCode: "BETA-FOUNDERS",
  });
  expect(result.setupTotalCents).toBe(30000);
});

// Test 8: Founder promo with isFounderReserved
test("Founder promo with isFounderReserved=true", () => {
  const result = computePricing({
    website: true,
    emailService: true,
    socialMediaTier: "LOW",
    enrichmentLayer: false,
    googleBusiness: false,
    quickBooksSync: false,
    isFounderReserved: true,
  });
  expect(result.setupTotalCents).toBe(30000);
});

// Test 9: Invalid promo code
test("Invalid promo code should not apply discount", () => {
  const result = computePricing({
    website: true,
    emailService: true,
    socialMediaTier: null,
    enrichmentLayer: false,
    googleBusiness: false,
    quickBooksSync: false,
    promoCode: "INVALID",
  });
  expect(result.setupTotalCents).toBe(49900 + 9900);
});

// Test 10: All services with founder promo
test("All services with founder promo", () => {
  const result = computePricing({
    website: true,
    emailService: true,
    socialMediaTier: "HIGH",
    enrichmentLayer: true,
    googleBusiness: true,
    quickBooksSync: true,
    isFounderReserved: true,
  });
  expect(result.setupTotalCents).toBe(30000);
  expect(result.monthlyTotalCents).toBeGreaterThan(0);
});

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
