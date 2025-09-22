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
  res.sendFile(path.join(__dirname, '../public/simple-demo.html'));
});

app.get('/health', optionalAuthentication, (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    activeSessions: sessionManager.getActiveSessionCount(),
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
      'Content-Type': 'audio/mpeg',
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

async function processAudioToText(audioBuffer: Buffer, language: string, sessionId: string): Promise<{ transcript: string; confidence: number }> {
  return new Promise((resolve, reject) => {
    let finalTranscript = '';
    let finalConfidence = 0;

    sttService.startTranscription(sessionId, (result) => {
      if (result.isFinal && result.transcript.trim()) {
        finalTranscript = result.transcript;
        finalConfidence = result.confidence;
        sttService.stopTranscription(sessionId);
        resolve({ transcript: finalTranscript, confidence: finalConfidence });
      }
    }).then(() => {
      sttService.sendAudio(sessionId, audioBuffer);
    }).catch(reject);

    setTimeout(() => {
      if (!finalTranscript) {
        sttService.stopTranscription(sessionId);
        reject(new Error('STT timeout - no transcript received'));
      }
    }, 10000); // 10 second timeout
  });
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
