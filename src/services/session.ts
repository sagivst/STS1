import { v4 as uuidv4 } from 'uuid';
import { TranslationSession, SessionStatus, SessionMetrics, AuthenticatedUser } from '../types';
import { cacheManager } from '../utils/cache';
import { logger } from '../utils/logger';
import { SessionError } from '../utils/errors';
import { config } from '../config/environment';

export class SessionManager {
  private activeSessions: Map<string, TranslationSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  async createSession(
    user: AuthenticatedUser,
    sourceLanguage: 'en' | 'ja',
    targetLanguage: 'en' | 'ja'
  ): Promise<TranslationSession> {
    const userSessionCount = this.getUserSessionCount(user.id);
    if (userSessionCount >= user.sessionLimit) {
      throw new SessionError(`User session limit exceeded: ${user.sessionLimit}`);
    }

    if (this.activeSessions.size >= config.performance.maxConcurrentSessions) {
      throw new SessionError(`Maximum concurrent sessions reached: ${config.performance.maxConcurrentSessions}`);
    }

    const sessionId = uuidv4();
    const session: TranslationSession = {
      id: sessionId,
      userId: user.id,
      sourceLanguage,
      targetLanguage,
      status: SessionStatus.INITIALIZING,
      createdAt: new Date(),
      lastActivity: new Date(),
      metrics: {
        sttLatency: [],
        translationLatency: [],
        ttsLatency: [],
        endToEndLatency: [],
        errorCount: 0,
        totalRequests: 0,
      },
    };

    this.activeSessions.set(sessionId, session);
    
    if (!this.userSessions.has(user.id)) {
      this.userSessions.set(user.id, new Set());
    }
    this.userSessions.get(user.id)!.add(sessionId);

    await cacheManager.set(`session:${sessionId}`, session, config.performance.sessionTimeoutMs / 1000);

    logger.info(`Session created: ${sessionId} for user ${user.id}`, {
      sourceLanguage,
      targetLanguage,
      totalActiveSessions: this.activeSessions.size,
    });

    return session;
  }

  async getSession(sessionId: string): Promise<TranslationSession | null> {
    let session = this.activeSessions.get(sessionId);
    
    if (!session) {
      session = await cacheManager.get<TranslationSession>(`session:${sessionId}`);
      if (session) {
        this.activeSessions.set(sessionId, session);
      }
    }

    return session || null;
  }

  getUserSessionCount(userId: string): number {
    return this.userSessions.get(userId)?.size || 0;
  }

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }
}

export const sessionManager = new SessionManager();
