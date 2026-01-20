#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=".test_runs"
mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
VITEST_OUT="$OUT_DIR/vitest_${STAMP}.out"

echo "==> Running test suite (capturing output)..."
pnpm test 2>&1 | tee "$VITEST_OUT" || true

echo ""
echo "==> Triaging failures into Tier0/Tier1/Tier2..."
pnpm tsx scripts/test/triageFailures.ts --from "$VITEST_OUT"

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
echo "Done."
