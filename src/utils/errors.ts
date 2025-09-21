export class TranslationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class STTError extends TranslationError {
  constructor(message: string) {
    super(message, 'STT_ERROR', 502);
    this.name = 'STTError';
  }
}

export class MTError extends TranslationError {
  constructor(message: string) {
    super(message, 'MT_ERROR', 502);
    this.name = 'MTError';
  }
}

export class TTSError extends TranslationError {
  constructor(message: string) {
    super(message, 'TTS_ERROR', 502);
    this.name = 'TTSError';
  }
}

export class SessionError extends TranslationError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR', 400);
    this.name = 'SessionError';
  }
}

export class AuthenticationError extends TranslationError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends TranslationError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}

export class ServiceError extends TranslationError {
  constructor(code: string, message: string, statusCode: number = 500) {
    super(message, code, statusCode);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends TranslationError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends TranslationError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500);
    this.name = 'ConfigurationError';
  }
}
