import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { TTSResult } from '../types';
import { ServiceError } from '../utils/errors';
import { cacheManager } from '../utils/cache';
import { createHash } from 'crypto';

export class TTSService {
  private speechConfig: sdk.SpeechConfig;
  private activeSynthesis = new Map<string, boolean>();

  constructor() {
    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      config.services.azure.speechKey,
      config.services.azure.speechRegion
    );
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
          format: 'wav',
          duration: this.estimateAudioDuration(audioData.length),
          timestamp: Date.now(),
        };
      }

      const voice = this.selectVoice(language);
      this.speechConfig.speechSynthesisVoiceName = voice;
      this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
      
      logger.debug(`Starting TTS synthesis for session ${sessionId}:`, {
        language,
        voice,
        textLength: text.length,
      });

      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
      
      return new Promise((resolve, reject) => {
        synthesizer.speakTextAsync(
          text,
          (result) => {
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              const audioData = Buffer.from(result.audioData);
              
              cacheManager.set(cacheKey, audioData.toString('base64'), 3600);

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

              synthesizer.close();
              resolve(ttsResult);
            } else {
              synthesizer.close();
              reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
            }
          },
          (error) => {
            synthesizer.close();
            reject(error);
          }
        );
      });

    } catch (error) {
      logger.error(`TTS synthesis failed for session ${sessionId}:`, error);
      throw new ServiceError('TTS_ERROR', `TTS synthesis failed: ${(error as Error).message}`, 500);
    } finally {
      this.activeSynthesis.delete(sessionId);
    }
  }

  private selectVoice(language: 'en' | 'ja'): string {
    const voices = {
      ja: 'ja-JP-NanamiNeural',
      en: 'en-US-JennyNeural',
    };
    
    return voices[language];
  }

  private generateCacheKey(text: string, language: string): string {
    const hash = createHash('md5').update(`${text}-${language}-azure`).digest('hex');
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
        voiceId: 'ja-JP-NanamiNeural',
        name: 'Nanami (Japanese Female)',
        language: 'ja',
      },
      english: {
        voiceId: 'en-US-JennyNeural', 
        name: 'Jenny (English Female)',
        language: 'en',
      },
    };
  }

  async getVoiceList() {
    try {
      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
      const result = await synthesizer.getVoicesAsync();
      
      if (result.reason === sdk.ResultReason.VoicesListRetrieved) {
        const voices = result.voices.filter((voice: any) => 
          voice.locale.startsWith('ja-') || voice.locale.startsWith('en-')
        );
        synthesizer.close();
        return voices;
      } else {
        synthesizer.close();
        logger.error('Failed to fetch voice list', { error: result.errorDetails });
        return [];
      }
    } catch (error) {
      logger.error('Failed to fetch voice list', { error });
      return [];
    }
  }
}

export const ttsService = new TTSService();
