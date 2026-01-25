/**
 * Logging Module - Barrel Export
 * 
 * Structured logging infrastructure for observability.
 */

// Logger
export {
  type LogLevel,
  LOG_LEVEL_VALUES,
  type LogEntry,
  type Logger,
  ConsoleLogger,
  NoOpLogger,
  getLogger,
  setDefaultLogger,
  resetDefaultLogger,
} from './logger';

// Correlation
export {
  generateCorrelationId,
  type OperationContext,
  createOperationContext,
  extendOperationContext,
  getElapsedMs,
  Operations,
  type OperationName,
  type Timer,
  startTimer,
} from './correlation';
