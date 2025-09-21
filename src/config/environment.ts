import dotenv from 'dotenv';
import { ServiceConfig } from '../types';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  services: {
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY || '',
      model: 'nova-3',
      language: 'en',
    },
    deepl: {
      apiKey: process.env.DEEPL_API_KEY || '',
      apiUrl: process.env.DEEPL_API_URL || 'https://api-free.deepl.com',
    },
    azure: {
      speechKey: process.env.AZURE_SPEECH_KEY || '',
      region: process.env.AZURE_SPEECH_REGION || '',
      voiceNames: {
        japanese: 'ja-JP-NanamiNeural',
        english: 'en-US-JennyNeural',
      },
    },
  } as ServiceConfig,

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  performance: {
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '50', 10),
    sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '3600000', 10),
    translationCacheTtl: parseInt(process.env.TRANSLATION_CACHE_TTL || '3600', 10),
  },

  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
  },
};

export function validateConfig(): void {
  const required = [
    'DEEPGRAM_API_KEY',
    'DEEPL_API_KEY',
    'AZURE_SPEECH_KEY',
    'AZURE_SPEECH_REGION',
    'JWT_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
