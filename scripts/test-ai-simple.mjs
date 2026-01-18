import { completeJson } from '../server/ai/providers/providerFactory.ts';

async function test() {
  console.log('Testing AI provider...');
  console.log('AIML_API_KEY set:', !!process.env.AIML_API_KEY);
  try {
    const result = await completeJson(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Return JSON.' },
          { role: 'user', content: 'Return a JSON object with a greeting field saying hello.' }
        ],
        temperature: 0.7,
        maxTokens: 100,
        trace: { jobId: 'test', step: 'test', round: 0 }
      },
      'aiml',
      { task: 'json', useRouter: false, strict: false }
    );
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

test();
