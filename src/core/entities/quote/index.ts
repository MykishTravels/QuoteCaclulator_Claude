/**
 * Quote Domain Entities - Barrel Export
 * 
 * All 11 quote entities + 2 operational entities per Phase 5.
 */

// Core quote entities
export {
  type Quote,
  isValidStatusTransition,
  type QuoteVersion,
  type QuoteLevelMarkup,
  validateQuoteLevelMarkup,
} from './core';

// Leg entities
export {
  type QuoteLeg,
  type QuoteLegRoom,
  type NightlyRoomRate,
  type ExtraPersonChargeLineItem,
  type QuoteLegLineItem,
  createTaxLineItem,
  type AppliedDiscount,
  validateDiscountNotOnTaxes,
} from './leg';

// Transfer entities
export {
  type InterResortTransfer,
  // NOTE: InterResortTransferInput has two forms:
  // - Entity form (from ./transfer) for user/domain input  
  // - Calculation form (from calculation/types) for calculation input
  // Both are aliased in core/index.ts to avoid collision
  validateInterResortTransferInput,
} from './transfer';

// Summary entities
export {
  type QuotePricingSummary,
  type LegSummary,
  type QuoteTotals,
  validateQuoteTotals,
  type TaxesBreakdown,
  validateTaxesBreakdown,
  createEmptyTaxesBreakdown,
} from './summary';

// Validation entities
export {
  type QuoteValidationResult,
  createValidationResult,
  mergeValidationResults,
  hasErrorCode,
  hasWarningCode,
} from './validation';

// Audit entities
export {
  type QuoteCalculationAudit,
  AuditBuilder,
  verifyAuditTotals,
  extractAuditSummary,
} from './audit';

// Operational entities
export {
  type EmailRecord,
  type PDFRecord,
} from './operational';
