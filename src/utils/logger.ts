/**
 * utils/logger.ts
 * Levelled logger that respects LOG_LEVEL env var
 * Uses stderr so it never corrupts MCP stdio transport
 */

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Notice = 2,
  Error = 3,
  Urgent = 4,
}

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.Debug]: 'DEBUG',
  [LogLevel.Info]: 'INFO',
  [LogLevel.Notice]: 'NOTICE',
  [LogLevel.Error]: 'ERROR',
  [LogLevel.Urgent]: 'URGENT',
};

function currentLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? 'Info').toLowerCase();
  const map: Record<string, LogLevel> = {
    debug: LogLevel.Debug,
    info: LogLevel.Info,
    notice: LogLevel.Notice,
    error: LogLevel.Error,
    urgent: LogLevel.Urgent,
  };
  return map[env] ?? LogLevel.Info;
}

function log(level: LogLevel, message: string): void {
  if (level < currentLevel()) return;
  const ts = new Date().toISOString();
  console.error(`[${LEVEL_NAMES[level]}] [${ts}] ${message}`);
}

export const logger = {
  debug: (msg: string) => log(LogLevel.Debug, msg),
  info: (msg: string) => log(LogLevel.Info, msg),
  notice: (msg: string) => log(LogLevel.Notice, msg),
  error: (msg: string) => log(LogLevel.Error, msg),
  urgent: (msg: string) => log(LogLevel.Urgent, msg),
};
