import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { TTSResult } from '../types';
import { ServiceError } from '../utils/errors';

export class TTSService {
  private speechConfig: sdk.SpeechConfig;
  private activeSynthesizers = new Map<string, sdk.SpeechSynthesizer>();

  constructor() {
    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      config.services.azure.speechKey,
      config.services.azure.region
    );
    
    this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
  }

  async synthesizeSpeech(
    text: string,
    language: 'en' | 'ja',
    sessionId: string
  ): Promise<TTSResult> {
    const startTime = Date.now();
    
    try {
      const voiceName = this.getVoiceName(language);
      const ssml = this.createSSML(text, voiceName);
      
      logger.debug(`Starting TTS synthesis for session ${sessionId}:`, {
        language,
        voiceName,
        textLength: text.length,
      });

      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
      this.activeSynthesizers.set(sessionId, synthesizer);

      return new Promise((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            const latency = Date.now() - startTime;
            
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              const audioData = Buffer.from(result.audioData);
              
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

              this.activeSynthesizers.delete(sessionId);
              synthesizer.close();
              resolve(ttsResult);
              
            } else if (result.reason === sdk.ResultReason.Canceled) {
              const cancellation = sdk.CancellationDetails.fromResult(result);
              logger.error(`TTS synthesis cancelled for session ${sessionId}:`, {
                reason: cancellation.reason,
                errorDetails: cancellation.errorDetails,
              });
              
              this.activeSynthesizers.delete(sessionId);
              synthesizer.close();
              
              if (cancellation.reason === sdk.CancellationReason.Error) {
                reject(new ServiceError('TTS_ERROR', `TTS synthesis failed: ${cancellation.errorDetails}`, 500));
              } else {
                reject(new ServiceError('TTS_CANCELLED', 'TTS synthesis was cancelled', 400));
              }
            }
          },
          (error) => {
            logger.error(`TTS synthesis error for session ${sessionId}:`, error);
            this.activeSynthesizers.delete(sessionId);
            synthesizer.close();
            reject(new ServiceError('TTS_ERROR', `TTS synthesis failed: ${error}`, 500));
          }
        );
      });

    } catch (error) {
      logger.error(`TTS initialization failed for session ${sessionId}:`, error);
      throw new ServiceError('TTS_INIT_ERROR', `Failed to initialize TTS: ${(error as Error).message}`, 500);
    }
  }

  private getVoiceName(language: 'en' | 'ja'): string {
    return language === 'ja' 
      ? config.services.azure.voiceNames.japanese
      : config.services.azure.voiceNames.english;
  }

  private createSSML(text: string, voiceName: string): string {
    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voiceName.startsWith('ja') ? 'ja-JP' : 'en-US'}">
        <voice name="${voiceName}">
          <prosody rate="0.9" pitch="+2%">
            ${this.escapeXml(text)}
          </prosody>
        </voice>
      </speak>
    `.trim();
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private estimateAudioDuration(audioSizeBytes: number): number {
    const bitrate = 4000; // bytes per second for 32kbps MP3
    return Math.round((audioSizeBytes / bitrate) * 1000); // return in milliseconds
  }

  cancelSynthesis(sessionId: string): void {
    const synthesizer = this.activeSynthesizers.get(sessionId);
    if (synthesizer) {
      try {
        synthesizer.close();
        this.activeSynthesizers.delete(sessionId);
        logger.info(`TTS synthesis cancelled for session ${sessionId}`);
      } catch (error) {
        logger.error(`Error cancelling TTS for session ${sessionId}:`, error);
      }
    }
  }

  getActiveSynthesisCount(): number {
    return this.activeSynthesizers.size;
  }

  getAvailableVoices(): { japanese: string; english: string } {
    return {
      japanese: config.services.azure.voiceNames.japanese,
      english: config.services.azure.voiceNames.english,
    };
  }
}

export const ttsService = new TTSService();
