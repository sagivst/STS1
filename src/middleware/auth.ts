import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { AuthenticationError } from '../utils/errors';
import { AuthenticatedUser } from '../types';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('Authentication failed: No token provided');
    throw new AuthenticationError('Access token required');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload & AuthenticatedUser;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      permissions: decoded.permissions || [],
      sessionLimit: decoded.sessionLimit || config.performance.maxConcurrentSessions,
    };
    
    logger.debug(`User authenticated: ${req.user.email}`);
    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', { error: (error as Error).message });
    throw new AuthenticationError('Invalid access token');
  }
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('admin')) {
      logger.warn(`Permission denied: ${req.user.email} lacks ${permission}`);
      throw new AuthenticationError(`Permission required: ${permission}`);
    }

    next();
  };
}

export function generateToken(user: Partial<AuthenticatedUser>): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      permissions: user.permissions || ['translate'],
      sessionLimit: user.sessionLimit || config.performance.maxConcurrentSessions,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
}
