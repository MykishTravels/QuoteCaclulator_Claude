/**
 * Primitive Types
 * 
 * Foundation types for the Multi-Resort Travel Quote Engine.
 * These types enforce semantic meaning at the type level.
 * 
 * Reference: Phase 5 - Section A.1 Primitive Types
 * Constraint: A-001 (2 decimal precision), A-002 (6 decimal exchange rates)
 */

// ============================================================
// BRANDED TYPES
// Branded types prevent accidental mixing of semantically different values
// ============================================================

/** Brand marker for nominal typing */
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

/**
 * ISO 8601 date string (YYYY-MM-DD)
 * Constraint: A-003 - All dates are ISO 8601 calendar dates
 */
export type DateString = Brand<string, 'DateString'>;

/**
 * ISO 8601 datetime string with timezone (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export type DateTimeString = Brand<string, 'DateTimeString'>;

/**
 * Entity identifier (UUID or prefixed identifier)
 * Format: PREFIX-ENTITY-SEQUENCE (e.g., RST-001, QV-2025-00042-001)
 */
export type EntityId = Brand<string, 'EntityId'>;

/**
 * ISO 4217 currency code (e.g., USD, EUR, MVR)
 */
export type CurrencyCode = Brand<string, 'CurrencyCode'>;

/**
 * Monetary amount
 * Constraint: A-001 - All amounts stored with 2 decimal precision
 * Note: Rounding applied ONLY at final storage via roundCurrency()
 * Implementation: Simple alias to allow arithmetic. Type safety via naming convention.
 */
export type MoneyAmount = number;

/**
 * Percentage value (e.g., 15.00 = 15%)
 * Stored as the percentage number, not decimal (15.00, not 0.15)
 */
export type Percentage = number;

/**
 * Exchange rate with 6 decimal precision
 * Constraint: A-002 - Exchange rate precision is 6 decimals
 */
export type ExchangeRate = number;

// ============================================================
// TYPE GUARDS AND CONSTRUCTORS
// These functions create branded types from raw values
// ============================================================

/** ISO 8601 date regex: YYYY-MM-DD */
const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/** ISO 8601 datetime regex with timezone */
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** Currency code regex: 3 uppercase letters */
const CURRENCY_REGEX = /^[A-Z]{3}$/;

/**
 * Creates a DateString from a raw string.
 * @throws Error if format is invalid
 */
export function toDateString(value: string): DateString {
  if (!DATE_REGEX.test(value)) {
    throw new Error(`Invalid DateString format: ${value}. Expected YYYY-MM-DD`);
  }
  return value as DateString;
}

/**
 * Creates a DateTimeString from a raw string.
 * @throws Error if format is invalid
 */
export function toDateTimeString(value: string): DateTimeString {
  if (!DATETIME_REGEX.test(value)) {
    throw new Error(`Invalid DateTimeString format: ${value}. Expected ISO 8601 with Z timezone`);
  }
  return value as DateTimeString;
}

/**
 * Creates a DateTimeString from current time.
 */
export function nowAsDateTimeString(): DateTimeString {
  return new Date().toISOString() as DateTimeString;
}

/**
 * Creates an EntityId from a raw string.
 * Minimal validation - allows flexibility in ID formats.
 */
export function toEntityId(value: string): EntityId {
  if (!value || value.trim().length === 0) {
    throw new Error('EntityId cannot be empty');
  }
  return value as EntityId;
}

/**
 * Creates a CurrencyCode from a raw string.
 * @throws Error if not a valid 3-letter code
 */
export function toCurrencyCode(value: string): CurrencyCode {
  const upper = value.toUpperCase();
  if (!CURRENCY_REGEX.test(upper)) {
    throw new Error(`Invalid CurrencyCode: ${value}. Expected 3 uppercase letters`);
  }
  return upper as CurrencyCode;
}

/**
 * Creates a MoneyAmount from a raw number.
 * Does NOT round - rounding is applied only at storage.
 */
export function toMoneyAmount(value: number): MoneyAmount {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid MoneyAmount: ${value}. Must be a finite number`);
  }
  return value as MoneyAmount;
}

/**
 * Creates a Percentage from a raw number.
 */
export function toPercentage(value: number): Percentage {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid Percentage: ${value}. Must be a finite number`);
  }
  return value as Percentage;
}

/**
 * Creates an ExchangeRate from a raw number.
 * @throws Error if rate is not positive
 */
export function toExchangeRate(value: number): ExchangeRate {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ExchangeRate: ${value}. Must be a positive finite number`);
  }
  return value as ExchangeRate;
}

// ============================================================
// TYPE EXTRACTION
// Extract raw values from branded types (for serialization)
// ============================================================

/**
 * Extracts the raw string from a DateString.
 */
export function fromDateString(value: DateString): string {
  return value as string;
}

/**
 * Extracts the raw number from a MoneyAmount.
 */
export function fromMoneyAmount(value: MoneyAmount): number {
  return value as number;
}

/**
 * Extracts the raw number from a Percentage.
 */
export function fromPercentage(value: Percentage): number {
  return value as number;
}

/**
 * Extracts the raw number from an ExchangeRate.
 */
export function fromExchangeRate(value: ExchangeRate): number {
  return value as number;
}
