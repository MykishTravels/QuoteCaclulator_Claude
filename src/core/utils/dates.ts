/**
 * Date Utilities
 * 
 * Date manipulation for the quote engine.
 * 
 * Constraints:
 * - A-003: All dates are ISO 8601 calendar dates (YYYY-MM-DD)
 * - A-004: Night count = check-out - check-in
 */

import type { DateString } from '../types';
import { toDateString } from '../types';

// ============================================================
// DATE PARSING AND CREATION
// ============================================================

/**
 * Parses a DateString to a JavaScript Date.
 * The date is interpreted as midnight UTC.
 */
export function parseDateString(date: DateString): Date {
  return new Date(date as string + 'T00:00:00Z');
}

/**
 * Creates a DateString from a JavaScript Date.
 */
export function toDateStringFromDate(date: Date): DateString {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return toDateString(`${year}-${month}-${day}`);
}

/**
 * Gets today's date as a DateString.
 */
export function today(): DateString {
  return toDateStringFromDate(new Date());
}

// ============================================================
// DATE ARITHMETIC
// ============================================================

/**
 * Adds days to a date.
 */
export function addDays(date: DateString, days: number): DateString {
  const d = parseDateString(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStringFromDate(d);
}

/**
 * Subtracts days from a date.
 */
export function subtractDays(date: DateString, days: number): DateString {
  return addDays(date, -days);
}

/**
 * Calculates the number of days between two dates.
 * @returns Number of days (positive if end > start)
 */
export function daysBetween(start: DateString, end: DateString): number {
  const startDate = parseDateString(start);
  const endDate = parseDateString(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates the number of nights for a stay.
 * Reference: A-004 - Night count = check-out - check-in
 */
export function calculateNights(checkIn: DateString, checkOut: DateString): number {
  return daysBetween(checkIn, checkOut);
}

// ============================================================
// DATE COMPARISON
// ============================================================

/**
 * Checks if date1 is before date2.
 */
export function isBefore(date1: DateString, date2: DateString): boolean {
  return (date1 as string) < (date2 as string);
}

/**
 * Checks if date1 is after date2.
 */
export function isAfter(date1: DateString, date2: DateString): boolean {
  return (date1 as string) > (date2 as string);
}

/**
 * Checks if date1 equals date2.
 */
export function isSameDate(date1: DateString, date2: DateString): boolean {
  return (date1 as string) === (date2 as string);
}

/**
 * Checks if date is on or after start AND on or before end.
 */
export function isWithinRange(
  date: DateString,
  start: DateString,
  end: DateString
): boolean {
  const d = date as string;
  return d >= (start as string) && d <= (end as string);
}

/**
 * Checks if date is in the future (after today).
 */
export function isFuture(date: DateString): boolean {
  return isAfter(date, today());
}

/**
 * Checks if date is today or in the future.
 */
export function isTodayOrFuture(date: DateString): boolean {
  const todayStr = today();
  return (date as string) >= (todayStr as string);
}

/**
 * Checks if date is in the past (before today).
 */
export function isPast(date: DateString): boolean {
  return isBefore(date, today());
}

// ============================================================
// DATE ITERATION
// ============================================================

/**
 * Generates all dates in a range (inclusive of start, exclusive of end).
 * Useful for night-by-night calculations.
 * 
 * @param start Start date (inclusive)
 * @param end End date (exclusive)
 * @yields Each date in the range
 */
export function* dateRange(
  start: DateString,
  end: DateString
): Generator<DateString> {
  let current = start;
  while (isBefore(current, end)) {
    yield current;
    current = addDays(current, 1);
  }
}

/**
 * Converts a date range generator to an array.
 */
export function dateRangeArray(
  start: DateString,
  end: DateString
): DateString[] {
  return Array.from(dateRange(start, end));
}

// ============================================================
// DATE VALIDATION
// ============================================================

/**
 * Validates date sequence for a stay.
 * Reference: Phase 3 - DATE-002
 */
export function validateStayDates(
  checkIn: DateString,
  checkOut: DateString
): string[] {
  const errors: string[] = [];
  
  // DATE-002: Check-out must be after check-in
  if (!isAfter(checkOut, checkIn)) {
    errors.push('Check-out date must be after check-in date');
  }
  
  // DATE-003: Minimum stay is 1 night
  if (calculateNights(checkIn, checkOut) < 1) {
    errors.push('Minimum stay is 1 night');
  }
  
  return errors;
}

/**
 * Validates check-in date is not in the past.
 * Reference: Phase 3 - DATE-001
 */
export function validateCheckInNotPast(checkIn: DateString): string[] {
  const errors: string[] = [];
  
  if (!isTodayOrFuture(checkIn)) {
    errors.push('Check-in date must be today or in the future');
  }
  
  return errors;
}

/**
 * Validates leg date sequence (leg N+1 starts on or after leg N ends).
 * Reference: Phase 3 - DATE-010
 */
export function validateLegSequence(
  prevCheckOut: DateString,
  nextCheckIn: DateString
): { valid: boolean; gap: number } {
  const gap = daysBetween(prevCheckOut, nextCheckIn);
  
  // DATE-010: Leg N+1 check-in must be >= Leg N check-out
  // Gap < 0 means overlap (invalid)
  // Gap = 0 means same-day transfer (valid)
  // Gap > 0 means accommodation gap (warning)
  
  return {
    valid: gap >= 0,
    gap,
  };
}

// ============================================================
// EXPIRATION CALCULATIONS
// ============================================================

/**
 * Calculates quote expiry date.
 * @param sentDate The date the quote was sent
 * @param validityDays Number of days the quote is valid
 */
export function calculateExpiryDate(
  sentDate: DateString,
  validityDays: number
): DateString {
  return addDays(sentDate, validityDays);
}

/**
 * Checks if a quote is expired.
 */
export function isQuoteExpired(
  sentDate: DateString,
  validityDays: number
): boolean {
  const expiryDate = calculateExpiryDate(sentDate, validityDays);
  return isPast(expiryDate);
}

/**
 * Calculates days until expiry.
 * @returns Days remaining (negative if expired)
 */
export function daysUntilExpiry(
  sentDate: DateString,
  validityDays: number
): number {
  const expiryDate = calculateExpiryDate(sentDate, validityDays);
  return daysBetween(today(), expiryDate);
}
