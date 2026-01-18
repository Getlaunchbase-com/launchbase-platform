import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AIML_API_KEY,
  baseURL: "https://api.aimlapi.com/v1",
  timeout: 60000,
});

async function test() {
  console.log('Calling GPT-5.2...');
  
  const completion = await client.chat.completions.create({
    model: 'openai/gpt-5-2',
    messages: [
      { role: 'system', content: 'You are a systems designer. Return JSON with proposedChanges array.' },
      { role: 'user', content: 'Design 3 system changes for a landing page. Return { "proposedChanges": [...] }' }
    ],
    temperature: 0.7,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });
  
  console.log('=== RAW COMPLETION ===');
  console.log(JSON.stringify(completion, null, 2));
}

test().catch(console.error);
