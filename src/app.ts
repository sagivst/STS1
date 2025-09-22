import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import multer from 'multer';
import { config, validateConfig } from './config/environment';
import { logger } from './utils/logger';
import { authenticateToken, requirePermission, generateToken, optionalAuthentication } from './middleware/auth';
import { sessionManager } from './services/session';
import { sttService } from './services/stt';
import { translationService } from './services/translation';
import { ttsService } from './services/tts';
import { TranslationError } from './utils/errors';

validateConfig();

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "wss:", "ws:"],
      imgSrc: ["'self'", "data:", "https:"],
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
    
    if (origin.match(/^https:\/\/.*\.devinapps\.com$/)) {
      return callback(null, true);
    }
    
    if (origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
      return callback(null, true);
    }
    
    callback(null, true); // Allow all origins for demo purposes
  },
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/demo', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff'
  });
  res.sendFile(path.join(__dirname, '../public/simple-demo.html'));
});

app.get('/mobile-demo', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Mobile-Demo': 'true',
    'X-Bypass-Auth': 'mobile-demo'
  });
  
  logger.info('Mobile demo access:', {
    userAgent: req.headers['user-agent'],
    origin: req.headers['origin'],
    host: req.headers['host'],
    ip: req.ip,
    isMobile: /Mobile|Android|iPhone|iPad/.test(req.headers['user-agent'] || '')
  });
  
  res.sendFile(path.join(__dirname, '../public/simple-demo.html'));
});

app.get('/public-demo', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'false',
    'X-Public-Demo': 'true',
    'X-Bypass-Auth': 'public-demo',
    'X-Mobile-Friendly': 'true'
  });
  
  logger.info('Public demo access:', {
    userAgent: req.headers['user-agent'],
    origin: req.headers['origin'],
    host: req.headers['host'],
    ip: req.ip,
    isMobile: /Mobile|Android|iPhone|iPad/.test(req.headers['user-agent'] || '')
  });
  
  res.sendFile(path.join(__dirname, '../public/simple-demo.html'));
});

app.options('/public-demo', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'false'
  });
  res.status(200).end();
});

app.get('/no-auth-demo', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'false',
    'X-No-Auth': 'true',
    'X-Mobile-Access': 'enabled',
    'X-Mobile-Bypass': 'true',
    'X-Tunnel-Auth': 'bypass',
    'X-Skip-Auth': 'true',
    'Authorization': 'Bearer bypass-token'
  });
  
  logger.info('No-auth demo access:', {
    userAgent: req.headers['user-agent'],
    origin: req.headers['origin'],
    host: req.headers['host'],
    ip: req.ip,
    isMobile: /Mobile|Android|iPhone|iPad/.test(req.headers['user-agent'] || '')
  });
  
  res.sendFile(path.join(__dirname, '../public/simple-demo.html'));
});

app.get('/health', optionalAuthentication, async (req, res) => {
  const healthChecks = await performHealthChecks();
  
  res.json({
    status: healthChecks.overall,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    activeSessions: sessionManager.getActiveSessionCount(),
    services: healthChecks.services,
  });
});

app.get('/metrics', optionalAuthentication, (req, res) => {
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

app.post('/api/stt', optionalAuthentication, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { sourceLanguage } = req.body;
    const sessionId = `demo-${Date.now()}`;
    
    logger.info(`STT request for session ${sessionId}:`, {
      language: sourceLanguage,
      audioSize: req.file.size,
    });

    const audioBuffer = req.file.buffer;
    const transcript = await processAudioToText(audioBuffer, sourceLanguage, sessionId);
    
    return res.json({
      transcript: transcript.transcript,
      confidence: transcript.confidence,
      language: sourceLanguage,
      timestamp: Date.now(),
    });

  } catch (error) {
    logger.error('STT API error:', error);
    return res.status(500).json({ 
      error: 'Speech recognition failed',
      message: (error as Error).message 
    });
  }
});

app.post('/api/translate', optionalAuthentication, async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body;
    
    if (!text || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ error: 'Missing required fields: text, sourceLanguage, targetLanguage' });
    }

    const sessionId = `demo-${Date.now()}`;
    
    logger.info(`Translation request for session ${sessionId}:`, {
      sourceLanguage,
      targetLanguage,
      textLength: text.length,
    });

    const result = await translationService.translateText(
      text,
      sourceLanguage as 'en' | 'ja',
      targetLanguage as 'en' | 'ja',
      sessionId
    );
    
    return res.json({
      originalText: result.originalText,
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLanguage,
      targetLanguage: result.targetLanguage,
      confidence: result.confidence,
      timestamp: Date.now(),
    });

  } catch (error) {
    logger.error('Translation API error:', error);
    return res.status(500).json({ 
      error: 'Translation failed',
      message: (error as Error).message 
    });
  }
});

app.post('/api/tts', optionalAuthentication, async (req, res) => {
  try {
    const { text, language, voice } = req.body;
    
    if (!text || !language) {
      return res.status(400).json({ error: 'Missing required fields: text, language' });
    }

    const sessionId = `demo-${Date.now()}`;
    
    logger.info(`TTS request for session ${sessionId}:`, {
      language,
      voice,
      textLength: text.length,
    });

    const result = await ttsService.synthesizeSpeech(
      text,
      language as 'en' | 'ja',
      sessionId
    );
    
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': result.audioData.length.toString(),
    });
    
    return res.send(result.audioData);

  } catch (error) {
    logger.error('TTS API error:', error);
    return res.status(500).json({ 
      error: 'Text-to-speech failed',
      message: (error as Error).message 
    });
  }
});

async function performHealthChecks(): Promise<{ overall: string; services: any }> {
  const services = {
    deepgram: { status: 'unknown', latency: 0, error: null as string | null },
    deepl: { status: 'unknown', latency: 0, error: null as string | null },
    azure: { status: 'unknown', latency: 0, error: null as string | null },
  };

  try {
    const start = Date.now();
    const { createClient } = require('@deepgram/sdk');
    const deepgram = createClient(config.services.deepgram.apiKey);
    
    const testBuffer = Buffer.alloc(1024);
    await deepgram.listen.prerecorded.transcribeFile(testBuffer, { 
      model: 'nova-2',
      language: 'en-US'
    });
    
    services.deepgram.status = 'healthy';
    services.deepgram.latency = Date.now() - start;
  } catch (error) {
    services.deepgram.status = 'unhealthy';
    services.deepgram.error = (error as Error).message;
  }

  try {
    const start = Date.now();
    const uniqueText = `health-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await translationService.translateText(uniqueText, 'en', 'ja', 'health-check');
    services.deepl.status = 'healthy';
    services.deepl.latency = Date.now() - start;
  } catch (error) {
    services.deepl.status = 'unhealthy';
    services.deepl.error = (error as Error).message;
  }

  try {
    const start = Date.now();
    const uniqueText = `health-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await ttsService.synthesizeSpeech(uniqueText, 'en', 'health-check');
    services.azure.status = 'healthy';
    services.azure.latency = Date.now() - start;
  } catch (error) {
    services.azure.status = 'unhealthy';
    services.azure.error = (error as Error).message;
  }

  const allHealthy = Object.values(services).every(service => service.status === 'healthy');
  const overall = allHealthy ? 'healthy' : 'degraded';

  return { overall, services };
}

async function processAudioToText(audioBuffer: Buffer, language: string, sessionId: string): Promise<{ transcript: string; confidence: number }> {
  try {
    const { createClient } = require('@deepgram/sdk');
    const deepgram = createClient(config.services.deepgram.apiKey);
    
    logger.info(`Processing audio file for session ${sessionId}`, {
      audioSize: audioBuffer.length,
      language: language
    });
    
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        language: language === 'ja' ? 'ja' : 'en-US',
        smart_format: true,
        punctuate: true,
        diarize: false,
      }
    );
    
    if (error) {
      throw new Error(`Deepgram error: ${error.message}`);
    }
    
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0];
    if (!transcript || !transcript.transcript.trim()) {
      throw new Error('No transcript received from Deepgram');
    }
    
    return {
      transcript: transcript.transcript,
      confidence: transcript.confidence || 0.95
    };
    
  } catch (error) {
    logger.error(`STT processing failed for session ${sessionId}:`, error);
    throw new Error(`Speech recognition failed: ${(error as Error).message}`);
  }
}

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
