import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { STTResult } from '../types';
import { ServiceError } from '../utils/errors';

export class STTService {
  private deepgram = createClient(config.services.deepgram.apiKey);
  private activeConnections = new Map<string, any>();

  async startTranscription(sessionId: string, sourceLanguage: string, onTranscript: (result: STTResult) => void): Promise<void> {
    try {
      if (this.activeConnections.has(sessionId)) {
        logger.warn(`Cleaning up existing STT connection for session ${sessionId}`);
        this.stopTranscription(sessionId);
      }
      const connection = this.deepgram.listen.live({
        model: config.services.deepgram.model,
        language: sourceLanguage === 'ja' ? 'ja' : 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 300,
        utterance_end_ms: 1000,
        keep_alive: true,
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
            language: sourceLanguage === 'ja' ? 'ja' : 'en-US',
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
        this.activeConnections.delete(sessionId);
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        logger.info(`STT connection closed for session ${sessionId}`);
        this.activeConnections.delete(sessionId);
      });

      this.activeConnections.set(sessionId, connection);
      
    } catch (error) {
      logger.error(`Failed to start STT for session ${sessionId}:`, error);
      this.activeConnections.delete(sessionId);
      throw new ServiceError('STT_INIT_ERROR', 'Failed to initialize speech recognition', 500);
    }
  }

  sendAudio(sessionId: string, audioData: Buffer): void {
    const connection = this.activeConnections.get(sessionId);
    if (!connection) {
      logger.error(`No active STT connection for session ${sessionId}. Active sessions: ${Array.from(this.activeConnections.keys()).join(', ')}`);
      return;
    }

    try {
      if (connection.getReadyState && connection.getReadyState() === 1) {
        connection.send(audioData);
        logger.debug(`Sent ${audioData.length} bytes to STT for session ${sessionId}`);
      } else {
        logger.warn(`STT connection not ready for session ${sessionId}, state: ${connection.getReadyState ? connection.getReadyState() : 'unknown'}`);
      }
    } catch (error) {
      logger.error(`Failed to send audio for session ${sessionId}:`, error);
      this.activeConnections.delete(sessionId);
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
    } else {
      logger.warn(`No active STT connection to stop for session ${sessionId}. Active sessions: ${Array.from(this.activeConnections.keys()).join(', ')}`);
    }
  }

  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }
}

export const sttService = new STTService();
