#!/bin/bash
# scripts/ci/check-intake-inserts.sh
# CI check: Ban direct db.insert(intakes) outside server/db.ts

set -e

echo "🔍 Checking for unauthorized db.insert(intakes) calls..."

# Find all direct inserts outside server/db.ts and server/db-helpers.ts
VIOLATIONS=$(grep -rn "db\.insert(intakes)" server/ \
  --include="*.ts" \
  --exclude="db.ts" \
  --exclude="db-helpers.ts" \
  | grep -v "// @allow-direct-insert" \
  | grep -v "test.ts" \
  || true)

if [ -n "$VIOLATIONS" ]; then
  echo "❌ FAILED: Found unauthorized db.insert(intakes) calls:"
  echo "$VIOLATIONS"
  echo ""
  echo "✅ FIX: Use createIntake() or getDefaultIntakeCredits() helper instead."
  echo "   If you MUST use direct insert (e.g., in tests), add comment: // @allow-direct-insert"
  exit 1
fi

echo "✅ PASSED: No unauthorized db.insert(intakes) calls found."
exit 0
