import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { app } from './app';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { cacheManager } from './utils/cache';

class TranslationServer {
  private server = createServer(app);
  private wss = new WebSocketServer({ server: this.server });

  constructor() {
    this.setupWebSocketServer();
    this.setupGracefulShutdown();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('WebSocket connection established');
      
      ws.on('message', (data: Buffer) => {
        logger.debug('Received WebSocket message', { size: data.length });
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });

    logger.info('WebSocket server initialized');
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
