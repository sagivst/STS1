import * as deepl from 'deepl-node';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { cacheManager } from '../utils/cache';
import { TranslationResult } from '../types';
import { ServiceError } from '../utils/errors';

export class TranslationService {
  private translator: deepl.Translator;
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours

  constructor() {
    this.translator = new deepl.Translator(config.services.deepl.apiKey);
  }

  async translateText(
    text: string,
    sourceLanguage: 'en' | 'ja',
    targetLanguage: 'en' | 'ja',
    sessionId: string
  ): Promise<TranslationResult> {
    if (sourceLanguage === targetLanguage) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        confidence: 1.0,
        timestamp: Date.now(),
      };
    }

    const cacheKey = `translation:${sourceLanguage}:${targetLanguage}:${this.hashText(text)}`;
    
    try {
      const cachedResult = await cacheManager.get<TranslationResult>(cacheKey);
      if (cachedResult) {
        logger.debug(`Translation cache hit for session ${sessionId}`);
        return {
          ...cachedResult,
          timestamp: Date.now(),
        };
      }

      const startTime = Date.now();
      
      const deeplSourceLang = this.mapLanguageCode(sourceLanguage);
      const deeplTargetLang = this.mapLanguageCode(targetLanguage);

      const result = await this.translator.translateText(
        text,
        deeplSourceLang as deepl.SourceLanguageCode,
        deeplTargetLang as deepl.TargetLanguageCode,
        {
          formality: 'prefer_more', // Business-appropriate tone
          preserveFormatting: true,
        }
      );

      const translationLatency = Date.now() - startTime;
      
      const translationResult: TranslationResult = {
        originalText: text,
        translatedText: result.text,
        sourceLanguage,
        targetLanguage,
        confidence: this.calculateConfidence(result),
        timestamp: Date.now(),
      };

      await cacheManager.set(cacheKey, translationResult, this.CACHE_TTL);

      logger.info(`Translation completed for session ${sessionId}:`, {
        sourceLanguage,
        targetLanguage,
        latency: translationLatency,
        confidence: translationResult.confidence,
        textLength: text.length,
      });

      return translationResult;

    } catch (error) {
      logger.error(`Translation failed for session ${sessionId}:`, {
        error: (error as Error).message,
        sourceLanguage,
        targetLanguage,
        textLength: text.length,
      });

      if (error instanceof deepl.DeepLError) {
        if (error.message.includes('quota')) {
          throw new ServiceError('TRANSLATION_QUOTA_EXCEEDED', 'Translation quota exceeded', 429);
        }
        if (error.message.includes('auth')) {
          throw new ServiceError('TRANSLATION_AUTH_ERROR', 'Translation service authentication failed', 401);
        }
      }

      throw new ServiceError('TRANSLATION_ERROR', `Translation failed: ${(error as Error).message}`, 500);
    }
  }

  private mapLanguageCode(language: 'en' | 'ja'): deepl.SourceLanguageCode | deepl.TargetLanguageCode {
    const languageMap: Record<string, deepl.SourceLanguageCode | deepl.TargetLanguageCode> = {
      'en': 'en' as deepl.SourceLanguageCode,
      'ja': 'ja' as deepl.SourceLanguageCode,
    };
    return languageMap[language];
  }

  private calculateConfidence(result: deepl.TextResult): number {
    let confidence = 0.95; // Base confidence for DeepL

    if (result.text.length < 10) {
      confidence -= 0.1;
    }

    if (result.detectedSourceLang && result.detectedSourceLang !== result.detectedSourceLang) {
      confidence -= 0.05;
    }

    return Math.max(0.7, Math.min(1.0, confidence));
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  async getUsage(): Promise<deepl.Usage> {
    try {
      return await this.translator.getUsage();
    } catch (error) {
      logger.error('Failed to get DeepL usage:', error);
      throw new ServiceError('TRANSLATION_USAGE_ERROR', 'Failed to get translation usage', 500);
    }
  }
}

export const translationService = new TranslationService();
