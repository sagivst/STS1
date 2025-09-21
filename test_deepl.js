const { Translator } = require('deepl-node');

async function testDeepLConnection() {
  try {
    const translator = new Translator('672097f6-2818-4022-be20-6f7118e12143:fx');
    
    console.log('Testing DeepL API connection...');
    
    const result = await translator.translateText('Hello world', null, 'ja');
    
    console.log('✅ DeepL API connection successful!');
    console.log('Original text: Hello world');
    console.log('Translated text:', result.text);
    console.log('Detected source language:', result.detectedSourceLang);
    
    const reverseResult = await translator.translateText('こんにちは世界', null, 'en-US');
    console.log('Reverse translation:', reverseResult.text);
    
  } catch (error) {
    console.error('❌ DeepL API connection failed:', error.message);
    process.exit(1);
  }
}

testDeepLConnection();
