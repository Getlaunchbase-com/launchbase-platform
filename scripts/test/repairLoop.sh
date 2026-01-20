#!/usr/bin/env bash
set -euo pipefail

OUT_FILE="scripts/test/out/vitest.out.txt"
mkdir -p "scripts/test/out"

echo "==> Running test suite (capturing output)..."
set +e
pnpm vitest run --reporter=default 2>&1 | tee "$OUT_FILE"
VITEST_EXIT=${PIPESTATUS[0]}
set -e

echo ""
echo "==> Triaging failures into Tier0/Tier1/Tier2..."
cat "$OUT_FILE" | pnpm tsx scripts/test/triageFailures.ts

echo ""
echo "==> Next steps (manual or swarm-assisted)"
echo "  1) Open scripts/test/triageFailures.json"
echo "  2) Clear Tier0 first"
echo "  3) Then Tier1"
echo "  4) Treat Tier2 as integration decisions"

echo ""
echo "==> Optional (swarm hook placeholder)"
echo "  If you have a FailurePacket ready:"
echo "    AI_PROVIDER=replay SWARM_REPLAY_RUN_ID=<id> pnpm tsx scripts/swarm/runRepair.ts --from <failurepacket.json>"
echo ""
echo "Vitest exit code: $VITEST_EXIT"
exit "$VITEST_EXIT"
