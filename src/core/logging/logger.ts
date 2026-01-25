/**
 * Structured Logging Infrastructure
 * 
 * Provides observability without affecting system behavior.
 * 
 * GUARDRAILS:
 * - Logging is SIDE-EFFECT ONLY - never affects control flow
 * - No conditional logic based on log results
 * - No error swallowing
 * - No retries triggered by logging
 * - All log operations are synchronous and non-blocking
 */

import type { EntityId, DateTimeString } from '../types';

// ============================================================
// LOG LEVELS
// ============================================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Numeric log levels for filtering.
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// ============================================================
// LOG ENTRY STRUCTURE
// ============================================================

/**
 * Structured log entry.
 * All fields are serializable for external log aggregation.
 */
export interface LogEntry {
  /** ISO 8601 timestamp */
  readonly timestamp: DateTimeString;
  
  /** Log severity level */
  readonly level: LogLevel;
  
  /** Correlation ID for request tracing */
  readonly correlation_id: string;
  
  /** Operation being performed */
  readonly operation: string;
  
  /** Human-readable message */
  readonly message: string;
  
  /** Associated quote ID (if applicable) */
  readonly quote_id?: EntityId;
  
  /** Associated version ID (if applicable) */
  readonly version_id?: EntityId;
  
  /** Operation duration in milliseconds */
  readonly duration_ms?: number;
  
  /** Error code (if applicable) */
  readonly error_code?: string;
  
  /** Additional context (must be JSON-serializable) */
  readonly context?: Record<string, unknown>;
}

// ============================================================
// LOGGER INTERFACE
// ============================================================

/**
 * Logger interface.
 * Implementations must be synchronous and non-blocking.
 */
export interface Logger {
  /** Log at DEBUG level */
  debug(entry: Omit<LogEntry, 'timestamp' | 'level'>): void;
  
  /** Log at INFO level */
  info(entry: Omit<LogEntry, 'timestamp' | 'level'>): void;
  
  /** Log at WARN level */
  warn(entry: Omit<LogEntry, 'timestamp' | 'level'>): void;
  
  /** Log at ERROR level */
  error(entry: Omit<LogEntry, 'timestamp' | 'level'>): void;
  
  /** Create a child logger with additional context */
  child(context: { correlation_id?: string; quote_id?: EntityId; version_id?: EntityId }): Logger;
  
  /** Get current minimum log level */
  getLevel(): LogLevel;
  
  /** Set minimum log level */
  setLevel(level: LogLevel): void;
}

// ============================================================
// CONSOLE LOGGER IMPLEMENTATION
// ============================================================

/**
 * Console-based logger implementation.
 * 
 * GUARDRAIL: This logger is OBSERVABILITY ONLY.
 * - All methods are synchronous
 * - No errors are thrown
 * - No return values that could affect control flow
 */
export class ConsoleLogger implements Logger {
  private level: LogLevel;
  private baseContext: {
    correlation_id?: string;
    quote_id?: EntityId;
    version_id?: EntityId;
  };

  constructor(
    level: LogLevel = 'INFO',
    baseContext: { correlation_id?: string; quote_id?: EntityId; version_id?: EntityId } = {}
  ) {
    this.level = level;
    this.baseContext = baseContext;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.level];
  }

  private createEntry(
    level: LogLevel,
    entry: Omit<LogEntry, 'timestamp' | 'level'>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString() as DateTimeString,
      level,
      correlation_id: entry.correlation_id || this.baseContext.correlation_id || 'NO_CORRELATION_ID',
      operation: entry.operation,
      message: entry.message,
      quote_id: entry.quote_id || this.baseContext.quote_id,
      version_id: entry.version_id || this.baseContext.version_id,
      duration_ms: entry.duration_ms,
      error_code: entry.error_code,
      context: entry.context,
    };
  }

  private log(level: LogLevel, entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const fullEntry = this.createEntry(level, entry);

    // Format for console output
    const prefix = `[${fullEntry.timestamp}] [${level}] [${fullEntry.correlation_id}]`;
    const ids = [
      fullEntry.quote_id ? `quote=${fullEntry.quote_id}` : null,
      fullEntry.version_id ? `version=${fullEntry.version_id}` : null,
    ].filter(Boolean).join(' ');
    
    const duration = fullEntry.duration_ms !== undefined ? `(${fullEntry.duration_ms}ms)` : '';
    const errorCode = fullEntry.error_code ? `[${fullEntry.error_code}]` : '';

    const message = [
      prefix,
      fullEntry.operation,
      ids,
      errorCode,
      fullEntry.message,
      duration,
    ].filter(Boolean).join(' ');

    // Use appropriate console method
    switch (level) {
      case 'DEBUG':
        console.debug(message, fullEntry.context ? fullEntry.context : '');
        break;
      case 'INFO':
        console.info(message, fullEntry.context ? fullEntry.context : '');
        break;
      case 'WARN':
        console.warn(message, fullEntry.context ? fullEntry.context : '');
        break;
      case 'ERROR':
        console.error(message, fullEntry.context ? fullEntry.context : '');
        break;
    }
  }

  debug(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log('DEBUG', entry);
  }

  info(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log('INFO', entry);
  }

  warn(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log('WARN', entry);
  }

  error(entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    this.log('ERROR', entry);
  }

  child(context: { correlation_id?: string; quote_id?: EntityId; version_id?: EntityId }): Logger {
    return new ConsoleLogger(this.level, {
      ...this.baseContext,
      ...context,
    });
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// ============================================================
// NO-OP LOGGER (FOR TESTING)
// ============================================================

/**
 * No-op logger that discards all log entries.
 * Useful for testing when log output is not needed.
 */
export class NoOpLogger implements Logger {
  debug(_entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    // Intentionally empty
  }

  info(_entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    // Intentionally empty
  }

  warn(_entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    // Intentionally empty
  }

  error(_entry: Omit<LogEntry, 'timestamp' | 'level'>): void {
    // Intentionally empty
  }

  child(_context: { correlation_id?: string; quote_id?: EntityId; version_id?: EntityId }): Logger {
    return this;
  }

  getLevel(): LogLevel {
    return 'ERROR';
  }

  setLevel(_level: LogLevel): void {
    // Intentionally empty
  }
}

// ============================================================
// DEFAULT LOGGER INSTANCE
// ============================================================

/**
 * Default logger instance.
 * Can be replaced via setDefaultLogger() for testing or custom implementations.
 */
let defaultLogger: Logger = new ConsoleLogger('INFO');

/**
 * Get the default logger instance.
 */
export function getLogger(): Logger {
  return defaultLogger;
}

/**
 * Set the default logger instance.
 * Use for testing or custom implementations.
 */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Reset to default ConsoleLogger.
 */
export function resetDefaultLogger(): void {
  defaultLogger = new ConsoleLogger('INFO');
}
