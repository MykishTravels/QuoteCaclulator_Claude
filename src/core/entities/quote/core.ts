/**
 * Quote Domain Entities - Core
 * 
 * Quote, QuoteVersion, and QuoteLevelMarkup entities.
 * 
 * Reference: Phase 5 - Section C.1, C.2, C.3
 */

import type {
  EntityId,
  CurrencyCode,
  DateTimeString,
  MoneyAmount,
  ExchangeRateMap,
} from '../types';

import {
  QuoteStatus,
  ExchangeRateSource,
  MarkupType,
} from '../types';

import type { QuoteLeg } from './leg';
import type { InterResortTransfer } from './transfer';
import type { QuotePricingSummary } from './summary';
import type { QuoteValidationResult } from './validation';
import type { QuoteCalculationAudit } from './audit';

// ============================================================
// QUOTE (Container)
// Reference: Phase 5 - Section C.1
// ============================================================

/**
 * Quote container entity.
 * The mutable "shell" that holds immutable versions.
 */
export interface Quote {
  readonly id: EntityId;
  
  // Client Information
  readonly client_name: string;
  readonly client_email?: string;
  readonly client_notes?: string;
  
  // Quote Settings
  readonly currency_code: CurrencyCode;
  /** Days until quote expires (1-90 per QTE-001, QTE-002) */
  readonly validity_days: number;
  
  // Status
  /** Reference: BRD v1.2 Section 3.3.1 */
  readonly status: QuoteStatus;
  
  // Version Tracking
  /**
   * Reference to current (latest) version.
   * Null only when quote is new and never calculated.
   * Reference: A-021 - Quote cannot be sent without a QuoteVersion
   */
  readonly current_version_id: EntityId | null;
  
  // Metadata
  readonly created_at: DateTimeString;
  readonly updated_at: DateTimeString;
}

/**
 * Validates quote status transition.
 * Reference: BRD v1.2 Section 3.3.2
 */
export function isValidStatusTransition(
  from: QuoteStatus,
  to: QuoteStatus
): boolean {
  switch (from) {
    case QuoteStatus.DRAFT:
      return to === QuoteStatus.SENT;
    case QuoteStatus.SENT:
      return [
        QuoteStatus.DRAFT,
        QuoteStatus.CONVERTED,
        QuoteStatus.REJECTED,
        QuoteStatus.EXPIRED,
      ].includes(to);
    case QuoteStatus.EXPIRED:
      return to === QuoteStatus.DRAFT;
    case QuoteStatus.REJECTED:
      return to === QuoteStatus.DRAFT;
    case QuoteStatus.CONVERTED:
      // Terminal state
      return false;
    default:
      return false;
  }
}

// ============================================================
// QUOTE VERSION (Immutable Snapshot)
// Reference: Phase 5 - Section C.2
// ============================================================

/**
 * Immutable pricing snapshot.
 * Once created, a QuoteVersion is never modified.
 * Reference: FR-030, FR-031, FR-032
 */
export interface QuoteVersion {
  readonly id: EntityId;
  readonly quote_id: EntityId;
  
  /** Monotonically increasing (1, 2, 3...) */
  readonly version_number: number;
  
  // Currency & Exchange
  readonly currency_code: CurrencyCode;
  /**
   * Exchange rates locked at calculation time.
   * Always populated, even for same-currency (rate = 1.0).
   * Reference: Phase 2 clarification #2
   */
  readonly exchange_rates_used: ExchangeRateMap;
  readonly exchange_rate_timestamp: DateTimeString;
  readonly exchange_rate_source: ExchangeRateSource;
  
  // Content
  readonly legs: readonly QuoteLeg[];
  readonly inter_resort_transfers: readonly InterResortTransfer[];
  
  /**
   * Quote-level markup override.
   * Reference: Phase 4 Locked Refinement #5 - FIXED only in v1
   */
  readonly quote_level_markup: QuoteLevelMarkup | null;
  
  // Calculated Results
  readonly pricing_summary: QuotePricingSummary;
  readonly validation_result: QuoteValidationResult;
  readonly calculation_audit: QuoteCalculationAudit;
  
  // Metadata
  readonly created_at: DateTimeString;
}

// ============================================================
// QUOTE-LEVEL MARKUP
// Reference: Phase 5 - Section C.3
// ============================================================

/**
 * Quote-level markup override.
 * v1: FIXED only - PERCENTAGE deferred to v2.
 * Reference: Phase 4 Locked Refinement #5
 */
export interface QuoteLevelMarkup {
  /**
   * v1: Only 'FIXED' is supported.
   * Attempting to use 'PERCENTAGE' will result in PERCENTAGE_OVERRIDE_NOT_SUPPORTED error.
   */
  readonly markup_type: typeof MarkupType.FIXED;
  
  /** Fixed amount to add to quote total */
  readonly markup_value: MoneyAmount;
  
  /** Must match quote currency */
  readonly currency_code: CurrencyCode;
  
  /** Optional: reason for override */
  readonly override_reason?: string;
}

/**
 * Validates quote-level markup.
 * Reference: Phase 4 - MKP-004, MKP-006
 */
export function validateQuoteLevelMarkup(
  markup: QuoteLevelMarkup,
  quoteCurrency: CurrencyCode
): string[] {
  const errors: string[] = [];
  
  // v1: Only FIXED supported
  if (markup.markup_type !== MarkupType.FIXED) {
    errors.push('Quote-level percentage markup override is not supported in v1');
  }
  
  // Currency must match quote
  if (markup.currency_code !== quoteCurrency) {
    errors.push(`Fixed markup currency (${markup.currency_code}) must match quote currency (${quoteCurrency})`);
  }
  
  // Value must be non-negative
  if ((markup.markup_value as number) < 0) {
    errors.push('Fixed markup value cannot be negative');
  }
  
  return errors;
}
