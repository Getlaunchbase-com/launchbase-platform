import { initializeModelRegistry, modelRegistry } from '../server/ai/index.ts';
import { hasCapability, hasAllCapabilities } from '../server/ai/modelRouting/featureAliases.ts';

async function test() {
  await initializeModelRegistry();
  
  const gpt52 = modelRegistry.get('openai/gpt-5-2');
  console.log('gpt-5-2 features:', gpt52?.features);
  console.log('Has json_schema:', hasCapability(gpt52?.features || [], 'json_schema'));
  console.log('Has all [json_schema]:', hasAllCapabilities(gpt52?.features || [], ['json_schema']));
  
  // Check if openai/chat-completion.response-format is in features
  console.log('Has response-format directly:', gpt52?.features.includes('openai/chat-completion.response-format'));
}

test();
