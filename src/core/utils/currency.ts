/**
 * Currency Utilities
 * 
 * CRITICAL: This module contains the ONLY rounding function.
 * Reference: Phase 4 Locked Refinement #1
 * 
 * Constraints:
 * - A-001: All amounts stored with 2 decimal precision
 * - A-002: Exchange rate precision is 6 decimals
 * - Single global roundCurrency() helper; ad-hoc rounding PROHIBITED
 */

import type {
  MoneyAmount,
  ExchangeRate,
  CurrencyCode,
  ExchangeRateMap,
} from '../types';

import { toMoneyAmount, toExchangeRate } from '../types';

// ============================================================
// ROUNDING
// Reference: Phase 4 Locked Refinement #1
// ============================================================

/**
 * GLOBAL CURRENCY ROUNDING FUNCTION
 * 
 * This is the ONLY function that should be used for rounding monetary amounts.
 * Ad-hoc rounding is PROHIBITED.
 * 
 * @param amount The amount to round
 * @returns The amount rounded to 2 decimal places using HALF_UP
 * 
 * Reference: Phase 4 Locked Refinement #1
 * - Method: HALF_UP (standard banker's rounding)
 * - Precision: 2 decimal places
 * - Application: Applied ONCE at final storage, not during intermediate calculations
 */
export function roundCurrency(amount: number): MoneyAmount {
  // HALF_UP rounding: add 0.005 and truncate
  // This handles the edge case of x.xx5 correctly
  const rounded = Math.round(amount * 100) / 100;
  return toMoneyAmount(rounded);
}

/**
 * Rounds an exchange rate to 6 decimal places.
 * Reference: A-002
 */
export function roundExchangeRate(rate: number): ExchangeRate {
  const rounded = Math.round(rate * 1000000) / 1000000;
  return toExchangeRate(rounded);
}

// ============================================================
// CURRENCY CONVERSION
// ============================================================

/**
 * Converts an amount from one currency to another.
 * 
 * IMPORTANT: Does NOT round the result. Rounding should only occur
 * at final storage using roundCurrency().
 * 
 * @param amount The amount to convert
 * @param fromCurrency Source currency code
 * @param toCurrency Target currency code
 * @param exchangeRates Map of currency codes to rates (1 unit = X target units)
 * @returns The converted amount (unrounded)
 * @throws Error if exchange rate is missing
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  exchangeRates: ExchangeRateMap
): number {
  // Same currency - no conversion needed
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  const rate = exchangeRates[fromCurrency as string];
  if (rate === undefined) {
    throw new Error(`Exchange rate missing for currency: ${fromCurrency}`);
  }
  
  // Rate is: 1 unit of fromCurrency = rate units of toCurrency
  return amount * (rate as number);
}

/**
 * Converts and rounds an amount.
 * Use this only when storing the final converted value.
 */
export function convertAndRoundCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  exchangeRates: ExchangeRateMap
): MoneyAmount {
  const converted = convertCurrency(amount, fromCurrency, toCurrency, exchangeRates);
  return roundCurrency(converted);
}

// ============================================================
// EXCHANGE RATE VALIDATION
// ============================================================

/**
 * Validates that all required currencies have exchange rates.
 * Reference: Phase 3 - CUR-002
 */
export function validateExchangeRates(
  requiredCurrencies: readonly CurrencyCode[],
  exchangeRates: ExchangeRateMap,
  quoteCurrency: CurrencyCode
): string[] {
  const errors: string[] = [];
  
  for (const currency of requiredCurrencies) {
    if (currency === quoteCurrency) {
      // Quote currency should have rate 1.0
      const rate = exchangeRates[currency as string];
      if (rate === undefined) {
        errors.push(`Exchange rate missing for quote currency: ${currency}`);
      } else if (Math.abs((rate as number) - 1.0) > 0.000001) {
        errors.push(`Quote currency ${currency} should have rate 1.0, got ${rate}`);
      }
    } else {
      if (exchangeRates[currency as string] === undefined) {
        errors.push(`Exchange rate missing for currency: ${currency}`);
      }
    }
  }
  
  return errors;
}

/**
 * Validates exchange rate bounds.
 * Reference: Phase 3 - EXCHANGE_RATE_EXTREME_LOW, EXCHANGE_RATE_EXTREME_HIGH
 */
export function validateExchangeRateBounds(
  exchangeRates: ExchangeRateMap
): { code: string; currency: string; rate: number }[] {
  const warnings: { code: string; currency: string; rate: number }[] = [];
  
  const EXTREME_LOW = 0.0001;
  const EXTREME_HIGH = 100000;
  
  for (const [currency, rate] of Object.entries(exchangeRates)) {
    const rateNum = rate as number;
    
    if (rateNum < EXTREME_LOW) {
      warnings.push({
        code: 'EXCHANGE_RATE_EXTREME_LOW',
        currency,
        rate: rateNum,
      });
    }
    
    if (rateNum > EXTREME_HIGH) {
      warnings.push({
        code: 'EXCHANGE_RATE_EXTREME_HIGH',
        currency,
        rate: rateNum,
      });
    }
  }
  
  return warnings;
}

// ============================================================
// CURRENCY FORMATTING
// ============================================================

/**
 * Formats a money amount for display.
 * @param amount The amount to format
 * @param currencyCode The currency code
 * @param locale The locale for formatting (default: en-US)
 */
export function formatCurrency(
  amount: MoneyAmount,
  currencyCode: CurrencyCode,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode as string,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount as number);
}

/**
 * Formats a money amount without currency symbol.
 */
export function formatAmount(
  amount: MoneyAmount,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount as number);
}
