/**
 * Correlation ID Generation and Propagation
 * 
 * Provides unique identifiers for tracing operations across services.
 * 
 * GUARDRAILS:
 * - Correlation IDs are metadata only
 * - Generation is deterministic (UUID v4 format)
 * - No business logic depends on correlation IDs
 * - IDs are for observability only
 */

// ============================================================
// CORRELATION ID GENERATION
// ============================================================

/**
 * Generate a correlation ID.
 * Format: COR-{timestamp}-{random}
 * 
 * Example: COR-20260124-143052-a1b2c3d4
 */
export function generateCorrelationId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
  const randomPart = Math.random().toString(36).substring(2, 10);
  
  return `COR-${datePart}-${timePart}-${randomPart}`;
}

// ============================================================
// OPERATION CONTEXT
// ============================================================

/**
 * Operation context for logging.
 * Carries correlation and entity IDs through an operation.
 */
export interface OperationContext {
  /** Correlation ID for this operation chain */
  readonly correlationId: string;
  
  /** Quote ID (if operating on a specific quote) */
  readonly quoteId?: string;
  
  /** Version ID (if operating on a specific version) */
  readonly versionId?: string;
  
  /** Operation start time */
  readonly startTime: number;
}

/**
 * Create a new operation context.
 */
export function createOperationContext(options?: {
  correlationId?: string;
  quoteId?: string;
  versionId?: string;
}): OperationContext {
  return {
    correlationId: options?.correlationId ?? generateCorrelationId(),
    quoteId: options?.quoteId,
    versionId: options?.versionId,
    startTime: Date.now(),
  };
}

/**
 * Create a child context with additional IDs.
 */
export function extendOperationContext(
  parent: OperationContext,
  additions: { quoteId?: string; versionId?: string }
): OperationContext {
  return {
    ...parent,
    quoteId: additions.quoteId ?? parent.quoteId,
    versionId: additions.versionId ?? parent.versionId,
  };
}

/**
 * Calculate elapsed time since context creation.
 */
export function getElapsedMs(context: OperationContext): number {
  return Date.now() - context.startTime;
}

// ============================================================
// OPERATION NAMES
// ============================================================

/**
 * Standard operation names for consistent logging.
 */
export const Operations = {
  // Quote operations
  QUOTE_CREATE: 'quote.create',
  QUOTE_GET: 'quote.get',
  QUOTE_GET_WITH_ACTIONS: 'quote.getWithActions',
  QUOTE_SEND: 'quote.send',
  QUOTE_REVERT: 'quote.revert',
  QUOTE_CONVERT: 'quote.convert',
  QUOTE_REJECT: 'quote.reject',
  QUOTE_EXPIRE: 'quote.expire',
  
  // Calculation operations
  CALCULATION_START: 'calculation.start',
  CALCULATION_LEG: 'calculation.leg',
  CALCULATION_COMPLETE: 'calculation.complete',
  
  // Version operations
  VERSION_CREATE: 'version.create',
  VERSION_GET: 'version.get',
  VERSION_LIST: 'version.list',
  
  // PDF operations
  PDF_GENERATE: 'pdf.generate',
  PDF_RETRIEVE: 'pdf.retrieve',
  PDF_LIST: 'pdf.list',
  
  // Email operations
  EMAIL_SEND: 'email.send',
  EMAIL_RESEND: 'email.resend',
  EMAIL_LIST: 'email.list',
} as const;

export type OperationName = typeof Operations[keyof typeof Operations];

// ============================================================
// TIMING UTILITIES
// ============================================================

/**
 * Timer for measuring operation duration.
 */
export interface Timer {
  /** Get elapsed time in milliseconds */
  elapsed(): number;
  
  /** Stop timer and return final elapsed time */
  stop(): number;
}

/**
 * Create a timer for measuring operation duration.
 */
export function startTimer(): Timer {
  const startTime = Date.now();
  let stopped = false;
  let finalTime = 0;
  
  return {
    elapsed(): number {
      if (stopped) {
        return finalTime;
      }
      return Date.now() - startTime;
    },
    stop(): number {
      if (!stopped) {
        stopped = true;
        finalTime = Date.now() - startTime;
      }
      return finalTime;
    },
  };
}
