import { initializeModelRegistry, modelRegistry } from '../server/ai/index';

async function test() {
  await initializeModelRegistry();
  
  // Get snapshot and filter
  const snapshot = modelRegistry.snapshot;
  const allModels = Array.from(snapshot.models.values());
  
  const gptModels = allModels.filter(m => 
    m.id.toLowerCase().includes('gpt') || 
    m.id.toLowerCase().includes('o1') ||
    m.id.toLowerCase().includes('o3') ||
    m.id.toLowerCase().includes('o4')
  );
  
  console.log('=== GPT/OpenAI Models ===');
  gptModels.forEach(m => {
    console.log(`${m.id} (type: ${m.type})`);
  });
}

test().catch(console.error);
