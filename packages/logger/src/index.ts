import pino from 'pino';

export function createLogger(service: string) {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'token',
        'accessToken',
        'refreshToken',
        'clientSecret',
      ],
      censor: '[REDACTED]',
    },
    messageKey: 'message',
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
