import { completeJson } from '../server/ai/providers/providerFactory.ts';
import { initializeModelRegistry } from '../server/ai/index.ts';

async function test() {
  console.log('Initializing model registry...');
  await initializeModelRegistry();
  
  console.log('Testing AI provider with router...');
  try {
    const result = await completeJson(
      {
        model: 'openai/gpt-5-2',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Return JSON.' },
          { role: 'user', content: 'Return a JSON object with a greeting field saying hello.' }
        ],
        temperature: 0.7,
        maxTokens: 100,
        trace: { jobId: 'test', step: 'test', round: 0 }
      },
      'aiml',
      { task: 'json', useRouter: true, strict: false }
    );
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
