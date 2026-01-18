import { initializeModelRegistry, modelRegistry, modelPolicy } from '../server/ai/index.ts';

async function test() {
  console.log('Initializing model registry...');
  await initializeModelRegistry();
  
  const models = modelRegistry.list();
  console.log('Total models:', models.length);
  
  // Count by type
  const byType = {};
  for (const m of models) {
    byType[m.type] = (byType[m.type] || 0) + 1;
  }
  console.log('Models by type:', byType);
  
  // Check if gpt-5-2 exists
  const gpt52 = modelRegistry.get('openai/gpt-5-2');
  console.log('gpt-5-2:', gpt52 ? { id: gpt52.id, type: gpt52.type, features: gpt52.features } : 'NOT FOUND');
  
  const gpt4omini = modelRegistry.get('gpt-4o-mini');
  console.log('gpt-4o-mini:', gpt4omini ? { id: gpt4omini.id, type: gpt4omini.type, features: gpt4omini.features } : 'NOT FOUND');
  
  // Try to resolve json task
  try {
    const resolution = modelPolicy.resolve('json');
    console.log('JSON task resolution:', {
      primary: resolution.primary.id,
      fallbacks: resolution.fallbacks.map(f => f.id).slice(0, 3),
      filteredOut: resolution.reason.filteredOut
    });
  } catch (err) {
    console.error('JSON task resolution failed:', err.message);
  }
}

test();
