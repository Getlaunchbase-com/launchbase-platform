/**
 * Unit Tests for normalizeCraftFastPayload
 * 
 * Run: pnpm tsx scripts/pilot/normalizer.test.ts
 */

import { normalizeCraftFastPayload } from './normalizer';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || 'Assertion failed'}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

// Test 1: Truncate if >8
test('Truncate proposedChanges from 10 to 8', () => {
  const payload = {
    proposedChanges: Array.from({ length: 10 }, (_, i) => ({ id: i })),
  };
  
  const result = normalizeCraftFastPayload(payload);
  
  assertEqual(result.payload.proposedChanges.length, 8, 'Should truncate to 8');
  assertEqual(result.event.truncated, true, 'Should mark as truncated');
  assertEqual(result.event.from, 10, 'Should record from=10');
  assertEqual(result.event.to, 8, 'Should record to=8');
  assertEqual(result.payload.proposedChanges[0].id, 0, 'Should keep first item');
  assertEqual(result.payload.proposedChanges[7].id, 7, 'Should keep 8th item');
});

// Test 2: Leave as-is if =8
test('Leave proposedChanges unchanged if exactly 8', () => {
  const payload = {
    proposedChanges: Array.from({ length: 8 }, (_, i) => ({ id: i })),
  };
  
  const result = normalizeCraftFastPayload(payload);
  
  assertEqual(result.payload.proposedChanges.length, 8, 'Should remain 8');
  assertEqual(result.event.truncated, false, 'Should not mark as truncated');
  assertEqual(result.event.from, 8, 'Should record from=8');
  assertEqual(result.event.to, 8, 'Should record to=8');
});

// Test 3: Leave as-is if <8
test('Leave proposedChanges unchanged if less than 8', () => {
  const payload = {
    proposedChanges: Array.from({ length: 5 }, (_, i) => ({ id: i })),
  };
  
  const result = normalizeCraftFastPayload(payload);
  
  assertEqual(result.payload.proposedChanges.length, 5, 'Should remain 5');
  assertEqual(result.event.truncated, false, 'Should not mark as truncated');
  assertEqual(result.event.from, 5, 'Should record from=5');
  assertEqual(result.event.to, 5, 'Should record to=5');
});

// Test 4: Handle missing proposedChanges
test('Handle missing proposedChanges gracefully', () => {
  const payload = { other: 'field' };
  
  const result = normalizeCraftFastPayload(payload);
  
  assertEqual(result.payload, payload, 'Should return unchanged');
  assertEqual(result.event.truncated, false, 'Should not mark as truncated');
  assertEqual(result.event.from, 0, 'Should record from=0');
  assertEqual(result.event.to, 0, 'Should record to=0');
});

// Test 5: Handle null/undefined
test('Handle null payload gracefully', () => {
  const result = normalizeCraftFastPayload(null);
  
  assertEqual(result.payload, null, 'Should return null');
  assertEqual(result.event.truncated, false, 'Should not mark as truncated');
});

// Test 6: Never reorder or rewrite content
test('Never reorder or rewrite content', () => {
  const payload = {
    proposedChanges: [
      { id: 'z', value: 'last' },
      { id: 'a', value: 'first' },
      { id: 'm', value: 'middle' },
      { id: 'x', value: 'extra1' },
      { id: 'y', value: 'extra2' },
      { id: 'b', value: 'extra3' },
      { id: 'c', value: 'extra4' },
      { id: 'd', value: 'extra5' },
      { id: 'e', value: 'extra6' },
      { id: 'f', value: 'extra7' },
    ],
  };
  
  const result = normalizeCraftFastPayload(payload);
  
  assertEqual(result.payload.proposedChanges.length, 8, 'Should truncate to 8');
  assertEqual(result.payload.proposedChanges[0].id, 'z', 'Should keep original order (first item)');
  assertEqual(result.payload.proposedChanges[1].id, 'a', 'Should keep original order (second item)');
  assertEqual(result.payload.proposedChanges[7].id, 'd', 'Should keep original order (8th item)');
});

console.log('\n✅ All normalizer tests passed!');
