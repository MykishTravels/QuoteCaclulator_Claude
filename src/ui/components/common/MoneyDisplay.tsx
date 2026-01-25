/**
 * MoneyDisplay Component
 * 
 * Formats and displays a MoneyAmount with currency.
 * 
 * GUARDRAIL: DISPLAY ONLY.
 * - Receives amount directly from API
 * - No calculations
 * - No transformations
 * - Pure formatting
 */

import React from 'react';
import type { MoneyAmount, CurrencyCode } from '../../types';

export interface MoneyDisplayProps {
  /** Amount to display */
  amount: MoneyAmount;
  /** Currency code */
  currency: CurrencyCode;
  /** Optional CSS class */
  className?: string;
  /** Show currency code (default: true) */
  showCurrency?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Currency symbols for common currencies.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  MVR: 'MVR ',
  AED: 'AED ',
};

/**
 * Formats a money amount for display.
 * GUARDRAIL: Pure formatting function - no calculations.
 */
function formatAmount(amount: MoneyAmount, currency: CurrencyCode): string {
  const numAmount = amount as number;
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  
  return `${symbol}${numAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Money display component.
 * Renders a formatted money amount.
 */
export function MoneyDisplay({
  amount,
  currency,
  className = '',
  showCurrency = true,
  size = 'md',
}: MoneyDisplayProps): React.ReactElement {
  const formatted = formatAmount(amount, currency);
  
  // Size classes
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  };
  
  return (
    <span className={`font-mono ${sizeClasses[size]} ${className}`}>
      {formatted}
    </span>
  );
}

/**
 * Compact money display for tables/lists.
 */
export function MoneyDisplayCompact({
  amount,
  currency,
}: Pick<MoneyDisplayProps, 'amount' | 'currency'>): React.ReactElement {
  return <MoneyDisplay amount={amount} currency={currency} size="sm" />;
}
