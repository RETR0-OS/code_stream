/**
 * Logging utility for Code Stream extension
 * Provides structured logging with levels and optional console output
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface ILoggerConfig {
  level: LogLevel;
  prefix: string;
  enableConsole: boolean;
}

/**
 * Logger class for Code Stream extension
 * Provides structured logging with proper levels
 */
export class Logger {
  private config: ILoggerConfig;

  constructor(config: Partial<ILoggerConfig> = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      prefix: config.prefix ?? 'Code Stream',
      enableConsole: config.enableConsole ?? true
    };
  }

  /**
   * Set the current log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Enable or disable console output
   */
  setConsoleEnabled(enabled: boolean): void {
    this.config.enableConsole = enabled;
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, ...args: any[]): void {
    if (error instanceof Error) {
      this.log(LogLevel.ERROR, message, error.message, error.stack, ...args);
    } else if (error !== undefined) {
      this.log(LogLevel.ERROR, message, error, ...args);
    } else {
      this.log(LogLevel.ERROR, message, ...args);
    }
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    // Check if this log level should be output
    if (level < this.config.level || !this.config.enableConsole) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const prefix = `[${timestamp}] [${this.config.prefix}] [${levelName}]`;
    const fullMessage = `${prefix} ${message}`;

    // Output to console based on level
    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(fullMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage, ...args);
        break;
      case LogLevel.ERROR:
        console.error(fullMessage, ...args);
        break;
    }
  }
}

/**
 * Default logger instance
 * Can be configured via settings or environment
 */
export const logger = new Logger({
  level: LogLevel.INFO,
  prefix: 'Code Stream',
  enableConsole: true
});

/**
 * Create a child logger with a specific prefix
 */
export function createLogger(prefix: string, level?: LogLevel): Logger {
  return new Logger({
    level: level ?? LogLevel.INFO,
    prefix,
    enableConsole: true
  });
}
