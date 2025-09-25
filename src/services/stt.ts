import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { STTResult, SessionData } from '../types';
import { ServiceError } from '../utils/errors';

export class STTService {
  private deepgram = createClient(config.services.deepgram.apiKey);
  private activeConnections = new Map<string, SessionData>();
  private sessionClients = new Map<string, Set<string>>();

  async startTranscription(sessionId: string, sourceLanguage: string, onTranscript: (result: STTResult) => void, clientId?: string): Promise<void> {
    try {
      let sessionData = this.activeConnections.get(sessionId);
      
      if (!sessionData) {
        if (!this.activeConnections.has(sessionId)) {
          const connection = this.deepgram.listen.live({
            model: config.services.deepgram.model,
            language: sourceLanguage === 'ja' ? 'ja' : 'en-US',
            smart_format: true,
            interim_results: true,
            endpointing: 300,
            utterance_end_ms: 1000,
            keep_alive: true,
          });

          logger.info(`Starting new STT connection for session ${sessionId}:`, {
            sourceLanguage,
            deepgramLanguage: sourceLanguage === 'ja' ? 'ja' : 'en-US',
            model: config.services.deepgram.model
          });

          sessionData = {
            connection,
            callbacks: new Set<(result: STTResult) => void>(),
            sourceLanguage,
            isConnecting: true
          };

          connection.on(LiveTranscriptionEvents.Open, () => {
            logger.info(`STT connection opened for session ${sessionId}`);
            if (sessionData) {
              sessionData.isConnecting = false;
            }
          });

          connection.on(LiveTranscriptionEvents.Transcript, (data) => {
            const transcript = data.channel?.alternatives?.[0];
            if (transcript && transcript.transcript.trim() && sessionData) {
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
                clientCount: sessionData.callbacks.size
              });

              sessionData.callbacks.forEach(callback => {
                try {
                  callback(result);
                } catch (error) {
                  logger.error(`Error in STT callback for session ${sessionId}:`, error);
                }
              });
            }
          });

          connection.on(LiveTranscriptionEvents.Error, (error) => {
            logger.error(`STT error for session ${sessionId}:`, error);
            if (sessionData) {
              sessionData.callbacks.forEach(callback => {
                try {
                  callback({
                    transcript: '',
                    confidence: 0,
                    isFinal: true,
                    language: sourceLanguage === 'ja' ? 'ja' : 'en-US',
                    timestamp: Date.now(),
                    error: error.message
                  } as STTResult);
                } catch (callbackError) {
                  logger.error(`Error in STT error callback for session ${sessionId}:`, callbackError);
                }
              });
            }
          });

          connection.on(LiveTranscriptionEvents.Close, () => {
            logger.info(`STT connection closed for session ${sessionId}`);
            this.activeConnections.delete(sessionId);
            this.sessionClients.delete(sessionId);
          });

          this.activeConnections.set(sessionId, sessionData);
          this.sessionClients.set(sessionId, new Set());
        } else {
          sessionData = this.activeConnections.get(sessionId);
        }
      }

      if (sessionData) {
        if (sessionData.isConnecting) {
          await new Promise<void>((resolve) => {
            const checkConnection = () => {
              const currentData = this.activeConnections.get(sessionId);
              if (currentData && !currentData.isConnecting) {
                resolve();
              } else {
                setTimeout(checkConnection, 100);
              }
            };
            checkConnection();
          });
        }

        sessionData.callbacks.add(onTranscript);
        
        if (clientId) {
          const clients = this.sessionClients.get(sessionId);
          clients?.add(clientId);
          logger.info(`Client ${clientId} joined session ${sessionId}. Total clients: ${clients?.size || 0}`);
        }
      }
      
    } catch (error) {
      logger.error(`Failed to start STT for session ${sessionId}:`, error);
      throw new ServiceError('STT_INIT_ERROR', 'Failed to initialize speech recognition', 500);
    }
  }

  sendAudio(sessionId: string, audioData: Buffer): void {
    const sessionData = this.activeConnections.get(sessionId);
    if (!sessionData) {
      logger.error(`No active STT connection for session ${sessionId}. Active sessions: ${Array.from(this.activeConnections.keys()).join(', ')}`);
      return;
    }

    const connection = sessionData.connection;
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
      this.sessionClients.delete(sessionId);
    }
  }

  stopTranscription(sessionId: string, clientId?: string): void {
    const sessionData = this.activeConnections.get(sessionId);
    if (!sessionData) {
      logger.warn(`No active STT connection to stop for session ${sessionId}. Active sessions: ${Array.from(this.activeConnections.keys()).join(', ')}`);
      return;
    }

    if (clientId) {
      const clients = this.sessionClients.get(sessionId);
      if (clients) {
        clients.delete(clientId);
        logger.info(`Client ${clientId} left session ${sessionId}. Remaining clients: ${clients.size}`);
        
        if (clients.size > 0) {
          logger.info(`Keeping STT connection alive for session ${sessionId} - ${clients.size} clients still connected`);
          return;
        }
      }
    }

    try {
      sessionData.connection.finish();
      this.activeConnections.delete(sessionId);
      this.sessionClients.delete(sessionId);
      logger.info(`STT stopped for session ${sessionId} - no clients remaining`);
    } catch (error) {
      logger.error(`Error stopping STT for session ${sessionId}:`, error);
    }
  }

  removeClientCallback(sessionId: string, callback: (result: STTResult) => void, clientId?: string): void {
    const sessionData = this.activeConnections.get(sessionId);
    if (sessionData) {
      sessionData.callbacks.delete(callback);
      
      if (clientId) {
        const clients = this.sessionClients.get(sessionId);
        if (clients) {
          clients.delete(clientId);
          logger.info(`Removed callback for client ${clientId} from session ${sessionId}. Remaining clients: ${clients.size}`);
          
          if (clients.size === 0 && sessionData.callbacks.size === 0) {
            this.stopTranscription(sessionId);
          }
        }
      }
    }
  }

  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }
}

export const sttService = new STTService();
