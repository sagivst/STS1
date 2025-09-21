import { STTService } from '../services/stt';
import { TranslationService } from '../services/translation';
import { TTSService } from '../services/tts';
import { config } from '../config/environment';

describe('Integration Tests', () => {
  let sttService: STTService;
  let translationService: TranslationService;
  let ttsService: TTSService;

  beforeAll(() => {
    sttService = new STTService();
    translationService = new TranslationService();
    ttsService = new TTSService();
  });

  describe('STT Service', () => {
    test('should initialize with Deepgram configuration', () => {
      expect(sttService).toBeDefined();
      expect(sttService.getActiveConnectionCount()).toBe(0);
    });

    test('should handle session management', () => {
      const sessionId = 'test-session-123';
      const mockCallback = jest.fn();
      
      expect(() => {
        sttService.startTranscription(sessionId, mockCallback);
      }).not.toThrow();
      
      expect(sttService.getActiveConnectionCount()).toBe(1);
      
      sttService.stopTranscription(sessionId);
      expect(sttService.getActiveConnectionCount()).toBe(0);
    });
  });

  describe('Translation Service', () => {
    test('should initialize with DeepL configuration', () => {
      expect(translationService).toBeDefined();
    });

    test('should handle language mapping', () => {
      const service = translationService as any;
      expect(service.mapLanguageCode('en')).toBe('en');
      expect(service.mapLanguageCode('ja')).toBe('ja');
    });

    test('should generate consistent cache keys', () => {
      const service = translationService as any;
      const text = 'Hello world';
      const key1 = service.hashText(text + 'en' + 'ja');
      const key2 = service.hashText(text + 'en' + 'ja');
      expect(key1).toBe(key2);
    });
  });

  describe('TTS Service', () => {
    test('should initialize with ElevenLabs configuration', () => {
      expect(ttsService).toBeDefined();
      expect(ttsService.getActiveSynthesisCount()).toBe(0);
    });

    test('should provide voice configuration', () => {
      const voices = ttsService.getAvailableVoices();
      expect(voices).toHaveProperty('japanese');
      expect(voices).toHaveProperty('english');
      expect(voices.japanese.language).toBe('ja');
      expect(voices.english.language).toBe('en');
    });

    test('should handle voice selection', () => {
      const service = ttsService as any;
      const jaVoice = service.selectVoice('ja');
      const enVoice = service.selectVoice('en');
      expect(jaVoice).toBeDefined();
      expect(enVoice).toBeDefined();
      expect(jaVoice).not.toBe(enVoice);
    });

    test('should generate consistent cache keys', () => {
      const service = ttsService as any;
      const key1 = service.generateCacheKey('Hello world', 'en');
      const key2 = service.generateCacheKey('Hello world', 'en');
      expect(key1).toBe(key2);
      expect(key1).toContain('tts:');
    });
  });

  describe('Configuration', () => {
    test('should load environment configuration', () => {
      expect(config.services.deepgram.apiKey).toBeDefined();
      expect(config.services.deepgram.model).toBe('nova-3');
      expect(config.services.deepgram.language).toBe('en');
    });

    test('should have proper service endpoints', () => {
      expect(config.services.deepl.apiUrl).toContain('deepl.com');
      expect(config.services.elevenlabs.apiUrl).toContain('elevenlabs.io');
    });
  });
});
