/**
 * Error Categorization
 * 
 * Provides metadata-only classification of all system errors.
 * 
 * PHASE 4 GUARDRAILS:
 * - This is METADATA ONLY
 * - No retry logic
 * - No recovery logic
 * - No behavior changes
 * - Classification only
 * 
 * Categories:
 * - TRANSIENT: Temporary failure, retry may succeed
 * - VALIDATION: Input validation failed
 * - NOT_FOUND: Resource does not exist
 * - CONFIG: Configuration/admin issue
 * - INVARIANT: System invariant violated
 * - EXTERNAL: External service failure
 */

// ============================================================
// ERROR CATEGORIES
// ============================================================

/**
 * Error category enumeration.
 * Used for classification, NOT for control flow.
 */
export enum ErrorCategory {
  /** Temporary failure, retry may succeed */
  TRANSIENT = 'TRANSIENT',
  
  /** Input validation failed, requires user correction */
  VALIDATION = 'VALIDATION',
  
  /** Resource does not exist */
  NOT_FOUND = 'NOT_FOUND',
  
  /** Configuration missing or invalid, requires admin action */
  CONFIG = 'CONFIG',
  
  /** System invariant violated, should not happen */
  INVARIANT = 'INVARIANT',
  
  /** External service failure */
  EXTERNAL = 'EXTERNAL',
}

// ============================================================
// ERROR METADATA
// ============================================================

/**
 * Metadata for an error code.
 * Used for documentation and UI display, NOT for control flow.
 */
export interface ErrorMetadata {
  /** The error code string */
  readonly code: string;
  
  /** Error category */
  readonly category: ErrorCategory;
  
  /** Whether this error is safe to retry */
  readonly retryable: boolean;
  
  /** Human-readable description */
  readonly description: string;
  
  /** Suggested resolution for user/admin */
  readonly resolution: string;
  
  /** Whether to show this error to end users */
  readonly userVisible: boolean;
  
  /** Log level for this error */
  readonly logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
}

// ============================================================
// CALCULATION ENGINE ERROR METADATA
// ============================================================

export const CALCULATION_ERROR_METADATA: Record<string, ErrorMetadata> = {
  CALC_INIT_FAILED: {
    code: 'CALC_INIT_FAILED',
    category: ErrorCategory.TRANSIENT,
    retryable: true,
    description: 'Calculation initialization failed',
    resolution: 'System will retry automatically',
    userVisible: false,
    logLevel: 'WARN',
  },
  CALC_FX_LOCK_FAILED: {
    code: 'CALC_FX_LOCK_FAILED',
    category: ErrorCategory.TRANSIENT,
    retryable: true,
    description: 'Failed to lock exchange rates',
    resolution: 'Retry or enter exchange rates manually',
    userVisible: true,
    logLevel: 'WARN',
  },
  CALC_RATE_NOT_FOUND: {
    code: 'CALC_RATE_NOT_FOUND',
    category: ErrorCategory.CONFIG,
    retryable: false,
    description: 'Room rate not found for the specified dates',
    resolution: 'Administrator must configure rates for this room/season',
    userVisible: true,
    logLevel: 'ERROR',
  },
  CALC_SEASON_NOT_FOUND: {
    code: 'CALC_SEASON_NOT_FOUND',
    category: ErrorCategory.CONFIG,
    retryable: false,
    description: 'No season configured for the specified dates',
    resolution: 'Administrator must configure seasons covering these dates',
    userVisible: true,
    logLevel: 'ERROR',
  },
  CALC_CURRENCY_CONVERSION_FAILED: {
    code: 'CALC_CURRENCY_CONVERSION_FAILED',
    category: ErrorCategory.CONFIG,
    retryable: false,
    description: 'Currency conversion failed',
    resolution: 'Administrator must add missing exchange rate',
    userVisible: true,
    logLevel: 'ERROR',
  },
  CALC_ARITHMETIC_ERROR: {
    code: 'CALC_ARITHMETIC_ERROR',
    category: ErrorCategory.INVARIANT,
    retryable: false,
    description: 'Arithmetic overflow or underflow occurred',
    resolution: 'Contact support - values exceed safe calculation range',
    userVisible: true,
    logLevel: 'CRITICAL',
  },
  CALC_NEGATIVE_FINAL_AMOUNT: {
    code: 'CALC_NEGATIVE_FINAL_AMOUNT',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Final amount is negative',
    resolution: 'Review and reduce discounts',
    userVisible: true,
    logLevel: 'ERROR',
  },
  CALC_TAX_CONFIG_INVALID: {
    code: 'CALC_TAX_CONFIG_INVALID',
    category: ErrorCategory.CONFIG,
    retryable: false,
    description: 'Tax configuration is invalid',
    resolution: 'Administrator must fix tax configuration',
    userVisible: true,
    logLevel: 'ERROR',
  },
  CALC_MARKUP_INVALID: {
    code: 'CALC_MARKUP_INVALID',
    category: ErrorCategory.CONFIG,
    retryable: false,
    description: 'Markup configuration is invalid',
    resolution: 'Administrator must fix markup configuration',
    userVisible: true,
    logLevel: 'ERROR',
  },
  CALC_VERIFICATION_FAILED: {
    code: 'CALC_VERIFICATION_FAILED',
    category: ErrorCategory.INVARIANT,
    retryable: false,
    description: 'Sum verification failed - totals do not match',
    resolution: 'Contact support - calculation integrity issue',
    userVisible: true,
    logLevel: 'CRITICAL',
  },
};

// ============================================================
// QUOTE SERVICE ERROR METADATA
// ============================================================

export const QUOTE_SERVICE_ERROR_METADATA: Record<string, ErrorMetadata> = {
  QUOTE_NOT_FOUND: {
    code: 'QUOTE_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Quote not found',
    resolution: 'Verify the quote ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
  QUOTE_NOT_EDITABLE: {
    code: 'QUOTE_NOT_EDITABLE',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Quote is not editable in current status',
    resolution: 'Revert quote to DRAFT status first',
    userVisible: true,
    logLevel: 'WARN',
  },
  QUOTE_NOT_DELETABLE: {
    code: 'QUOTE_NOT_DELETABLE',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Quote cannot be deleted in current status',
    resolution: 'Only DRAFT quotes can be deleted',
    userVisible: true,
    logLevel: 'WARN',
  },
  INVALID_STATE_TRANSITION: {
    code: 'INVALID_STATE_TRANSITION',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Invalid state transition requested',
    resolution: 'Check allowed transitions from current status',
    userVisible: true,
    logLevel: 'WARN',
  },
  MISSING_VERSION: {
    code: 'MISSING_VERSION',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Quote has no calculated version',
    resolution: 'Calculate the quote before sending',
    userVisible: true,
    logLevel: 'WARN',
  },
  VERSION_NOT_FOUND: {
    code: 'VERSION_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Quote version not found',
    resolution: 'Verify the version ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Input validation failed',
    resolution: 'Fix the validation errors and retry',
    userVisible: true,
    logLevel: 'WARN',
  },
  PERSISTENCE_ERROR: {
    code: 'PERSISTENCE_ERROR',
    category: ErrorCategory.TRANSIENT,
    retryable: true,
    description: 'Failed to save data',
    resolution: 'System will retry automatically',
    userVisible: false,
    logLevel: 'ERROR',
  },
};

// ============================================================
// CALCULATION SERVICE ERROR METADATA
// ============================================================

export const CALCULATION_SERVICE_ERROR_METADATA: Record<string, ErrorMetadata> = {
  QUOTE_NOT_FOUND: {
    code: 'QUOTE_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Quote not found for calculation',
    resolution: 'Verify the quote ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
  QUOTE_NOT_EDITABLE: {
    code: 'QUOTE_NOT_EDITABLE',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Quote cannot be calculated in current status',
    resolution: 'Quote must be in DRAFT status',
    userVisible: true,
    logLevel: 'WARN',
  },
  CALCULATION_FAILED: {
    code: 'CALCULATION_FAILED',
    category: ErrorCategory.TRANSIENT, // Varies - check inner error
    retryable: false, // Depends on inner error
    description: 'Calculation engine failed',
    resolution: 'Check the detailed error message',
    userVisible: true,
    logLevel: 'ERROR',
  },
  VERSION_CREATION_FAILED: {
    code: 'VERSION_CREATION_FAILED',
    category: ErrorCategory.TRANSIENT,
    retryable: true,
    description: 'Failed to create quote version',
    resolution: 'System will retry automatically',
    userVisible: false,
    logLevel: 'ERROR',
  },
  DATA_LOAD_FAILED: {
    code: 'DATA_LOAD_FAILED',
    category: ErrorCategory.TRANSIENT,
    retryable: true,
    description: 'Failed to load reference data',
    resolution: 'System will retry automatically',
    userVisible: false,
    logLevel: 'ERROR',
  },
};

// ============================================================
// PDF SERVICE ERROR METADATA
// ============================================================

export const PDF_SERVICE_ERROR_METADATA: Record<string, ErrorMetadata> = {
  QUOTE_NOT_FOUND: {
    code: 'QUOTE_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Quote not found for PDF generation',
    resolution: 'Verify the quote ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
  VERSION_NOT_FOUND: {
    code: 'VERSION_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Quote version not found for PDF generation',
    resolution: 'Verify the version ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
  GENERATION_FAILED: {
    code: 'GENERATION_FAILED',
    category: ErrorCategory.TRANSIENT,
    retryable: true,
    description: 'PDF generation failed',
    resolution: 'Retry PDF generation',
    userVisible: true,
    logLevel: 'ERROR',
  },
  STORAGE_FAILED: {
    code: 'STORAGE_FAILED',
    category: ErrorCategory.TRANSIENT,
    retryable: true,
    description: 'Failed to store PDF file',
    resolution: 'System will retry automatically',
    userVisible: false,
    logLevel: 'ERROR',
  },
  RECORD_NOT_FOUND: {
    code: 'RECORD_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'PDF record not found',
    resolution: 'Verify the PDF record ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
};

// ============================================================
// EMAIL SERVICE ERROR METADATA
// ============================================================

export const EMAIL_SERVICE_ERROR_METADATA: Record<string, ErrorMetadata> = {
  QUOTE_NOT_FOUND: {
    code: 'QUOTE_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Quote not found for email',
    resolution: 'Verify the quote ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
  VERSION_NOT_FOUND: {
    code: 'VERSION_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Quote version not found for email',
    resolution: 'Verify the version ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
  SEND_FAILED: {
    code: 'SEND_FAILED',
    category: ErrorCategory.EXTERNAL,
    retryable: true,
    description: 'Email sending failed',
    resolution: 'Check email service status and retry',
    userVisible: true,
    logLevel: 'ERROR',
  },
  RECORD_NOT_FOUND: {
    code: 'RECORD_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Email record not found',
    resolution: 'Verify the email record ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
  ORIGINAL_NOT_FOUND: {
    code: 'ORIGINAL_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Original email record not found for resend',
    resolution: 'Verify the original email record ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
};

// ============================================================
// STATE MACHINE ERROR METADATA
// ============================================================

export const STATE_MACHINE_ERROR_METADATA: Record<string, ErrorMetadata> = {
  INVALID_TRANSITION: {
    code: 'INVALID_TRANSITION',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Invalid state transition',
    resolution: 'Check allowed transitions from current status',
    userVisible: true,
    logLevel: 'WARN',
  },
  MISSING_VERSION: {
    code: 'MISSING_VERSION',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Cannot send quote without calculated version',
    resolution: 'Calculate the quote first',
    userVisible: true,
    logLevel: 'WARN',
  },
  QUOTE_NOT_FOUND: {
    code: 'QUOTE_NOT_FOUND',
    category: ErrorCategory.NOT_FOUND,
    retryable: false,
    description: 'Quote not found',
    resolution: 'Verify the quote ID exists',
    userVisible: true,
    logLevel: 'WARN',
  },
  TERMINAL_STATE: {
    code: 'TERMINAL_STATE',
    category: ErrorCategory.VALIDATION,
    retryable: false,
    description: 'Quote is in terminal state',
    resolution: 'CONVERTED quotes cannot be modified',
    userVisible: true,
    logLevel: 'WARN',
  },
};

// ============================================================
// UNIFIED ERROR REGISTRY
// ============================================================

/**
 * Complete error registry combining all services.
 * Key format: SERVICE.ERROR_CODE (e.g., "QUOTE_SERVICE.QUOTE_NOT_FOUND")
 */
export const ERROR_REGISTRY: Record<string, ErrorMetadata> = {
  // Calculation Engine
  ...Object.fromEntries(
    Object.entries(CALCULATION_ERROR_METADATA).map(([k, v]) => [`CALCULATION.${k}`, v])
  ),
  // Quote Service
  ...Object.fromEntries(
    Object.entries(QUOTE_SERVICE_ERROR_METADATA).map(([k, v]) => [`QUOTE_SERVICE.${k}`, v])
  ),
  // Calculation Service
  ...Object.fromEntries(
    Object.entries(CALCULATION_SERVICE_ERROR_METADATA).map(([k, v]) => [`CALCULATION_SERVICE.${k}`, v])
  ),
  // PDF Service
  ...Object.fromEntries(
    Object.entries(PDF_SERVICE_ERROR_METADATA).map(([k, v]) => [`PDF_SERVICE.${k}`, v])
  ),
  // Email Service
  ...Object.fromEntries(
    Object.entries(EMAIL_SERVICE_ERROR_METADATA).map(([k, v]) => [`EMAIL_SERVICE.${k}`, v])
  ),
  // State Machine
  ...Object.fromEntries(
    Object.entries(STATE_MACHINE_ERROR_METADATA).map(([k, v]) => [`STATE_MACHINE.${k}`, v])
  ),
};

// ============================================================
// LOOKUP FUNCTIONS (METADATA ONLY - NO LOGIC)
// ============================================================

/**
 * Get metadata for a service error code.
 * Returns undefined if error code not found.
 * 
 * NOTE: This is for LOOKUP ONLY, not for control flow decisions.
 */
export function getServiceErrorMetadata(service: string, code: string): ErrorMetadata | undefined {
  return ERROR_REGISTRY[`${service}.${code}`];
}

/**
 * Check if an error is retryable.
 * 
 * NOTE: This is for CLASSIFICATION ONLY.
 * The caller decides whether to actually retry.
 */
export function isServiceErrorRetryable(service: string, code: string): boolean {
  const metadata = getServiceErrorMetadata(service, code);
  return metadata?.retryable ?? false;
}

/**
 * Get error category.
 * 
 * NOTE: This is for CLASSIFICATION ONLY.
 */
export function getServiceErrorCategory(service: string, code: string): ErrorCategory | undefined {
  const metadata = getServiceErrorMetadata(service, code);
  return metadata?.category;
}

/**
 * Check if error should be shown to users.
 * 
 * NOTE: This is for UI DISPLAY ONLY.
 */
export function isServiceErrorUserVisible(service: string, code: string): boolean {
  const metadata = getServiceErrorMetadata(service, code);
  return metadata?.userVisible ?? true;
}

/**
 * Get resolution message for an error.
 * 
 * NOTE: This is for UI DISPLAY ONLY.
 */
export function getServiceErrorResolution(service: string, code: string): string | undefined {
  const metadata = getServiceErrorMetadata(service, code);
  return metadata?.resolution;
}

// ============================================================
// SERVICE NAME CONSTANTS
// ============================================================

export const ErrorService = {
  CALCULATION: 'CALCULATION',
  QUOTE_SERVICE: 'QUOTE_SERVICE',
  CALCULATION_SERVICE: 'CALCULATION_SERVICE',
  PDF_SERVICE: 'PDF_SERVICE',
  EMAIL_SERVICE: 'EMAIL_SERVICE',
  STATE_MACHINE: 'STATE_MACHINE',
} as const;

export type ErrorServiceName = typeof ErrorService[keyof typeof ErrorService];
