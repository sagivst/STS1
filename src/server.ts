import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { app } from './app';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { cacheManager } from './utils/cache';
import { sttService } from './services/stt';
import { translationService } from './services/translation';
import { ttsService } from './services/tts';

class TranslationServer {
  private server = createServer(app);
  private wss = new WebSocketServer({ server: this.server });

  constructor() {
    this.setupWebSocketServer();
    this.setupGracefulShutdown();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      logger.info(`WebSocket connection established with ID ${connectionId}`);
      
      let isStreamingActive = false;
      let sourceLanguage = 'en';
      let targetLanguage = 'ja';
      let currentSessionId: string | null = null;

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          logger.debug(`WebSocket message received for connection ${connectionId}:`, message);
          
          if (message.type === 'start_streaming') {
            isStreamingActive = true;
            sourceLanguage = message.data.sourceLanguage;
            targetLanguage = message.data.targetLanguage;
            currentSessionId = message.sessionId; // Use the sessionId from frontend
            
            logger.info(`Starting streaming translation for session ${currentSessionId}: ${sourceLanguage} → ${targetLanguage}`);
            
            try {
              await sttService.startTranscription(currentSessionId!, sourceLanguage, (sttResult) => {
                logger.debug(`STT result for session ${currentSessionId}: "${sttResult.transcript}" (final: ${sttResult.isFinal})`);
                
                ws.send(JSON.stringify({
                  type: 'transcript',
                  sessionId: currentSessionId,
                  data: sttResult,
                  timestamp: Date.now()
                }));
                
                if (sttResult.isFinal && sttResult.transcript.trim()) {
                  this.handleStreamingTranslation(ws, sttResult, sourceLanguage, targetLanguage, currentSessionId!);
                }
              });
            } catch (error) {
              logger.error(`Failed to start STT for session ${currentSessionId}:`, error);
              ws.send(JSON.stringify({
                type: 'error',
                sessionId: currentSessionId,
                data: { message: `STT connection failed: ${(error as Error).message}` },
                timestamp: Date.now()
              }));
            }
            
          } else if (message.type === 'audio_chunk' && isStreamingActive && currentSessionId) {
            try {
              const audioBuffer = Buffer.from(message.data.audioData, 'base64');
              logger.debug(`Sending audio chunk for session ${currentSessionId}: ${audioBuffer.length} bytes`);
              sttService.sendAudio(currentSessionId, audioBuffer);
            } catch (error) {
              logger.error(`Error processing audio chunk for session ${currentSessionId}:`, error);
              ws.send(JSON.stringify({
                type: 'error',
                sessionId: currentSessionId,
                data: { message: `Audio processing error: ${(error as Error).message}` },
                timestamp: Date.now()
              }));
            }
            
          } else if (message.type === 'stop_streaming' && currentSessionId) {
            isStreamingActive = false;
            sttService.stopTranscription(currentSessionId);
            logger.info(`Stopped streaming translation for session ${currentSessionId}`);
            
            ws.send(JSON.stringify({
              type: 'streaming_stopped',
              sessionId: currentSessionId,
              timestamp: Date.now()
            }));
            
            currentSessionId = null;
          }
          
        } catch (error) {
          logger.error(`WebSocket message error for connection ${connectionId}:`, error);
          ws.send(JSON.stringify({
            type: 'error',
            sessionId: currentSessionId || connectionId,
            data: { message: (error as Error).message },
            timestamp: Date.now()
          }));
        }
      });

      ws.on('close', () => {
        if (isStreamingActive && currentSessionId) {
          sttService.stopTranscription(currentSessionId);
        }
        logger.info(`WebSocket connection closed for connection ${connectionId}`);
      });

      ws.on('error', (error) => {
        if (isStreamingActive && currentSessionId) {
          sttService.stopTranscription(currentSessionId);
        }
        logger.error(`WebSocket error for connection ${connectionId}:`, error);
      });
    });

    logger.info('WebSocket server initialized');
  }

  private async handleStreamingTranslation(ws: WebSocket, sttResult: any, sourceLanguage: string, targetLanguage: string, sessionId: string) {
    try {
      logger.info(`Processing streaming translation for session ${sessionId}: "${sttResult.transcript}" (${sourceLanguage} → ${targetLanguage})`);
      
      const translationResult = await translationService.translateText(
        sttResult.transcript,
        sourceLanguage as 'en' | 'ja',
        targetLanguage as 'en' | 'ja',
        sessionId
      );
      
      logger.info(`Translation completed for session ${sessionId}: "${translationResult.translatedText}"`);
      
      ws.send(JSON.stringify({
        type: 'translation',
        sessionId,
        data: translationResult,
        timestamp: Date.now()
      }));
      
      const ttsResult = await ttsService.synthesizeSpeech(
        translationResult.translatedText,
        targetLanguage as 'en' | 'ja',
        sessionId
      );
      
      logger.info(`TTS completed for session ${sessionId}: ${ttsResult.audioData.length} bytes, format: ${ttsResult.format}`);
      
      ws.send(JSON.stringify({
        type: 'audio',
        sessionId,
        data: {
          audioData: ttsResult.audioData.toString('base64'),
          format: ttsResult.format
        },
        timestamp: Date.now()
      }));
      
    } catch (error) {
      logger.error(`Streaming translation error for session ${sessionId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        sessionId,
        data: { message: (error as Error).message },
        timestamp: Date.now()
      }));
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });
      
      this.server.close(async () => {
        logger.info('HTTP server closed');
        await cacheManager.disconnect();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
      
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async start(): Promise<void> {
    try {
      await cacheManager.connect();
      logger.info('Connected to Redis');

      this.server.listen(config.port, () => {
        logger.info(`Server started on port ${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`Max concurrent sessions: ${config.performance.maxConcurrentSessions}`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const server = new TranslationServer();
  server.start().catch(error => {
    logger.error('Server startup failed:', error);
    process.exit(1);
  });
}

export { TranslationServer };
