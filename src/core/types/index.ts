/**
 * Core Types - Barrel Export
 * 
 * All primitive types, enums, and common types for the quote engine.
 */

// Primitives (branded types)
export {
  type DateString,
  type DateTimeString,
  type EntityId,
  type CurrencyCode,
  type MoneyAmount,
  type Percentage,
  type ExchangeRate,
  toDateString,
  toDateTimeString,
  nowAsDateTimeString,
  toEntityId,
  toCurrencyCode,
  toMoneyAmount,
  toPercentage,
  toExchangeRate,
  fromDateString,
  fromMoneyAmount,
  fromPercentage,
  fromExchangeRate,
} from './primitives';

// Enums
export {
  PricingMode,
  TransferDirection,
  TaxType,
  TaxCalculationMethod,
  TaxAppliesTo,
  DiscountType,
  DiscountBaseType,
  DiscountApplicationOrder,
  MarkupType,
  MarkupScope,
  QuoteStatus,
  LineItemType,
  isTaxLineItem,
  isGovernmentPassThroughTax,
  ValidationSeverity,
  ExchangeRateSource,
  AuditStepType,
  PDFDisplayMode,
  EmailStatus,
  InterResortTransferMarkupSource,
  GuestType,
} from './enums';

// Common types
export {
  type PricingBreakdown,
  type PricingBreakdownWithMetrics,
  type DateRange,
  type Child,
  type GuestConfiguration,
  validateGuestConfiguration,
  type ChildCostsByBand,
  type QuantityDetail,
  type ValidationItem,
  type ExchangeRateMap,
  type AuditStep,
  type AuditWarning,
  type Result,
  type Success,
  type Failure,
  success,
  failure,
  isSuccess,
  isFailure,
} from './common';
