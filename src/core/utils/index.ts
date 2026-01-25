/**
 * Core Utilities - Barrel Export
 */

// Currency utilities (includes CRITICAL roundCurrency)
export {
  roundCurrency,
  roundExchangeRate,
  convertCurrency,
  convertAndRoundCurrency,
  validateExchangeRates,
  validateExchangeRateBounds,
  formatCurrency,
  formatAmount,
} from './currency';

// Arithmetic utilities
export {
  ArithmeticError,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  calculatePercentage,
  calculateMarginPercentage,
  calculateMarkupPercentage,
  safeSum,
  sumAmounts,
  validateNonNegativeFinal,
  toNonNegativeMoneyAmount,
  calculateSell,
  calculateMarkupFromPercentage,
  createPricingBreakdown,
} from './arithmetic';

// Date utilities
export {
  parseDateString,
  toDateStringFromDate,
  today,
  addDays,
  subtractDays,
  daysBetween,
  calculateNights,
  isBefore,
  isAfter,
  isSameDate,
  isWithinRange,
  isFuture,
  isTodayOrFuture,
  isPast,
  dateRange,
  dateRangeArray,
  validateStayDates,
  validateCheckInNotPast,
  validateLegSequence,
  calculateExpiryDate,
  isQuoteExpired,
  daysUntilExpiry,
} from './dates';

// Error codes
export {
  DATE_ERROR_CODES,
  SEASON_ERROR_CODES,
  OCCUPANCY_ERROR_CODES,
  COMPONENT_ERROR_CODES,
  CURRENCY_MARKUP_ERROR_CODES,
  MULTI_RESORT_ERROR_CODES,
  LIFECYCLE_ERROR_CODES,
  MINIMUM_STAY_ERROR_CODES,
  BLOCKING_ERROR_CODES,
  type BlockingErrorCode,
  WARNING_CODES,
  type WarningCode,
  CALCULATION_ERROR_CODES,
  type CalculationErrorCode,
  CALCULATION_ERROR_RETRYABLE,
  isRetryableCalculationError,
  type ErrorCodeMetadata,
  ERROR_CODE_REGISTRY,
  getErrorMetadata,
  isUserVisibleError,
} from './errors';

// ID generation
export {
  ID_PREFIXES,
  type IdPrefix,
  generateId,
  generateQuoteId,
  generateQuoteVersionId,
  generateLegId,
  generateLineItemId,
  resetIdCounter,
  getIdPrefix,
  hasPrefix,
  isValidId,
} from './ids';
