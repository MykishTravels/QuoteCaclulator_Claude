/**
 * Common Types
 * 
 * Shared type definitions used across multiple entities.
 * 
 * Reference: Phase 5 - Section A.2 Utility Types
 */

import type {
  DateString,
  EntityId,
  MoneyAmount,
  Percentage,
} from './primitives';

// ============================================================
// PRICING BREAKDOWN
// Core three-layer pricing model
// ============================================================

/**
 * Three-layer pricing breakdown for any priced component.
 * Reference: BRD v1.2 Section 3.1.2 - Three-Layer Pricing Model
 * 
 * Invariant: sell_amount = cost_amount + markup_amount
 */
export interface PricingBreakdown {
  /** Net cost (internal only) */
  readonly cost_amount: MoneyAmount;
  /** Margin added (internal only, never shown to client) */
  readonly markup_amount: MoneyAmount;
  /** Final price (client visible): cost + markup */
  readonly sell_amount: MoneyAmount;
}

/**
 * Extended pricing breakdown with percentage metrics.
 * Used in quote totals for reporting.
 */
export interface PricingBreakdownWithMetrics extends PricingBreakdown {
  /** Markup as percentage of cost: (markup / cost) × 100 */
  readonly markup_percentage: Percentage;
  /** Margin as percentage of sell: (markup / sell) × 100 */
  readonly margin_percentage: Percentage;
}

// ============================================================
// DATE RANGE
// ============================================================

/**
 * Inclusive date range.
 * Both start_date and end_date are included in the range.
 */
export interface DateRange {
  readonly start_date: DateString;
  readonly end_date: DateString;
}

// ============================================================
// GUEST TYPES
// ============================================================

/**
 * Child guest with age.
 * Reference: A-014 - Max child age is 11; 12+ is adult
 */
export interface Child {
  /** Age in years (0-11 valid; 12+ must be booked as adult) */
  readonly age: number;
  /** Resolved during calculation - links to ChildAgeBand */
  readonly age_band_id?: EntityId;
}

/**
 * Complete guest configuration for a booking.
 */
export interface GuestConfiguration {
  /** Number of adult guests */
  readonly adults_count: number;
  /** Child guests with ages */
  readonly children: readonly Child[];
}

/**
 * Validates guest configuration.
 * Reference: Phase 3 Occupancy Validation Rules
 */
export function validateGuestConfiguration(config: GuestConfiguration): string[] {
  const errors: string[] = [];
  
  const totalGuests = config.adults_count + config.children.length;
  
  if (totalGuests < 1) {
    errors.push('Total guests must be at least 1');
  }
  
  if (config.adults_count < 0) {
    errors.push('Adults count cannot be negative');
  }
  
  for (let i = 0; i < config.children.length; i++) {
    const child = config.children[i];
    if (child.age < 0 || child.age > 11) {
      errors.push(`Child ${i + 1}: age must be 0-11 (12+ is adult)`);
    }
  }
  
  return errors;
}

// ============================================================
// CHILD COST MAPPING
// ============================================================

/**
 * Map of child age band ID to cost amount.
 * Used for meal plans, transfers, activities with child pricing.
 */
export interface ChildCostsByBand {
  readonly [ageBandId: string]: MoneyAmount;
}

// ============================================================
// QUANTITY DETAIL
// Flexible structure for line item quantities
// ============================================================

/**
 * Quantity detail for line items.
 * Fields vary by line item type.
 */
export interface QuantityDetail {
  /** Number of adults (for per-person pricing) */
  readonly adults?: number;
  /** Number of children (for per-person pricing) */
  readonly children?: number;
  /** Age band reference (for child-specific pricing) */
  readonly age_band_id?: string;
  /** Number of nights (for per-night pricing) */
  readonly nights?: number;
  /** Number of rooms */
  readonly rooms?: number;
  /** Number of bookings (for per-booking pricing) */
  readonly bookings?: number;
  /** Number of trips (for per-trip pricing) */
  readonly trips?: number;
  /** Number of guests (for taxes) */
  readonly guests?: number;
  /** Rate amount (for taxes) */
  readonly rate?: MoneyAmount;
  /** Base amount (for percentage calculations) */
  readonly base_amount?: MoneyAmount;
  /** Rate percentage (for percentage-based items) */
  readonly rate_percentage?: Percentage;
  /** Trigger date (for festive supplements) */
  readonly trigger_date?: DateString;
}

// ============================================================
// VALIDATION ITEM
// ============================================================

import { ValidationSeverity } from './enums';

/**
 * Single validation error or warning.
 * Reference: Phase 5 - QuoteValidationResult schema
 */
export interface ValidationItem {
  /** Error/warning code from Phase 3 code inventory */
  readonly code: string;
  /** BLOCKING or WARNING */
  readonly severity: ValidationSeverity;
  /** Scope indicator (e.g., "leg[0].room", "quote.dates") */
  readonly scope: string;
  /** Human-readable message */
  readonly message: string;
  /** Optional hint for resolution */
  readonly resolution_hint?: string;
}

// ============================================================
// EXCHANGE RATE MAP
// ============================================================

import type { ExchangeRate, CurrencyCode } from './primitives';

/**
 * Map of currency codes to exchange rates.
 * Rate represents: 1 unit of key currency = rate units of quote currency
 */
export interface ExchangeRateMap {
  readonly [currencyCode: string]: ExchangeRate;
}

// ============================================================
// AUDIT TYPES
// ============================================================

import type { DateTimeString } from './primitives';
import { AuditStepType } from './enums';

/**
 * Single audit step in calculation trail.
 * Reference: Phase 4 Section J - Audit Trail Structure
 */
export interface AuditStep {
  readonly step_number: number;
  readonly step_type: AuditStepType;
  readonly leg_id?: EntityId;
  readonly timestamp: DateTimeString;
  readonly description: string;
  readonly inputs: Record<string, unknown>;
  readonly outputs: Record<string, unknown>;
  readonly result_amount: MoneyAmount;
}

/**
 * Audit warning captured during calculation.
 */
export interface AuditWarning {
  readonly code: string;
  readonly severity: ValidationSeverity;
  readonly message: string;
}

// ============================================================
// RESULT TYPES
// Functional result pattern for operations that can fail
// ============================================================

/**
 * Success result.
 */
export interface Success<T> {
  readonly success: true;
  readonly value: T;
}

/**
 * Failure result with error.
 */
export interface Failure<E> {
  readonly success: false;
  readonly error: E;
}

/**
 * Result type for operations that can fail.
 * Prefer this over throwing exceptions for expected failure cases.
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Creates a success result.
 */
export function success<T>(value: T): Success<T> {
  return { success: true, value };
}

/**
 * Creates a failure result.
 */
export function failure<E>(error: E): Failure<E> {
  return { success: false, error };
}

/**
 * Type guard for success result.
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success;
}

/**
 * Type guard for failure result.
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return !result.success;
}
