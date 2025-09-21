const { ElevenLabsApi } = require('elevenlabs');

async function testElevenLabsConnection() {
  try {
    const client = new ElevenLabsApi({
      apiKey: process.env.ELEVENLABS_API_KEY || 'test_key'
    });
    
    console.log('Testing ElevenLabs API connection...');
    
    const voices = await client.voices.getAll();
    console.log('✅ ElevenLabs API connection successful!');
    console.log('Available voices:', voices.voices.length);
    
    const japaneseVoices = voices.voices.filter(voice => 
      voice.labels?.language === 'ja'
    );
    console.log('Japanese voices found:', japaneseVoices.length);
    
  } catch (error) {
    console.error('❌ ElevenLabs API connection failed:', error.message);
    process.exit(1);
  }
}

testElevenLabsConnection();
