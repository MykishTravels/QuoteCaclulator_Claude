/**
 * Arithmetic Utilities
 * 
 * Safe arithmetic operations for the calculation engine.
 * 
 * Design principles:
 * - All operations work with raw numbers (not MoneyAmount) during calculation
 * - Overflow/underflow detection
 * - No intermediate rounding (per Phase 4)
 */

import type { MoneyAmount, Percentage } from '../types';
import { toMoneyAmount } from '../types';

// ============================================================
// SAFE ARITHMETIC
// ============================================================

/** Maximum safe number for currency calculations */
const MAX_SAFE_AMOUNT = 999_999_999_999.99; // ~1 trillion

/** Minimum safe number for currency calculations */
const MIN_SAFE_AMOUNT = -999_999_999_999.99;

/**
 * Error thrown when arithmetic operation fails.
 */
export class ArithmeticError extends Error {
  constructor(
    message: string,
    public readonly code: 'OVERFLOW' | 'UNDERFLOW' | 'INVALID_INPUT' | 'DIVIDE_BY_ZERO'
  ) {
    super(message);
    this.name = 'ArithmeticError';
  }
}

/**
 * Validates that a number is within safe bounds.
 */
function validateBounds(value: number, operation: string): void {
  if (!Number.isFinite(value)) {
    throw new ArithmeticError(
      `${operation}: Result is not finite`,
      'INVALID_INPUT'
    );
  }
  
  if (value > MAX_SAFE_AMOUNT) {
    throw new ArithmeticError(
      `${operation}: Result ${value} exceeds maximum safe amount ${MAX_SAFE_AMOUNT}`,
      'OVERFLOW'
    );
  }
  
  if (value < MIN_SAFE_AMOUNT) {
    throw new ArithmeticError(
      `${operation}: Result ${value} is below minimum safe amount ${MIN_SAFE_AMOUNT}`,
      'UNDERFLOW'
    );
  }
}

/**
 * Safely adds two numbers.
 */
export function safeAdd(a: number, b: number): number {
  const result = a + b;
  validateBounds(result, 'safeAdd');
  return result;
}

/**
 * Safely subtracts b from a.
 */
export function safeSubtract(a: number, b: number): number {
  const result = a - b;
  validateBounds(result, 'safeSubtract');
  return result;
}

/**
 * Safely multiplies two numbers.
 */
export function safeMultiply(a: number, b: number): number {
  const result = a * b;
  validateBounds(result, 'safeMultiply');
  return result;
}

/**
 * Safely divides a by b.
 */
export function safeDivide(a: number, b: number): number {
  if (b === 0) {
    throw new ArithmeticError('Division by zero', 'DIVIDE_BY_ZERO');
  }
  
  const result = a / b;
  validateBounds(result, 'safeDivide');
  return result;
}

// ============================================================
// PERCENTAGE CALCULATIONS
// ============================================================

/**
 * Calculates percentage of a base amount.
 * @param base The base amount
 * @param percentage The percentage (e.g., 15.00 = 15%)
 * @returns The percentage amount (NOT rounded)
 */
export function calculatePercentage(base: number, percentage: number): number {
  return safeMultiply(base, safeDivide(percentage, 100));
}

/**
 * Calculates margin percentage (markup / sell × 100).
 * Reference: BRD v1.2 Section 6.6
 */
export function calculateMarginPercentage(markup: number, sell: number): number {
  if (sell === 0) return 0;
  return safeMultiply(safeDivide(markup, sell), 100);
}

/**
 * Calculates markup percentage (markup / cost × 100).
 * Reference: BRD v1.2 Section 6.6
 */
export function calculateMarkupPercentage(markup: number, cost: number): number {
  if (cost === 0) return 0;
  return safeMultiply(safeDivide(markup, cost), 100);
}

// ============================================================
// AGGREGATION
// ============================================================

/**
 * Safely sums an array of numbers.
 */
export function safeSum(values: readonly number[]): number {
  return values.reduce((acc, val) => safeAdd(acc, val), 0);
}

/**
 * Sums MoneyAmounts and returns raw number (for intermediate calculations).
 */
export function sumAmounts(amounts: readonly MoneyAmount[]): number {
  return safeSum(amounts.map(a => a as number));
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validates that a final amount is non-negative.
 * Reference: Phase 6 - CALC_NEGATIVE_FINAL_AMOUNT
 * 
 * Note: Intermediate negatives ARE allowed during calculation.
 * This check is only for final stored amounts.
 */
export function validateNonNegativeFinal(
  amount: number,
  context: string
): void {
  if (amount < 0) {
    throw new ArithmeticError(
      `${context}: Final amount ${amount} is negative`,
      'INVALID_INPUT'
    );
  }
}

/**
 * Creates a MoneyAmount with non-negative validation.
 * Use for final storage only.
 */
export function toNonNegativeMoneyAmount(
  value: number,
  context: string
): MoneyAmount {
  validateNonNegativeFinal(value, context);
  return toMoneyAmount(value);
}

// ============================================================
// THREE-LAYER PRICING HELPERS
// ============================================================

/**
 * Calculates sell from cost and markup.
 * Invariant: sell = cost + markup
 */
export function calculateSell(cost: number, markup: number): number {
  return safeAdd(cost, markup);
}

/**
 * Calculates markup from cost and percentage.
 */
export function calculateMarkupFromPercentage(
  cost: number,
  markupPercentage: number
): number {
  return calculatePercentage(cost, markupPercentage);
}

/**
 * Creates a complete pricing breakdown.
 */
export function createPricingBreakdown(
  cost: number,
  markupPercentage: number
): { cost: number; markup: number; sell: number } {
  const markup = calculateMarkupFromPercentage(cost, markupPercentage);
  const sell = calculateSell(cost, markup);
  
  return { cost, markup, sell };
}
