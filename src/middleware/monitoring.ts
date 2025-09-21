import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { PerformanceMetrics } from '../types';

interface RequestWithMetrics extends Request {
  startTime?: number;
  sessionId?: string;
}

export function performanceMonitoring(req: RequestWithMetrics, res: Response, next: NextFunction): void {
  req.startTime = Date.now();
  
  req.sessionId = req.params.sessionId || req.body.sessionId || req.query.sessionId as string;

  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - (req.startTime || Date.now());
    
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      sessionId: req.sessionId || 'unknown',
      operation: `${req.method} ${req.path}`,
      duration,
      success: res.statusCode < 400,
      error: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
    };

    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      sessionId: req.sessionId,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    if (duration > 2000) { // 2 seconds
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration,
        sessionId: req.sessionId,
      });
    }

    return originalSend.call(this, body);
  };

  next();
}

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  const statusCode = (error as any).statusCode || 500;
  const code = (error as any).code || 'INTERNAL_ERROR';

  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    code,
    statusCode,
    method: req.method,
    path: req.path,
    sessionId: (req as any).sessionId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  res.status(statusCode).json({
    error: {
      code,
      message: error.message,
      timestamp: new Date().toISOString(),
    },
  });
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  logger.info('Request started', {
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    sessionId: (req as any).sessionId,
  });

  next();
}

export function corsHeaders(req: Request, res: Response, next: NextFunction): void {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}
