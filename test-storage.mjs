import { storagePut, storageGet } from './server/storage.js';

async function testStorage() {
  try {
    console.log('Testing storage PUT...');
    const putResult = await storagePut('test-ops-chat/test.txt', 'Hello from storage test', 'text/plain');
    console.log('✅ Storage PUT success:', putResult);
    
    console.log('\nTesting storage GET...');
    const getResult = await storageGet('test-ops-chat/test.txt');
    console.log('✅ Storage GET success:', getResult);
    
    console.log('\nFetching content...');
    const response = await fetch(getResult.url);
    const content = await response.text();
    console.log('✅ Content retrieved:', content);
    
  } catch (error) {
    console.error('❌ Storage test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testStorage();
