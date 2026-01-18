import { completeJson } from '../server/ai/providers/providerFactory';
import { initializeModelRegistry } from '../server/ai/index';

async function test() {
  await initializeModelRegistry();
  
  const result = await completeJson({
    model: 'openai/gpt-5-2',
    messages: [
      { role: 'system', content: 'You are a systems designer. Return JSON with proposedChanges array.' },
      { role: 'user', content: 'Design 3 system changes for a landing page. Return { "proposedChanges": [...] }' }
    ],
    temperature: 0.7,
    maxTokens: 1000,
    trace: { jobId: 'test', step: 'test', round: 0 }
  });
  
  console.log('=== RESULT ===');
  console.log('rawText (first 500):', result?.rawText?.slice(0, 500));
  console.log('json:', JSON.stringify(result?.json, null, 2)?.slice(0, 1000));
  console.log('meta:', result?.meta);
}

test().catch(console.error);
