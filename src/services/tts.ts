import { ElevenLabsClient } from 'elevenlabs';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { TTSResult } from '../types';
import { ServiceError } from '../utils/errors';
import { cacheManager } from '../utils/cache';
import { createHash } from 'crypto';

export class TTSService {
  private client: ElevenLabsClient;
  private activeSynthesis = new Map<string, boolean>();

  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: config.services.elevenlabs.apiKey,
    });
  }

  async synthesizeSpeech(
    text: string,
    language: 'en' | 'ja',
    sessionId: string
  ): Promise<TTSResult> {
    const startTime = Date.now();
    
    try {
      this.activeSynthesis.set(sessionId, true);
      
      const cacheKey = this.generateCacheKey(text, language);
      
      const cachedAudio = await cacheManager.get(cacheKey);
      if (cachedAudio) {
        logger.info(`TTS cache hit for session ${sessionId}:`, { language, textLength: text.length });
        const audioData = Buffer.from(cachedAudio as string, 'base64');
        return {
          audioData,
          format: 'mp3',
          duration: this.estimateAudioDuration(audioData.length),
          timestamp: Date.now(),
        };
      }

      const voiceId = this.selectVoice(language);
      
      logger.debug(`Starting TTS synthesis for session ${sessionId}:`, {
        language,
        voiceId,
        textLength: text.length,
      });

      const audioStream = await this.client.textToSpeech.convert(voiceId, {
        text,
        model_id: config.services.elevenlabs.model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
        optimize_streaming_latency: config.services.elevenlabs.latencyOptimization,
        output_format: 'mp3_44100_128',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const audioData = Buffer.concat(chunks);

      await cacheManager.set(cacheKey, audioData.toString('base64'), 3600);

      const latency = Date.now() - startTime;
      const ttsResult: TTSResult = {
        audioData,
        format: 'mp3',
        duration: this.estimateAudioDuration(audioData.length),
        timestamp: Date.now(),
      };

      logger.info(`TTS synthesis completed for session ${sessionId}:`, {
        language,
        latency,
        audioSize: audioData.length,
        duration: ttsResult.duration,
      });

      return ttsResult;

    } catch (error) {
      logger.error(`TTS synthesis failed for session ${sessionId}:`, error);
      throw new ServiceError('TTS_ERROR', `TTS synthesis failed: ${(error as Error).message}`, 500);
    } finally {
      this.activeSynthesis.delete(sessionId);
    }
  }

  private selectVoice(language: 'en' | 'ja'): string {
    const voices = {
      ja: 'Xb7hH8MSUJpSbSDYk0k2',
      en: 'EXAVITQu4vr4xnSDxMaL',
    };
    
    return voices[language];
  }

  private generateCacheKey(text: string, language: string): string {
    const hash = createHash('md5').update(`${text}-${language}-elevenlabs`).digest('hex');
    return `tts:${hash}`;
  }

  private estimateAudioDuration(audioSizeBytes: number): number {
    const bitrate = 4000; // bytes per second for 32kbps MP3
    return Math.round((audioSizeBytes / bitrate) * 1000); // return in milliseconds
  }

  cancelSynthesis(sessionId: string): void {
    if (this.activeSynthesis.has(sessionId)) {
      this.activeSynthesis.delete(sessionId);
      logger.info(`TTS synthesis cancelled for session ${sessionId}`);
    }
  }

  getActiveSynthesisCount(): number {
    return this.activeSynthesis.size;
  }

  getAvailableVoices() {
    return {
      japanese: {
        voiceId: 'Xb7hH8MSUJpSbSDYk0k2',
        name: 'Japanese Female',
        language: 'ja',
      },
      english: {
        voiceId: 'EXAVITQu4vr4xnSDxMaL', 
        name: 'Sarah',
        language: 'en',
      },
    };
  }

  async getVoiceList() {
    try {
      const voices = await this.client.voices.getAll();
      return voices.voices.filter((voice: any) => 
        voice.labels?.language === 'ja' || voice.labels?.language === 'en'
      );
    } catch (error) {
      logger.error('Failed to fetch voice list', { error });
      return [];
    }
  }
}

export const ttsService = new TTSService();
