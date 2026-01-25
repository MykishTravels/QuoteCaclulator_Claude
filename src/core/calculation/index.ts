/**
 * Calculation Module - Barrel Export
 * 
 * Quote calculation engine for multi-resort travel quotes.
 */

// Types
export type {
  LegCalculationInput,
  InterResortTransferInput,
  QuoteCalculationInput,
  CalculationContext,
  CalculationDataAccess,
  NightlyRateResult,
  ExtraPersonChargeResult,
  ComponentResult,
  TaxResult,
  DiscountResult,
  MarkupResult,
  LegCalculationResult,
  InterResortTransferResult,
  QuoteCalculationResult,
  // NOTE: CalculationErrorCode is canonical in utils/errors.ts - not re-exported here
  GuestCounts,
} from './types';

export {
  CalculationError,
  CalculationAuditBuilder,
  resolveGuestCounts,
} from './types';

// Main calculator
export { calculateQuote } from './quote-calculator';
export { calculateLeg } from './leg-calculator';

// Components
export * from './components';

// Engines
export * from './engines';

// Data adapter
export {
  createDataAccess,
  loadDataStore,
  type DataStore,
} from './data-adapter';
