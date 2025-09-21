export interface TranslationSession {
  id: string;
  userId: string;
  sourceLanguage: 'en' | 'ja';
  targetLanguage: 'en' | 'ja';
  status: SessionStatus;
  createdAt: Date;
  lastActivity: Date;
  metrics: SessionMetrics;
}

export enum SessionStatus {
  INITIALIZING = 'initializing',
  CONNECTING = 'connecting',
  READY = 'ready',
  PROCESSING = 'processing',
  IDLE = 'idle',
  ERROR = 'error',
  TERMINATING = 'terminating',
  TERMINATED = 'terminated',
}

export interface SessionMetrics {
  sttLatency: number[];
  translationLatency: number[];
  ttsLatency: number[];
  endToEndLatency: number[];
  errorCount: number;
  totalRequests: number;
}

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  language: string;
  timestamp: number;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  timestamp: number;
}

export interface TTSResult {
  audioData: Buffer;
  format: string;
  duration: number;
  timestamp: number;
}

export interface WebSocketMessage {
  type: 'audio' | 'transcript' | 'translation' | 'error' | 'status';
  sessionId: string;
  data: any;
  timestamp: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  permissions: string[];
  sessionLimit: number;
}

export interface ServiceConfig {
  deepgram: {
    apiKey: string;
    model: string;
    language: string;
  };
  deepl: {
    apiKey: string;
    apiUrl: string;
  };
  azure: {
    speechKey: string;
    region: string;
    voiceNames: {
      japanese: string;
      english: string;
    };
  };
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface PerformanceMetrics {
  timestamp: number;
  sessionId: string;
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
}
