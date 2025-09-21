import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { STTResult } from '../types';
import { ServiceError } from '../utils/errors';

export class STTService {
  private deepgram = createClient(config.services.deepgram.apiKey);
  private activeConnections = new Map<string, any>();

  async startTranscription(sessionId: string, onTranscript: (result: STTResult) => void): Promise<void> {
    try {
      const connection = this.deepgram.listen.live({
        model: config.services.deepgram.model,
        language: config.services.deepgram.language,
        smart_format: true,
        interim_results: true,
        endpointing: 300,
        utterance_end_ms: 1000,
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        logger.info(`STT connection opened for session ${sessionId}`);
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0];
        if (transcript && transcript.transcript.trim()) {
          const result: STTResult = {
            transcript: transcript.transcript,
            confidence: transcript.confidence || 0,
            isFinal: data.is_final || false,
            language: config.services.deepgram.language,
            timestamp: Date.now(),
          };

          logger.debug(`STT result for session ${sessionId}:`, {
            transcript: result.transcript,
            confidence: result.confidence,
            isFinal: result.isFinal,
          });

          onTranscript(result);
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        logger.error(`STT error for session ${sessionId}:`, error);
        throw new ServiceError('STT_ERROR', `Speech recognition failed: ${error.message}`, 500);
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        logger.info(`STT connection closed for session ${sessionId}`);
        this.activeConnections.delete(sessionId);
      });

      this.activeConnections.set(sessionId, connection);
      
    } catch (error) {
      logger.error(`Failed to start STT for session ${sessionId}:`, error);
      throw new ServiceError('STT_INIT_ERROR', 'Failed to initialize speech recognition', 500);
    }
  }

  sendAudio(sessionId: string, audioData: Buffer): void {
    const connection = this.activeConnections.get(sessionId);
    if (!connection) {
      throw new ServiceError('STT_NO_CONNECTION', 'No active STT connection for session', 400);
    }

    try {
      connection.send(audioData);
    } catch (error) {
      logger.error(`Failed to send audio for session ${sessionId}:`, error);
      throw new ServiceError('STT_SEND_ERROR', 'Failed to send audio data', 500);
    }
  }

  stopTranscription(sessionId: string): void {
    const connection = this.activeConnections.get(sessionId);
    if (connection) {
      try {
        connection.finish();
        this.activeConnections.delete(sessionId);
        logger.info(`STT stopped for session ${sessionId}`);
      } catch (error) {
        logger.error(`Error stopping STT for session ${sessionId}:`, error);
      }
    }
  }

  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }
}

export const sttService = new STTService();
