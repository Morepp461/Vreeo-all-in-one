import pino, { type Logger, type LoggerOptions } from "pino";

export interface CreateLoggerOptions {
  service: string;
  level?: string;
  base?: Record<string, unknown>;
}

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
  "token",
  "discordToken",
  "password",
  "client_secret",
  "clientSecret",
  "access_token",
  "refresh_token",
  "*.token",
  "*.password",
  "*.client_secret",
];

export function createLoggerOptions(options: CreateLoggerOptions): LoggerOptions {
  return {
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    base: { service: options.service, ...options.base },
    redact: { paths: redactPaths, censor: "[REDACTED]" },
    messageKey: "message",
    timestamp: pino.stdTimeFunctions.isoTime,
  };
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return pino(createLoggerOptions(options));
}
