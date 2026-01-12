import { getDb } from '../server/db';
import { actionRequests, intakes } from '../drizzle/schema';

async function main() {
  const db = await getDb();

  // Create a test intake first
  const intakeResult = await db.insert(intakes).values({
    tenant: 'launchbase',
    businessName: 'Test Business',
    contactName: 'Test Contact',
    email: 'test@example.com',
    status: 'new',
    rawPayload: { test: true },
  });

  const intakeId = Number(intakeResult[0].insertId);
  console.log('Created test intake:', intakeId);

  // Scenario 1: Succeeded (stopReason = 'ok')
  const succeededData = {
    tenant: 'launchbase' as const,
    intakeId: intakeId,
    checklistKey: 'homepage.headline',
    proposedValue: 'Stop carrying the system in your head',
    status: 'pending' as const,
    token: `action_${Date.now()}_succeeded`,
    confidence: 0.92,
    rawInbound: {
      source: 'ai_tennis',
      aiTennis: {
        traceId: 'trace_succeeded_001',
        jobId: 'job_succeeded_001',
        rounds: 3,
        models: ['meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet'],
        requestIds: ['req_001', 'req_002', 'req_003'],
        usage: {
          inputTokens: 1500,
          outputTokens: 300,
        },
        costUsd: 0.0045,
        stopReason: 'ok',
        needsHuman: false,
        confidence: 0.92,
      },
      proposal: {
        targetKey: 'homepage.headline',
        value: 'Stop carrying the system in your head',
        rationale: 'This headline addresses the core pain point of mental load',
        confidence: 0.92,
        risks: ['May be too direct for some audiences'],
        assumptions: ['Target audience feels overwhelmed by manual systems'],
      },
    },
  };

  // Scenario 2: Failed (stopReason = 'provider_failed')
  const failedData = {
    tenant: 'launchbase' as const,
    intakeId: intakeId,
    checklistKey: 'homepage.subheadline',
    proposedValue: 'Your website exists. Your tools work.',
    status: 'pending' as const,
    token: `action_${Date.now()}_failed`,
    confidence: null,
    rawInbound: {
      source: 'ai_tennis',
      aiTennis: {
        traceId: 'trace_failed_001',
        jobId: 'job_failed_001',
        rounds: 1,
        models: ['meta-llama/llama-3.3-70b-instruct'],
        requestIds: ['req_004'],
        usage: {
          inputTokens: 800,
          outputTokens: 0,
        },
        costUsd: 0.0012,
        stopReason: 'provider_failed',
        needsHuman: true,
        confidence: null,
      },
      proposal: {
        targetKey: 'homepage.subheadline',
        value: '',
        rationale: '',
        confidence: 0,
        risks: [],
        assumptions: [],
      },
    },
  };

  // Scenario 3: Needs Human (stopReason = 'needs_human')
  const needsHumanData = {
    tenant: 'launchbase' as const,
    intakeId: intakeId,
    checklistKey: 'homepage.cta',
    proposedValue: 'Hand It Off',
    status: 'pending' as const,
    token: `action_${Date.now()}_needshuman`,
    confidence: 0.65,
    rawInbound: {
      source: 'ai_tennis',
      aiTennis: {
        traceId: 'trace_needshuman_001',
        jobId: 'job_needshuman_001',
        rounds: 2,
        models: ['meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet'],
        requestIds: ['req_005', 'req_006'],
        usage: {
          inputTokens: 1200,
          outputTokens: 200,
        },
        costUsd: 0.0035,
        stopReason: 'needs_human',
        needsHuman: true,
        confidence: 0.65,
      },
      proposal: {
        targetKey: 'homepage.cta',
        value: 'Hand It Off',
        rationale: 'Confidence below threshold - requires human review',
        confidence: 0.65,
        risks: ['CTA may not be clear enough', 'Needs A/B testing'],
        assumptions: ['Users understand "hand off" metaphor'],
      },
    },
  };

  // Insert all three scenarios
  const succeededResult = await db.insert(actionRequests).values(succeededData);
  const failedResult = await db.insert(actionRequests).values(failedData);
  const needsHumanResult = await db.insert(actionRequests).values(needsHumanData);

  const succeededId = Number(succeededResult[0].insertId);
  const failedId = Number(failedResult[0].insertId);
  const needsHumanId = Number(needsHumanResult[0].insertId);

  console.log('\n✅ Created 3 test scenarios:');
  console.log('1. Succeeded (id:', succeededId, ') - stopReason: ok');
  console.log('2. Failed (id:', failedId, ') - stopReason: provider_failed');
  console.log('3. Needs Human (id:', needsHumanId, ') - stopReason: needs_human');
  console.log('\nTest data ready for metrics query validation!');
}

main().catch(console.error);
