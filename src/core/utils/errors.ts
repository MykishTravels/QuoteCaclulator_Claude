/**
 * Error Codes
 * 
 * Complete inventory of error codes per Phase 3 and Phase 6.
 * 
 * Reference:
 * - Phase 3 Section L: Blocking Error Code Inventory (37 codes)
 * - Phase 3 Section K: Warning Code Inventory (23 codes)
 * - Phase 6: Calculation Error Codes (10 codes)
 */

import { ValidationSeverity } from '../types';

// ============================================================
// BLOCKING ERROR CODES (37)
// Reference: Phase 3 Section L
// ============================================================

/**
 * Date validation error codes.
 */
export const DATE_ERROR_CODES = {
  INVALID_CHECK_IN_DATE: 'INVALID_CHECK_IN_DATE',
  INVALID_DATE_SEQUENCE: 'INVALID_DATE_SEQUENCE',
  LEG_DATE_SEQUENCE_ERROR: 'LEG_DATE_SEQUENCE_ERROR',
  BLACKOUT_DATE_RESORT_WIDE: 'BLACKOUT_DATE_RESORT_WIDE',
  BLACKOUT_DATE_ROOM_SPECIFIC: 'BLACKOUT_DATE_ROOM_SPECIFIC',
} as const;

/**
 * Season and rate error codes.
 */
export const SEASON_ERROR_CODES = {
  NO_SEASON_COVERAGE: 'NO_SEASON_COVERAGE',
  OVERLAPPING_SEASONS_DATA_ERROR: 'OVERLAPPING_SEASONS_DATA_ERROR',
  MISSING_RATE: 'MISSING_RATE',
} as const;

/**
 * Occupancy error codes.
 */
export const OCCUPANCY_ERROR_CODES = {
  NO_GUESTS_SPECIFIED: 'NO_GUESTS_SPECIFIED',
  ADULTS_REQUIRED: 'ADULTS_REQUIRED',
  ADULT_OCCUPANCY_EXCEEDED: 'ADULT_OCCUPANCY_EXCEEDED',
  CHILD_OCCUPANCY_EXCEEDED: 'CHILD_OCCUPANCY_EXCEEDED',
  TOTAL_OCCUPANCY_EXCEEDED: 'TOTAL_OCCUPANCY_EXCEEDED',
  INVALID_CHILD_AGE: 'INVALID_CHILD_AGE',
  MISSING_CHILD_AGE: 'MISSING_CHILD_AGE',
} as const;

/**
 * Component validation error codes.
 */
export const COMPONENT_ERROR_CODES = {
  ROOM_TYPE_NOT_FOUND: 'ROOM_TYPE_NOT_FOUND',
  MEAL_PLAN_NOT_FOUND: 'MEAL_PLAN_NOT_FOUND',
  TRANSFER_NOT_FOUND: 'TRANSFER_NOT_FOUND',
  TRANSFER_REQUIRED_MISSING: 'TRANSFER_REQUIRED_MISSING',
  ACTIVITY_NOT_FOUND: 'ACTIVITY_NOT_FOUND',
  ACTIVITY_DATE_UNAVAILABLE: 'ACTIVITY_DATE_UNAVAILABLE',
  TAX_CONFIG_MISSING: 'TAX_CONFIG_MISSING',
} as const;

/**
 * Currency and markup error codes.
 */
export const CURRENCY_MARKUP_ERROR_CODES = {
  INVALID_CURRENCY: 'INVALID_CURRENCY',
  EXCHANGE_RATE_MISSING: 'EXCHANGE_RATE_MISSING',
  MARKUP_CONFIG_MISSING: 'MARKUP_CONFIG_MISSING',
  FIXED_MARKUP_CURRENCY_MISMATCH: 'FIXED_MARKUP_CURRENCY_MISMATCH',
  PERCENTAGE_OVERRIDE_NOT_SUPPORTED: 'PERCENTAGE_OVERRIDE_NOT_SUPPORTED',
} as const;

/**
 * Multi-resort validation error codes.
 */
export const MULTI_RESORT_ERROR_CODES = {
  GUEST_MISMATCH_ACROSS_LEGS: 'GUEST_MISMATCH_ACROSS_LEGS',
  LEG_SEQUENCE_GAP: 'LEG_SEQUENCE_GAP',
  INTER_RESORT_TRANSFER_LEG_INVALID: 'INTER_RESORT_TRANSFER_LEG_INVALID',
  INTER_RESORT_TRANSFER_SEQUENCE_ERROR: 'INTER_RESORT_TRANSFER_SEQUENCE_ERROR',
} as const;

/**
 * Quote lifecycle error codes.
 */
export const LIFECYCLE_ERROR_CODES = {
  NO_VERSION_EXISTS: 'NO_VERSION_EXISTS',
  VERSION_HAS_BLOCKING_ERRORS: 'VERSION_HAS_BLOCKING_ERRORS',
  QUOTE_VALIDITY_OUT_OF_RANGE: 'QUOTE_VALIDITY_OUT_OF_RANGE',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
} as const;

/**
 * Minimum stay error codes.
 */
export const MINIMUM_STAY_ERROR_CODES = {
  MINIMUM_STAY_VIOLATION: 'MINIMUM_STAY_VIOLATION',
} as const;

/**
 * All blocking error codes combined.
 */
export const BLOCKING_ERROR_CODES = {
  ...DATE_ERROR_CODES,
  ...SEASON_ERROR_CODES,
  ...OCCUPANCY_ERROR_CODES,
  ...COMPONENT_ERROR_CODES,
  ...CURRENCY_MARKUP_ERROR_CODES,
  ...MULTI_RESORT_ERROR_CODES,
  ...LIFECYCLE_ERROR_CODES,
  ...MINIMUM_STAY_ERROR_CODES,
} as const;

export type BlockingErrorCode = typeof BLOCKING_ERROR_CODES[keyof typeof BLOCKING_ERROR_CODES];

// ============================================================
// WARNING CODES (23)
// Reference: Phase 3 Section K
// ============================================================

export const WARNING_CODES = {
  // Occupancy warnings
  ADULTS_ZERO_REVIEW: 'ADULTS_ZERO_REVIEW',
  
  // Season warnings
  SEASON_BOUNDARY_CROSSING: 'SEASON_BOUNDARY_CROSSING',
  SEASON_DEFAULT_FALLBACK_USED: 'SEASON_DEFAULT_FALLBACK_USED',
  
  // Discount warnings
  DISCOUNT_ELIGIBLE_NOT_APPLIED: 'DISCOUNT_ELIGIBLE_NOT_APPLIED',
  DISCOUNT_AUTO_REMOVED: 'DISCOUNT_AUTO_REMOVED',
  DISCOUNT_EXCEEDS_BASE: 'DISCOUNT_EXCEEDS_BASE',
  EARLY_BIRD_APPROACHING: 'EARLY_BIRD_APPROACHING',
  
  // Rate/expiry warnings
  RATE_EXPIRING_SOON: 'RATE_EXPIRING_SOON',
  QUOTE_EXPIRY_APPROACHING: 'QUOTE_EXPIRY_APPROACHING',
  
  // Component warnings
  FESTIVE_SUPPLEMENT_APPLIED: 'FESTIVE_SUPPLEMENT_APPLIED',
  TRANSFER_NOT_SELECTED: 'TRANSFER_NOT_SELECTED',
  
  // Multi-leg warnings
  ACCOMMODATION_GAP: 'ACCOMMODATION_GAP',
  DUPLICATE_RESORT_CONSECUTIVE: 'DUPLICATE_RESORT_CONSECUTIVE',
  EXTENDED_STAY_DURATION: 'EXTENDED_STAY_DURATION',
  
  // Version warnings
  EXCESSIVE_VERSION_COUNT: 'EXCESSIVE_VERSION_COUNT',
  
  // Exchange rate warnings
  EXCHANGE_RATE_EXTREME_LOW: 'EXCHANGE_RATE_EXTREME_LOW',
  EXCHANGE_RATE_EXTREME_HIGH: 'EXCHANGE_RATE_EXTREME_HIGH',
} as const;

export type WarningCode = typeof WARNING_CODES[keyof typeof WARNING_CODES];

// ============================================================
// CALCULATION ERROR CODES (10)
// Reference: Phase 6 - Section 7.2
// ============================================================

/**
 * Calculation error codes with retry semantics.
 */
export const CALCULATION_ERROR_CODES = {
  /** Initialization failed; retry safe */
  CALC_INIT_FAILED: 'CALC_INIT_FAILED',
  /** Exchange rate lock failed; can retry or manual entry */
  CALC_FX_LOCK_FAILED: 'CALC_FX_LOCK_FAILED',
  /** No rate found; admin must configure */
  CALC_RATE_NOT_FOUND: 'CALC_RATE_NOT_FOUND',
  /** No season coverage; admin must configure */
  CALC_SEASON_NOT_FOUND: 'CALC_SEASON_NOT_FOUND',
  /** Currency conversion failed */
  CALC_CURRENCY_CONVERSION_FAILED: 'CALC_CURRENCY_CONVERSION_FAILED',
  /** Overflow/underflow; contact support */
  CALC_ARITHMETIC_ERROR: 'CALC_ARITHMETIC_ERROR',
  /** Final amount negative; review discounts */
  CALC_NEGATIVE_FINAL_AMOUNT: 'CALC_NEGATIVE_FINAL_AMOUNT',
  /** Tax config invalid; admin must fix */
  CALC_TAX_CONFIG_INVALID: 'CALC_TAX_CONFIG_INVALID',
  /** MarkupConfiguration invalid; admin must fix */
  CALC_MARKUP_INVALID: 'CALC_MARKUP_INVALID',
  /** Sum verification failed; requires fresh context */
  CALC_VERIFICATION_FAILED: 'CALC_VERIFICATION_FAILED',
} as const;

export type CalculationErrorCode = typeof CALCULATION_ERROR_CODES[keyof typeof CALCULATION_ERROR_CODES];

/**
 * Calculation error retry semantics.
 * Reference: BRD v1.2 Section 7.3
 */
export const CALCULATION_ERROR_RETRYABLE: Record<CalculationErrorCode, boolean> = {
  [CALCULATION_ERROR_CODES.CALC_INIT_FAILED]: true,
  [CALCULATION_ERROR_CODES.CALC_FX_LOCK_FAILED]: true,
  [CALCULATION_ERROR_CODES.CALC_RATE_NOT_FOUND]: false,
  [CALCULATION_ERROR_CODES.CALC_SEASON_NOT_FOUND]: false,
  [CALCULATION_ERROR_CODES.CALC_CURRENCY_CONVERSION_FAILED]: false,
  [CALCULATION_ERROR_CODES.CALC_ARITHMETIC_ERROR]: false,
  [CALCULATION_ERROR_CODES.CALC_NEGATIVE_FINAL_AMOUNT]: false,
  [CALCULATION_ERROR_CODES.CALC_TAX_CONFIG_INVALID]: false,
  [CALCULATION_ERROR_CODES.CALC_MARKUP_INVALID]: false,
  [CALCULATION_ERROR_CODES.CALC_VERIFICATION_FAILED]: false, // NOT retryable - requires fresh context
};

/**
 * Checks if a calculation error is retryable.
 */
export function isRetryableCalculationError(code: CalculationErrorCode): boolean {
  return CALCULATION_ERROR_RETRYABLE[code] ?? false;
}

// ============================================================
// ERROR METADATA
// ============================================================

/**
 * Error code metadata for messages and hints.
 */
export interface ErrorCodeMetadata {
  code: string;
  severity: ValidationSeverity;
  defaultMessage: string;
  resolutionHint?: string;
  isUserVisible: boolean;
}

/**
 * Full error code registry with metadata.
 */
export const ERROR_CODE_REGISTRY: Record<string, ErrorCodeMetadata> = {
  // Date errors
  [DATE_ERROR_CODES.INVALID_CHECK_IN_DATE]: {
    code: DATE_ERROR_CODES.INVALID_CHECK_IN_DATE,
    severity: ValidationSeverity.BLOCKING,
    defaultMessage: 'Check-in date must be today or in the future',
    resolutionHint: 'Select a future check-in date',
    isUserVisible: true,
  },
  [DATE_ERROR_CODES.INVALID_DATE_SEQUENCE]: {
    code: DATE_ERROR_CODES.INVALID_DATE_SEQUENCE,
    severity: ValidationSeverity.BLOCKING,
    defaultMessage: 'Check-out date must be after check-in date',
    resolutionHint: 'Ensure check-out is at least 1 day after check-in',
    isUserVisible: true,
  },
  
  // Occupancy errors
  [OCCUPANCY_ERROR_CODES.NO_GUESTS_SPECIFIED]: {
    code: OCCUPANCY_ERROR_CODES.NO_GUESTS_SPECIFIED,
    severity: ValidationSeverity.BLOCKING,
    defaultMessage: 'At least one guest must be specified',
    resolutionHint: 'Add at least one adult or child',
    isUserVisible: true,
  },
  [OCCUPANCY_ERROR_CODES.ADULT_OCCUPANCY_EXCEEDED]: {
    code: OCCUPANCY_ERROR_CODES.ADULT_OCCUPANCY_EXCEEDED,
    severity: ValidationSeverity.BLOCKING,
    defaultMessage: 'Number of adults exceeds room capacity',
    resolutionHint: 'Select a larger room or reduce adult count',
    isUserVisible: true,
  },
  
  // Calculation errors (system-internal)
  [CALCULATION_ERROR_CODES.CALC_VERIFICATION_FAILED]: {
    code: CALCULATION_ERROR_CODES.CALC_VERIFICATION_FAILED,
    severity: ValidationSeverity.BLOCKING,
    defaultMessage: 'Calculation verification failed',
    resolutionHint: 'Please try again or contact support',
    isUserVisible: false, // System internal
  },
  
  // Warnings
  [WARNING_CODES.SEASON_BOUNDARY_CROSSING]: {
    code: WARNING_CODES.SEASON_BOUNDARY_CROSSING,
    severity: ValidationSeverity.WARNING,
    defaultMessage: 'Stay spans multiple seasons',
    resolutionHint: 'Pricing will vary by season',
    isUserVisible: true,
  },
  [WARNING_CODES.DISCOUNT_AUTO_REMOVED]: {
    code: WARNING_CODES.DISCOUNT_AUTO_REMOVED,
    severity: ValidationSeverity.WARNING,
    defaultMessage: 'Selected discount was removed as it did not meet eligibility criteria',
    resolutionHint: 'Check discount requirements',
    isUserVisible: true,
  },
};

/**
 * Gets error metadata for a code.
 */
export function getErrorMetadata(code: string): ErrorCodeMetadata | undefined {
  return ERROR_CODE_REGISTRY[code];
}

/**
 * Checks if an error code is user-visible.
 * Reference: BRD v1.2 Section 7.4
 */
export function isUserVisibleError(code: string): boolean {
  const metadata = ERROR_CODE_REGISTRY[code];
  return metadata?.isUserVisible ?? true; // Default to visible for safety
}
