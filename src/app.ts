import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, validateConfig } from './config/environment';
import { logger } from './utils/logger';
import { authenticateToken, requirePermission, generateToken } from './middleware/auth';
import { sessionManager } from './services/session';
import { TranslationError } from './utils/errors';

validateConfig();

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
}));

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    if (origin.match(/^https:\/\/.*\.app\.github\.dev$/)) {
      return callback(null, true);
    }
    
    if (origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    activeSessions: sessionManager.getActiveSessionCount(),
  });
});

app.get('/metrics', (req, res) => {
  const metrics = {
    active_sessions: sessionManager.getActiveSessionCount(),
    max_sessions: config.performance.maxConcurrentSessions,
    uptime_seconds: process.uptime(),
    memory_usage: process.memoryUsage(),
    timestamp: Date.now(),
  };
  
  res.json(metrics);
});

app.post('/auth/token', (req, res) => {
  const { userId } = req.body;
  
  const token = generateToken({
    id: userId,
    email: `${userId}@example.com`,
    permissions: ['translate'],
    sessionLimit: config.performance.maxConcurrentSessions,
  });
  
  res.json({ token, expiresIn: config.jwt.expiresIn });
});

app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Request error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  if (error instanceof TranslationError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  });
});

export { app };
