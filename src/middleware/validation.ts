import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface CreateSessionRequest {
  sourceLanguage: 'en' | 'ja';
  targetLanguage: 'en' | 'ja';
}

export interface AudioDataRequest {
  sessionId: string;
  audioData: string; // base64 encoded audio
  format?: string;
}

export function validateCreateSession(req: Request, res: Response, next: NextFunction): void {
  const { sourceLanguage, targetLanguage } = req.body as CreateSessionRequest;

  if (!sourceLanguage || !targetLanguage) {
    logger.warn('Session creation validation failed: Missing language parameters');
    throw new ValidationError('Source and target languages are required');
  }

  if (!['en', 'ja'].includes(sourceLanguage) || !['en', 'ja'].includes(targetLanguage)) {
    logger.warn('Session creation validation failed: Invalid language codes', {
      sourceLanguage,
      targetLanguage,
    });
    throw new ValidationError('Language must be either "en" or "ja"');
  }

  if (sourceLanguage === targetLanguage) {
    logger.warn('Session creation validation failed: Same source and target language');
    throw new ValidationError('Source and target languages must be different');
  }

  next();
}

export function validateAudioData(req: Request, res: Response, next: NextFunction): void {
  const { sessionId, audioData } = req.body as AudioDataRequest;

  if (!sessionId) {
    logger.warn('Audio data validation failed: Missing session ID');
    throw new ValidationError('Session ID is required');
  }

  if (!audioData) {
    logger.warn('Audio data validation failed: Missing audio data');
    throw new ValidationError('Audio data is required');
  }

  try {
    Buffer.from(audioData, 'base64');
  } catch (error) {
    logger.warn('Audio data validation failed: Invalid base64 format');
    throw new ValidationError('Audio data must be valid base64 encoded');
  }

  next();
}

export function validateSessionId(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.params.sessionId || req.body.sessionId;

  if (!sessionId) {
    logger.warn('Session ID validation failed: Missing session ID');
    throw new ValidationError('Session ID is required');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    logger.warn('Session ID validation failed: Invalid UUID format', { sessionId });
    throw new ValidationError('Session ID must be a valid UUID');
  }

  next();
}

export function validateLanguageCode(req: Request, res: Response, next: NextFunction): void {
  const { language } = req.params;

  if (language && !['en', 'ja'].includes(language)) {
    logger.warn('Language validation failed: Invalid language code', { language });
    throw new ValidationError('Language must be either "en" or "ja"');
  }

  next();
}
